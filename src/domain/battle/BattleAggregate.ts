import { ANCHORS } from '../../content/anchors'
import { AVATAR_ID, cardDef, cardName } from '../../content/cards'
import { encounterDef } from '../../content/encounters'
import { seedRng, type RngState } from '../../core/Rng'
import { needsSpellTarget, type SpellDo } from '../effects'
import { ADJACENT, CELLS, isAdjacent, isCell, type Cell } from '../geometry'
import type { EncounterId, RemoveReason, RemoveTo } from '../types'
import type { BattleEvent, PointsSource } from './events'
import { currentPoints, finalPoints, incomingReduction, isLeading, woundEstimate } from './points'
import {
  avatarOf,
  boardCards,
  cardAt,
  emptyBoard,
  isSealed,
  type BattleState,
  type CardInst,
} from './state'

export interface LegalPlay {
  card: string
  cells: Cell[]
  targets: string[]
}

export interface BattleStartOpts {
  encounterId: EncounterId
  deck: string[]
  seed: number
  handDelta?: number
}

export interface PreviewPlay {
  player: number
  enemy: number
  avatar: number
  mana: number
  manaCap: number
}

const PHASE_TEXT: Record<string, string> = { play: '出牌', pressure: '压迫', over: '结束' }

export class BattleAggregate {
  readonly state: BattleState
  private lastCurrent = new Map<string, number>()

  private constructor(state: BattleState) {
    this.state = state
  }

  static start(opts: BattleStartOpts): { aggregate: BattleAggregate; events: BattleEvent[] } {
    const enc = encounterDef(opts.encounterId)
    const state: BattleState = {
      encounterId: opts.encounterId,
      rng: seedRng(opts.seed),
      nextId: 1,
      cards: {},
      board: emptyBoard(),
      hand: [],
      deck: [...opts.deck],
      discard: [],
      exile: [],
      mana: 0,
      manaCap: 0,
      turn: 1,
      phase: 'play',
      opening: true,
      leading: false,
    }
    const agg = new BattleAggregate(state)
    const events: BattleEvent[] = []

    for (const slot of enc.setup) {
      const inst = agg.spawn(slot.defId, 'enemy', 'board')
      inst.cell = slot.cell
      state.board[slot.cell] = inst.id
    }

    const setup = enc.setup.map((slot) => {
      const inst = cardAt(state, slot.cell)!
      return { cell: slot.cell, defId: slot.defId, current: currentPoints(state, inst) }
    })
    events.push({
      type: 'battle.started',
      encounterId: opts.encounterId,
      setup,
      text: `${enc.name}开战。${setup.map((s) => `格${s.cell}${cardName(s.defId)}${s.current}`).join('、')}。`,
    })
    for (const slot of setup) {
      const inst = cardAt(state, slot.cell)!
      events.push({
        type: 'battle.cardEntered',
        card: inst.id,
        cell: slot.cell,
        covered: false,
        text: `${cardName(inst.defId)}落在格${slot.cell}。`,
      })
    }
    agg.flushPoints(events, 'map')

    const avatar = agg.spawn(AVATAR_ID, 'player', 'hand')
    avatar.isAvatar = true
    state.hand.push(avatar.id)
    events.push({
      type: 'battle.avatarDealt',
      card: avatar.id,
      defId: AVATAR_ID,
      deckLeft: state.deck.length,
      text: '化身入手。',
    })

    const draws = ANCHORS.openingDraw + (opts.handDelta ?? 0)
    for (let i = 0; i < draws; i++) agg.draw(events)

    events.push({ type: 'battle.manaChanged', current: 0, cap: 0, text: '费用 0/0。' })
    agg.emitTurnStart(events, true)
    events.push({ type: 'battle.phaseChanged', phase: 'play', text: '出牌阶段。' })
    return { aggregate: agg, events }
  }

  static fromState(state: BattleState): BattleAggregate {
    const agg = new BattleAggregate(structuredClone(state))
    agg.rememberPoints()
    return agg
  }

  viewPoints(): { player: number; enemy: number } {
    return { player: finalPoints(this.state, 'player'), enemy: finalPoints(this.state, 'enemy') }
  }

  legalPlays(): LegalPlay[] {
    const s = this.state
    if (s.result || s.phase !== 'play') return []
    const mustAvatar = this.mustPlaceAvatar()
    const out: LegalPlay[] = []
    for (const id of s.hand) {
      const card = s.cards[id]
      if (mustAvatar && !card.isAvatar) continue
      const def = cardDef(card.defId)
      if (s.mana < def.cost) continue
      if (card.kind === 'occupy') {
        const cells = CELLS.filter((cell) => this.canOccupy(card, cell))
        if (cells.length) out.push({ card: id, cells, targets: [] })
      } else if (def.spell) {
        if (needsSpellTarget(def.spell)) {
          const targets = this.spellTargets(def.spell)
          if (targets.length) out.push({ card: id, cells: [], targets })
        } else {
          out.push({ card: id, cells: [], targets: [] })
        }
      }
    }
    return out
  }

  previewPlay(cardId: string, cell?: number, target?: string): PreviewPlay | null {
    const copy = BattleAggregate.fromState(this.state)
    try {
      copy.playerPlay(cardId, cell, target)
    } catch {
      return null
    }
    const av = avatarOf(copy.state)
    return {
      player: finalPoints(copy.state, 'player'),
      enemy: finalPoints(copy.state, 'enemy'),
      avatar: av && av.zone === 'board' ? currentPoints(copy.state, av) : av ? currentPoints(copy.state, av) : 0,
      mana: copy.state.mana,
      manaCap: copy.state.manaCap,
    }
  }

  inspect(cardId: string) {
    const card = this.state.cards[cardId]
    if (!card) return null
    const def = cardDef(card.defId)
    return {
      defId: card.defId,
      name: def.name,
      basePoints: card.basePoints,
      currentPoints: currentPoints(this.state, card),
      statuses: [...card.statuses],
      isAvatar: card.isAvatar,
      owner: card.owner,
      zone: card.zone,
      cell: card.cell,
    }
  }

  mustPlaceAvatar(): boolean {
    const av = avatarOf(this.state)
    return !!av && av.zone !== 'board' && !this.state.result
  }

  canEndTurn(): boolean {
    return this.state.phase === 'play' && !this.state.result && !this.mustPlaceAvatar()
  }

  playerPlay(cardId: string, cell?: number, target?: string): BattleEvent[] {
    const s = this.state
    if (s.result) throw new Error('战斗已结束')
    if (s.phase !== 'play') throw new Error('现在不能出牌')
    const legal = this.legalPlays().find((p) => p.card === cardId)
    if (!legal) throw new Error('不能打出这张牌')
    const card = s.cards[cardId]
    const def = cardDef(card.defId)

    let resolvedCell = cell
    let resolvedTarget = target
    if (card.kind === 'occupy') {
      if (resolvedCell === undefined) {
        if (legal.cells.length === 1) resolvedCell = legal.cells[0]
        else throw new Error('占场必须指定格子')
      }
      if (!legal.cells.includes(resolvedCell as Cell)) throw new Error('不能打到这个格子')
    } else if (def.spell && needsSpellTarget(def.spell)) {
      if (!resolvedTarget) {
        if (legal.targets.length === 1) resolvedTarget = legal.targets[0]
        else throw new Error('法术必须指定目标')
      }
      if (!legal.targets.includes(resolvedTarget)) throw new Error('非法目标')
    }

    const events: BattleEvent[] = []
    if (def.cost > 0) this.adjustMana(-def.cost, 0, events)

    if (card.kind === 'occupy') {
      const dest = resolvedCell as Cell
      const victim = cardAt(s, dest)
      events.push({
        type: 'battle.cardPlayed',
        card: card.id,
        defId: card.defId,
        kind: 'occupy',
        cell: dest,
        text: `${def.name}打出到格${dest}。`,
      })
      let coveredPts: number | null = null
      if (victim) {
        coveredPts = currentPoints(s, victim)
        events.push({
          type: 'battle.cardCovered',
          victim: victim.id,
          by: card.id,
          cell: dest,
          victimPoints: coveredPts,
          text: `${def.name}覆盖${cardName(victim.defId)}（${coveredPts}）。`,
        })
        this.removeCard(victim, victim.owner === 'player' ? 'discard' : 'exile', 'cover', events)
        if (s.result) return events
      }
      this.enterOccupy(card, dest, coveredPts, events)
    } else {
      events.push({
        type: 'battle.cardPlayed',
        card: card.id,
        defId: card.defId,
        kind: 'spell',
        text: `打出${def.name}。`,
      })
      this.resolveSpell(def.spell!, resolvedTarget, events)
      this.toDiscard(card)
    }

    this.updateLead(events)
    return events
  }

  playerEndTurn(): BattleEvent[] {
    const s = this.state
    if (s.result) throw new Error('战斗已结束')
    if (s.phase !== 'play') throw new Error('现在不能结束回合')
    if (this.mustPlaceAvatar()) throw new Error('化身未入场，不能结束回合')
    const events: BattleEvent[] = []
    s.phase = 'pressure'
    events.push({ type: 'battle.phaseChanged', phase: 'pressure', text: '压迫阶段。' })
    this.resolvePressure(events)
    if (s.result) return events
    s.opening = false
    s.turn += 1
    s.phase = 'play'
    this.emitTurnStart(events, false)
    if (s.result) return events
    events.push({ type: 'battle.phaseChanged', phase: 'play', text: '出牌阶段。' })
    if (this.legalPlays().length === 0 && !isLeading(s)) {
      this.settle('lose', 'noPlay', events)
    }
    return events
  }

  private emitTurnStart(events: BattleEvent[], opening: boolean): void {
    const s = this.state
    s.leading = isLeading(s)
    const won = !opening && s.leading
    events.push({
      type: 'battle.turnStarted',
      turn: s.turn,
      opening,
      leading: s.leading,
      won,
      text: opening ? `第${s.turn}回合开始（开战）。` : `第${s.turn}回合开始。${s.leading ? '仍领先。' : '未领先。'}`,
    })
    if (won) {
      this.settle('win', 'lead', events)
      return
    }
    if (!opening) {
      this.unsealAll(events)
      this.adjustMana(s.manaCap - s.mana, 0, events)
      this.draw(events)
    }
  }

  private canOccupy(card: CardInst, cell: Cell): boolean {
    const here = cardAt(this.state, cell)
    if (!here) return true
    if (here.owner === card.owner) return false
    if (here.isAvatar) return false
    return currentPoints(this.state, card) > currentPoints(this.state, here)
  }

  private spellTargets(spell: SpellDo): string[] {
    if (spell.do === 'damageEnemy') {
      return boardCards(this.state).filter((c) => c.owner === 'enemy' && !c.isAvatar).map((c) => c.id)
    }
    if (spell.do === 'sealEnemy') {
      return boardCards(this.state).filter((c) => c.owner === 'enemy' && !isSealed(c)).map((c) => c.id)
    }
    return []
  }

  private resolveSpell(spell: SpellDo, targetId: string | undefined, events: BattleEvent[]): void {
    const s = this.state
    if (spell.do === 'damageEnemy') {
      const t = s.cards[targetId!]
      this.changePermanent(t, -spell.amount, events, 'spell')
      return
    }
    if (spell.do === 'buffAvatar') {
      const av = avatarOf(s)
      if (av && av.zone === 'board') this.changePermanent(av, spell.amount, events, 'spell')
      return
    }
    if (spell.do === 'sealEnemy') {
      this.seal(s.cards[targetId!], events)
      return
    }
    if (spell.do === 'removeEnemiesAtMost') {
      const victims = boardCards(s)
        .filter((c) => c.owner === 'enemy' && currentPoints(s, c) <= spell.atMost)
        .sort((a, b) => (a.cell ?? 0) - (b.cell ?? 0))
      for (const v of victims) {
        this.removeCard(v, 'exile', 'effect', events)
        if (s.result) return
      }
      return
    }
    if (spell.do === 'sealEnemiesAdjacentToAvatar') {
      const av = avatarOf(s)
      if (!av?.cell) return
      const adj = ADJACENT[av.cell]
      for (const cell of [...adj].sort((a, b) => a - b)) {
        const c = cardAt(s, cell)
        if (c && c.owner === 'enemy' && !isSealed(c)) this.seal(c, events)
      }
    }
  }

  private enterOccupy(card: CardInst, cell: Cell, coveredPts: number | null, events: BattleEvent[]): void {
    const s = this.state
    card.zone = 'board'
    card.cell = cell
    if (coveredPts !== null) card.permanent -= coveredPts
    s.board[cell] = card.id
    s.hand = s.hand.filter((id) => id !== card.id)
    events.push({
      type: 'battle.cardEntered',
      card: card.id,
      cell,
      covered: coveredPts !== null,
      text: `${cardName(card.defId)}进入格${cell}${coveredPts !== null ? `（覆盖 -${coveredPts}）` : ''}。`,
    })
    const after = currentPoints(s, card)
    if (after !== card.basePoints) {
      events.push({
        type: 'battle.pointsChanged',
        card: card.id,
        before: card.basePoints,
        after,
        source: coveredPts !== null ? 'cover' : 'enter',
        text: `${cardName(card.defId)} ${card.basePoints}→${after}。`,
      })
    }
    this.lastCurrent.set(card.id, after)
    this.flushPoints(events, 'aura')

    if (card.owner === 'player') {
      if (card.isAvatar) this.adjustMana(1, 1, events)
      else this.adjustMana(0, 1, events)
    }

    const enter = cardDef(card.defId).enter
    if (enter?.do === 'buffAdjacentAllies' && card.cell) {
      for (const n of ADJACENT[card.cell]) {
        const ally = cardAt(s, n)
        if (ally && ally.owner === card.owner) this.changePermanent(ally, enter.amount, events, 'enter')
      }
    }
    if (enter?.do === 'drawIfCovered' && coveredPts !== null) {
      for (let i = 0; i < enter.count; i++) this.draw(events)
    }
  }

  private resolvePressure(events: BattleEvent[]): void {
    const s = this.state
    for (const cell of CELLS) {
      const card = cardAt(s, cell)
      if (!card || card.owner !== 'enemy' || isSealed(card)) continue
      const pressure = cardDef(card.defId).pressure
      if (!pressure) continue
      if (pressure.do === 'damageAdjacentPlayers') {
        for (const n of ADJACENT[cell]) {
          const t = cardAt(s, n)
          if (t && t.owner === 'player') this.dealDamage(t, pressure.amount, events, 'pressure')
        }
      } else if (pressure.do === 'banishAvatarIfAdjacentAndAtMost') {
        const av = avatarOf(s)
        if (av?.cell && av.zone === 'board' && isAdjacent(cell, av.cell) && currentPoints(s, av) <= pressure.atMost) {
          this.removeCard(av, 'exile', 'banish', events)
        }
      } else if (pressure.do === 'damageLowestAlly') {
        const allies = boardCards(s).filter((c) => c.owner === 'player' && !c.isAvatar)
        if (allies.length) {
          allies.sort((a, b) => {
            const d = currentPoints(s, a) - currentPoints(s, b)
            return d !== 0 ? d : (a.cell ?? 0) - (b.cell ?? 0)
          })
          const t = allies[0]
          this.dealDamage(t, pressure.amount, events, 'pressure')
          if (t.zone === 'board' && currentPoints(s, t) === 0) this.removeCard(t, 'discard', 'effect', events)
        }
      } else if (pressure.do === 'damageAvatarOrBanish') {
        const av = avatarOf(s)
        if (av && av.zone === 'board') {
          if (currentPoints(s, av) <= pressure.banishAtMost) this.removeCard(av, 'exile', 'banish', events)
          else this.dealDamage(av, pressure.amount, events, 'pressure')
        }
      }
      events.push({
        type: 'battle.pressureResolved',
        cell,
        defId: card.defId,
        kind: pressure.do,
        text: `${cardName(card.defId)}压迫结算。`,
      })
      this.updateLead(events)
      if (s.result) return
    }
  }

  private dealDamage(card: CardInst, amount: number, events: BattleEvent[], source: PointsSource): void {
    let dmg = amount
    if (card.isAvatar) dmg = Math.max(0, dmg - incomingReduction(this.state))
    if (dmg <= 0) return
    this.changePermanent(card, -dmg, events, source)
  }

  private changePermanent(card: CardInst, delta: number, events: BattleEvent[], source: PointsSource): void {
    if (!delta) return
    const before = currentPoints(this.state, card)
    card.permanent += delta
    const after = currentPoints(this.state, card)
    this.lastCurrent.set(card.id, after)
    events.push({
      type: 'battle.pointsChanged',
      card: card.id,
      before,
      after,
      source,
      text: `${cardName(card.defId)} ${before}→${after}。`,
    })
    this.flushPoints(events, 'aura')
  }

  private seal(card: CardInst, events: BattleEvent[]): void {
    if (isSealed(card)) return
    card.statuses.push('sealed')
    events.push({
      type: 'battle.statusAdded',
      card: card.id,
      status: 'sealed',
      text: `${cardName(card.defId)}被封印。`,
    })
    if (card.owner === 'player' && card.zone === 'board' && card.kind === 'occupy') {
      this.adjustMana(-1, -1, events)
    }
    this.flushPoints(events, 'lock')
  }

  private unsealAll(events: BattleEvent[]): void {
    for (const card of Object.values(this.state.cards)) {
      if (!isSealed(card)) continue
      card.statuses = card.statuses.filter((st) => st !== 'sealed')
      events.push({
        type: 'battle.statusRemoved',
        card: card.id,
        status: 'sealed',
        text: `${cardName(card.defId)}解除封印。`,
      })
      if (card.owner === 'player' && card.zone === 'board' && card.kind === 'occupy') {
        this.adjustMana(0, 1, events)
      }
    }
    this.flushPoints(events, 'lock')
  }

  private removeCard(card: CardInst, to: RemoveTo, reason: RemoveReason, events: BattleEvent[]): void {
    const s = this.state
    const cell = card.cell
    if (card.owner === 'player' && card.kind === 'occupy' && card.zone === 'board' && !isSealed(card)) {
      this.adjustMana(-1, -1, events)
    }
    if (cell) {
      if (s.board[cell] === card.id) s.board[cell] = null
    }
    card.zone = to
    card.cell = undefined
    if (to === 'discard') s.discard.push(card.id)
    else s.exile.push(card.id)
    this.lastCurrent.delete(card.id)
    events.push({
      type: 'battle.cardRemoved',
      card: card.id,
      defId: card.defId,
      cell: cell ?? 1,
      to,
      reason,
      text: `${cardName(card.defId)}离场（${reason}）。`,
    })
    const removed = cardDef(card.defId).removed
    if (removed?.do === 'buffAvatar') {
      const av = avatarOf(s)
      if (av && av.zone === 'board') this.changePermanent(av, removed.amount, events, 'removed')
    }
    this.flushPoints(events, 'aura')
    if (card.isAvatar) this.settle('lose', 'avatarGone', events)
  }

  private toDiscard(card: CardInst): void {
    const s = this.state
    s.hand = s.hand.filter((id) => id !== card.id)
    card.zone = 'discard'
    card.cell = undefined
    s.discard.push(card.id)
  }

  private draw(events: BattleEvent[]): void {
    const s = this.state
    if (s.hand.length >= ANCHORS.handCap) return
    if (!s.deck.length) return
    const defId = s.deck.shift()!
    const inst = this.spawn(defId, 'player', 'hand')
    s.hand.push(inst.id)
    events.push({
      type: 'battle.cardDrawn',
      card: inst.id,
      defId,
      deckLeft: s.deck.length,
      text: `抽到${cardName(defId)}。`,
    })
  }

  private spawn(defId: string, owner: CardInst['owner'], zone: CardInst['zone']): CardInst {
    const def = cardDef(defId)
    const id = `c${this.state.nextId++}`
    const inst: CardInst = {
      id,
      defId,
      owner,
      kind: def.kind,
      zone,
      basePoints: def.basePoints,
      permanent: 0,
      statuses: [],
      isAvatar: defId === AVATAR_ID,
    }
    this.state.cards[id] = inst
    return inst
  }

  private adjustMana(dCurrent: number, dCap: number, events: BattleEvent[]): void {
    const s = this.state
    if (!dCurrent && !dCap) return
    s.manaCap = Math.max(0, s.manaCap + dCap)
    s.mana = Math.max(0, s.mana + dCurrent)
    events.push({
      type: 'battle.manaChanged',
      current: s.mana,
      cap: s.manaCap,
      text: `费用 ${s.mana}/${s.manaCap}。`,
    })
  }

  private updateLead(events: BattleEvent[]): void {
    const leading = isLeading(this.state)
    if (leading === this.state.leading) return
    this.state.leading = leading
    events.push({
      type: 'battle.leadChanged',
      leading,
      text: leading ? '己方领先。' : '领先丢失。',
    })
  }

  private settle(outcome: 'win' | 'lose', reason: 'lead' | 'avatarGone' | 'noPlay', events: BattleEvent[]): void {
    const s = this.state
    if (s.result) return
    const wound = outcome === 'win' ? woundEstimate(s) : ANCHORS.loseHp
    s.result = { outcome, reason, wound }
    s.phase = 'over'
    events.push({ type: 'battle.phaseChanged', phase: 'over', text: '战斗结束。' })
    const reasonText = reason === 'lead' ? '领先检查通过' : reason === 'avatarGone' ? '化身离场' : '无牌可出'
    events.push({
      type: 'battle.settled',
      outcome,
      reason,
      wound,
      text: `${outcome === 'win' ? '胜利' : '失败'}（${reasonText}），伤口 ${wound}。`,
    })
  }

  private rememberPoints(): void {
    this.lastCurrent.clear()
    for (const c of boardCards(this.state)) this.lastCurrent.set(c.id, currentPoints(this.state, c))
  }

  private flushPoints(events: BattleEvent[], source: PointsSource): void {
    for (const card of boardCards(this.state)) {
      const now = currentPoints(this.state, card)
      const prev = this.lastCurrent.get(card.id)
      if (prev !== undefined && prev !== now) {
        events.push({
          type: 'battle.pointsChanged',
          card: card.id,
          before: prev,
          after: now,
          source,
          text: `${cardName(card.defId)} ${prev}→${now}。`,
        })
      }
      this.lastCurrent.set(card.id, now)
    }
  }
}

export function cloneRng(r: RngState): RngState {
  return { s: r.s }
}
