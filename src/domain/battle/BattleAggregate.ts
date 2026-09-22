import { ANCHORS } from '../../content/anchors'
import { cardDef, cardName } from '../../content/cards'
import { encounterDef } from '../../content/encounters'
import { seedRng, nextInt, shuffle, type RngState } from '../../core/Rng'
import type { CardEffect, Op, Sel, Amt, Timing } from '../effects'
import { ADJACENT, CELLS, MIRROR, cellCol, cellRow, isCell, isCorner, type Cell } from '../geometry'
import { isBodyKind, type RemoveReason, type RemoveTo, type Side } from '../types'
import type { BattleEvent, Cause, PointsSource } from './events'
import { auraContributions, avatarCostOf, currentPoints, fenceBlocks, finalPoints, isLeading, mapShare, markedMoveBlocked } from './points'
import {
  avatarOf,
  boardCards,
  cardAt,
  emptyBoard,
  hasStatus,
  isGone,
  isSealed,
  type BattleState,
  type CardInst,
  type DeckEntry,
} from './state'

export interface LegalPlay {
  card: string
  cells: Cell[]
  targets: string[]
}

export interface BattleStartOpts {
  encounterId: string
  deck: Array<string | DeckEntry>
  seed: number
  avatarDefId: string
  avatarBase?: number
  mapEffect?: string
  relicFirstOccupy?: boolean
  shuffleDeck?: boolean
}

export interface PreviewPlay {
  player: number
  enemy: number
  avatar: number
  occupy: number
  occupyCap: number
}

interface FxCtx {
  source: CardInst
  chosen?: CardInst
  chosen2?: CardInst
  dest?: Cell
  sacrificed: DeckEntry[]
  spent: number
}

function eventCause(e: BattleEvent): Cause | undefined {
  switch (e.type) {
    case 'battle.pointsChanged':
    case 'battle.statusAdded':
    case 'battle.statusRemoved':
    case 'battle.cardEntered':
    case 'battle.cardRemoved':
    case 'battle.occupyChanged':
    case 'battle.resourceChanged':
      return e.cause
    default:
      return undefined
  }
}

export class BattleAggregate {
  readonly state: BattleState
  private lastCurrent = new Map<string, number>()
  private causeStack: Cause[] = []

  private causeNow(): Cause | undefined {
    return this.causeStack[this.causeStack.length - 1]
  }

  private fxSource(): PointsSource {
    return this.causeNow()?.timing ?? 'play'
  }

  private liveTimers(): { card: string; defId: string; left: number }[] {
    const out: { card: string; defId: string; left: number }[] = []
    for (const cell of CELLS) {
      const card = cardAt(this.state, cell)
      if (!card || card.timer === undefined) continue
      out.push({ card: card.id, defId: card.defId, left: card.timer })
    }
    return out
  }

  private constructor(state: BattleState) {
    this.state = state
  }

  static start(opts: BattleStartOpts): { aggregate: BattleAggregate; events: BattleEvent[] } {
    const enc = encounterDef(opts.encounterId)
    const entries: DeckEntry[] = opts.deck.map((d) => (
      typeof d === 'string' ? { defId: d, basePoints: cardDef(d).basePoints } : { ...d }
    ))
    const rng = seedRng(opts.seed)
    if (opts.shuffleDeck !== false) shuffle(rng, entries)
    const avatarBase = opts.avatarBase ?? cardDef(opts.avatarDefId).basePoints
    const state: BattleState = {
      encounterId: opts.encounterId,
      boss: enc.tier === 'boss',
      rng,
      nextId: 1,
      cards: {},
      board: emptyBoard(),
      hand: [],
      deck: entries,
      discard: [],
      enemyDiscard: [],
      occupy: 0,
      occupyCap: 0,
      resA: 0,
      goldDelta: 0,
      burnedUids: [],
      firstOccupyDone: false,
      activated: false,
      relicFirstOccupy: !!opts.relicFirstOccupy,
      mapEffect: opts.mapEffect,
      initialAvatar: avatarBase,
      turn: 1,
      phase: 'play',
      opening: true,
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
      text: `${enc.name}开战。${setup.map((s) => `格${s.cell}${s.defId}${s.current}`).join('、')}。`,
    })
    for (const slot of setup) {
      const inst = cardAt(state, slot.cell)!
      events.push({
        type: 'battle.cardEntered',
        card: inst.id,
        cell: slot.cell,
        covered: false,
        motion: 'place',
        text: `${cardName(inst.defId)}落在格${slot.cell}。`,
      })
    }
    agg.flushPoints(events, 'map')

    const avatar = agg.spawn(opts.avatarDefId, 'player', 'hand')
    avatar.isAvatar = true
    avatar.basePoints = avatarBase
    state.hand.push(avatar.id)
    events.push({
      type: 'battle.avatarDealt',
      card: avatar.id,
      defId: opts.avatarDefId,
      deckLeft: state.deck.length,
      text: '化身入手。',
    })
    for (let i = 0; i < ANCHORS.openingDraw; i++) agg.draw(events)

    events.push({ type: 'battle.occupyChanged', current: 0, cap: 0, text: '占领费用 0/0。' })
    agg.runTurnStart(events, true)
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

  mustPlaceAvatar(): boolean {
    const av = avatarOf(this.state)
    return !!av && av.zone !== 'board' && !this.state.result
  }

  canEndTurn(): boolean {
    return this.state.phase === 'play' && !this.state.result && !this.mustPlaceAvatar()
  }

  canActivate(): boolean {
    if (this.state.result || this.state.phase !== 'play' || this.state.activated || this.mustPlaceAvatar()) return false
    const av = avatarOf(this.state)
    return !!av && av.zone === 'board' && !isSealed(av)
  }

  legalActivates(): { card: string; targets: string[] }[] {
    if (!this.canActivate()) return []
    const av = avatarOf(this.state)!
    const def = cardDef(av.defId)
    const fx = def.effects.find((e) => e.timing === 'active')
    if (!fx) return []
    if (av.defId === 'PC.A00') {
      const targets = boardCards(this.state).filter((c) => c.owner === 'enemy' && hasStatus(c, 'marked')).map((c) => c.id)
      return targets.length ? [{ card: av.id, targets }] : []
    }
    return [{ card: av.id, targets: [] }]
  }

  legalPlays(): LegalPlay[] {
    const s = this.state
    if (s.result || s.phase !== 'play') return []
    const must = this.mustPlaceAvatar()
    const out: LegalPlay[] = []
    for (const id of s.hand) {
      const card = s.cards[id]
      if (card.defId === 'PC.X01') continue
      if (must && !card.isAvatar) continue
      const def = cardDef(card.defId)
      if (s.occupy < def.cost) continue
      if (def.effects.some((e) => e.timing === 'play' && e.spendRes && s.resA < e.spendRes)) continue
      if (isBodyKind(card.kind)) {
        const cells = CELLS.filter((cell) => this.canOccupy(card, cell))
        if (cells.length) out.push({ card: id, cells, targets: [] })
      } else {
        const targets = this.spellTargets(card)
        if (def.effects.some((e) => e.ops.some((op) => op.op === 'swapChosen'))) {
          if (targets.length >= 2) out.push({ card: id, cells: [], targets })
          continue
        }
        if (def.effects.some((e) => e.ops.some((op) => op.op === 'spawnHalfCopy'))) {
          const allies = boardCards(s).filter((c) => c.owner === 'player' && !c.isAvatar).map((c) => c.id)
          const cells = CELLS.filter((c) => !cardAt(s, c))
          if (allies.length && cells.length) out.push({ card: id, cells, targets: allies })
          continue
        }
        if (def.effects.some((e) => e.ops.some((op) => op.op === 'moveChosenAdjacent'))) {
          const movers = boardCards(s).filter((c) => c.cell && !markedMoveBlocked(s, c))
          const cells = CELLS.filter((cell) => movers.some((m) => m.cell && ADJACENT[m.cell].includes(cell) && !cardAt(s, cell)))
          if (movers.length && cells.length) out.push({ card: id, cells, targets: movers.map((c) => c.id) })
          continue
        }
        if (def.effects.some((e) => e.ops.some((op) => op.op === 'discardToHand'))) {
          if (s.discard.length) out.push({ card: id, cells: [], targets: [...s.discard] })
          continue
        }
        const needs = this.spellNeedsTarget(card)
        if (needs) {
          if (targets.length) out.push({ card: id, cells: [], targets })
        } else {
          out.push({ card: id, cells: [], targets: [] })
        }
      }
    }
    return out
  }

  previewPlay(cardId: string, cell?: number, target?: string, target2?: string): PreviewPlay | null {
    const copy = BattleAggregate.fromState(this.state)
    try {
      copy.playerPlay(cardId, cell, target, target2)
    } catch {
      return null
    }
    const av = avatarOf(copy.state)
    return {
      player: finalPoints(copy.state, 'player'),
      enemy: finalPoints(copy.state, 'enemy'),
      avatar: av ? currentPoints(copy.state, av) : 0,
      occupy: copy.state.occupy,
      occupyCap: copy.state.occupyCap,
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

  playerActivate(cardId: string, target?: string): BattleEvent[] {
    const s = this.state
    if (!this.canActivate()) throw new Error('现在不能主动触发')
    const av = avatarOf(s)
    if (!av || av.id !== cardId) throw new Error('只能主动触发化身')
    const legal = this.legalActivates().find((a) => a.card === cardId)
    if (!legal) throw new Error('不能主动触发')
    let chosen = target
    if (legal.targets.length) {
      if (!chosen) {
        if (legal.targets.length === 1) chosen = legal.targets[0]
        else throw new Error('主动触发必须指定目标')
      }
      if (!legal.targets.includes(chosen)) throw new Error('非法目标')
    }
    const events: BattleEvent[] = []
    s.activated = true
    events.push({ type: 'battle.activated', card: av.id, defId: av.defId, text: `${cardName(av.defId)}主动触发。` })
    this.runEffects(av, 'active', events, { chosen: chosen ? s.cards[chosen] : undefined })
    this.checkClear(events)
    this.checkNoPlay(events)
    return events
  }

  playerPlay(cardId: string, cell?: number, target?: string, target2?: string): BattleEvent[] {
    const s = this.state
    if (s.result) throw new Error('战斗已结束')
    if (s.phase !== 'play') throw new Error('现在不能出牌')
    const legal = this.legalPlays().find((p) => p.card === cardId)
    if (!legal) throw new Error('不能打出这张牌')
    const card = s.cards[cardId]
    const def = cardDef(card.defId)

    let dest = cell as Cell | undefined
    let tid = target
    if (isBodyKind(card.kind)) {
      if (dest === undefined) {
        if (legal.cells.length === 1) dest = legal.cells[0]
        else throw new Error('占场必须指定格子')
      }
      if (!legal.cells.includes(dest)) throw new Error('不能打到这个格子')
    } else if (legal.targets.length) {
      if (!tid) {
        if (legal.targets.length === 1) tid = legal.targets[0]
        else throw new Error('必须指定目标')
      }
      if (!legal.targets.includes(tid)) throw new Error('非法目标')
      if (def.effects.some((e) => e.ops.some((op) => op.op === 'moveChosenAdjacent' || op.op === 'spawnHalfCopy'))) {
        if (dest === undefined) {
          if (legal.cells.length === 1) dest = legal.cells[0]
          else throw new Error('必须指定格子')
        }
        if (!legal.cells.includes(dest)) throw new Error('不能打到这个格子')
        if (def.effects.some((e) => e.ops.some((op) => op.op === 'moveChosenAdjacent'))) {
          const mover = s.cards[tid]
          if (!mover?.cell || !ADJACENT[mover.cell].includes(dest) || cardAt(s, dest)) {
            throw new Error('不能移动到这个格子')
          }
        }
      }
      if (def.effects.some((e) => e.ops.some((op) => op.op === 'swapChosen'))) {
        if (!target2) throw new Error('必须指定两张卡')
        if (!legal.targets.includes(target2) || target2 === tid) throw new Error('非法目标')
      }
    }

    const events: BattleEvent[] = []
    if (def.cost > 0) this.adjustOccupy(-def.cost, 0, events)

    if (isBodyKind(card.kind)) {
      const here = dest!
      const victim = cardAt(s, here)
      events.push({
        type: 'battle.cardPlayed',
        card: card.id,
        defId: card.defId,
        kind: card.kind,
        cell: here,
        text: `${def.name}打出到格${here}。`,
      })
      this.firePlayWatchers(card, events)
      if (victim && victim.owner === card.owner) {
        this.stackOnAlly(card, victim, here, events)
      } else {
        this.placeOccupy(card, here, victim, events)
      }
    } else {
      events.push({
        type: 'battle.cardPlayed',
        card: card.id,
        defId: card.defId,
        kind: 'spell',
        text: `打出${def.name}。`,
      })
      this.firePlayWatchers(card, events)
      this.runEffects(card, 'play', events, {
        chosen: tid ? s.cards[tid] : undefined,
        chosen2: target2 ? s.cards[target2] : undefined,
        dest,
      })
      if (def.burn) this.burn(card)
      else this.toDiscard(card)
    }

    this.checkClear(events)
    this.checkNoPlay(events)
    return events
  }

  playerEndTurn(): BattleEvent[] {
    const s = this.state
    if (s.result) throw new Error('战斗已结束')
    if (s.phase !== 'play') throw new Error('现在不能结束回合')
    if (this.mustPlaceAvatar()) throw new Error('化身未入场，不能结束回合')
    const events: BattleEvent[] = []
    this.runCampTiming('turnEnd', 'player', events)
    if (s.result) return events
    this.runCampTiming('turnEnd', 'enemy', events)
    if (s.result) return events
    for (const card of boardCards(s)) {
      if (hasStatus(card, 'vulnerable')) this.stripStatus(card, 'vulnerable', events)
    }
    s.opening = false
    s.turn += 1
    this.runTurnStart(events, false)
    if (s.result) return events
    events.push({ type: 'battle.phaseChanged', phase: 'play', text: '出牌阶段。' })
    this.checkNoPlay(events)
    return events
  }

  private runTurnStart(events: BattleEvent[], opening: boolean): void {
    const s = this.state
    this.unsealAll(events)
    this.tickTimers(events)
    if (s.result) return
    this.runCampTiming('turnStart', 'player', events)
    if (s.result) return
    this.runCampTiming('turnStart', 'enemy', events)
    if (s.result) return

    const leading = isLeading(s)
    const won = !opening && leading
    events.push({
      type: 'battle.turnStarted',
      turn: s.turn,
      opening,
      leading,
      won,
      timers: this.liveTimers(),
      text: opening ? `第${s.turn}回合开始（开战）。` : `第${s.turn}回合开始。${leading ? '总点数更大。' : ''}`,
    })
    if (won) {
      this.settle('win', 'lead', events)
      return
    }
    if (!opening) {
      const bodies = boardCards(s).filter((c) => c.owner === 'player' && isBodyKind(c.kind)).length
      this.adjustOccupy(bodies - s.occupy, bodies - s.occupyCap, events, true)
      this.draw(events)
    }
  }

  private runCampTiming(timing: Timing, side: Side, events: BattleEvent[]): void {
    for (const cell of CELLS) {
      const card = cardAt(this.state, cell)
      if (!card || card.owner !== side || isSealed(card)) continue
      this.runEffects(card, timing, events)
      if (this.state.result) return
    }
  }

  private tickTimers(events: BattleEvent[]): void {
    for (const cell of CELLS) {
      const card = cardAt(this.state, cell)
      if (!card || card.timer === undefined || isSealed(card)) continue
      card.timer -= 1
      if (card.timer <= 0) {
        this.runEffects(card, 'timer', events)
        card.timer = card.timerMax
        if (this.state.result) return
      }
    }
  }

  private canOccupy(card: CardInst, cell: Cell): boolean {
    const here = cardAt(this.state, cell)
    if (!here) return !fenceBlocks(this.state, cell, card.owner)
    if (here.owner === card.owner) {
      return !!cardDef(card.defId).overlayAlly && !here.isAvatar
    }
    return currentPoints(this.state, card) > currentPoints(this.state, here)
  }

  private spellNeedsTarget(card: CardInst): boolean {
    const def = cardDef(card.defId)
    return def.effects.some((e) => e.timing === 'play' && e.ops.some((op) => {
      if (op.op === 'markOrDraw' || op.op === 'discardToHand' || op.op === 'swapChosen' || op.op === 'resetChosen' || op.op === 'transferMark') return true
      return 'sel' in op && (op.sel === 'chosen' || op.sel === 'chosen2')
    }))
  }

  private spellTargets(card: CardInst): string[] {
    const def = cardDef(card.defId)
    const s = this.state
    if (card.defId === 'PC.A02' || card.defId === 'PC.A14' || card.defId === 'PC.N03' || card.defId === 'PC.N07') {
      return boardCards(s).filter((c) => card.defId === 'PC.A02' || card.defId === 'PC.A14' ? c.owner === 'enemy' : true).map((c) => c.id)
    }
    if (card.defId === 'PC.B03') return boardCards(s).filter((c) => c.kind === 'occupy').map((c) => c.id)
    if (card.defId === 'PC.C02' || card.defId === 'PC.N07') return boardCards(s).map((c) => c.id)
    if (card.defId === 'PC.C05') return boardCards(s).filter((c) => c.owner === 'player').map((c) => c.id)
    if (card.defId === 'PC.C13') return boardCards(s).filter((c) => c.owner === 'player' && !c.isAvatar).map((c) => c.id)
    if (def.effects.some((e) => e.ops.some((op) => op.op === 'discardToHand'))) return [...s.discard]
    return boardCards(s).filter((c) => c.owner === 'enemy').map((c) => c.id)
  }

  private stackOnAlly(card: CardInst, ally: CardInst, cell: Cell, events: BattleEvent[]): void {
    const gain = currentPoints(this.state, ally)
    card.permanent += gain
    this.removeCard(ally, 'discard', 'stack', events)
    if (this.state.result) return
    this.enterOccupy(card, cell, null, events)
  }

  private placeOccupy(card: CardInst, cell: Cell, victim: CardInst | undefined, events: BattleEvent[]): void {
    const s = this.state
    if (!victim) {
      this.enterOccupy(card, cell, null, events)
      return
    }
    const vp = currentPoints(s, victim)
    const ap = currentPoints(s, card)
    if (ap === vp) {
      events.push({
        type: 'battle.cardCovered',
        victim: victim.id,
        by: card.id,
        cell,
        victimPoints: vp,
        tied: true,
        text: `${cardName(card.defId)}与${cardName(victim.defId)}平点。`,
      })
      s.hand = s.hand.filter((id) => id !== card.id)
      this.removeCard(victim, 'discard', 'tie', events)
      this.removeCard(card, 'discard', 'tie', events)
      return
    }
    events.push({
      type: 'battle.cardCovered',
      victim: victim.id,
      by: card.id,
      cell,
      victimPoints: vp,
      text: `${cardName(card.defId)}覆盖${cardName(victim.defId)}（${vp}）。`,
    })
    this.removeCard(victim, 'discard', 'cover', events)
    if (s.result) return
    this.enterOccupy(card, cell, vp, events)
    this.runEffects(card, 'onCover', events)
    if (s.mapEffect === 'ME.02') this.changePoints(card, -1, events, 'map')
  }

  private enterOccupy(card: CardInst, cell: Cell, coveredPts: number | null, events: BattleEvent[]): void {
    const s = this.state
    card.zone = 'board'
    card.cell = cell
    if (coveredPts !== null) card.permanent -= coveredPts
    s.board[cell] = card.id
    s.hand = s.hand.filter((id) => id !== card.id)
    if (card.owner === 'player' && !card.isAvatar && s.relicFirstOccupy && !s.firstOccupyDone) {
      card.permanent += 2
      s.firstOccupyDone = true
      events.push({
        type: 'battle.pointsChanged',
        card: card.id,
        before: card.basePoints,
        after: currentPoints(s, card),
        source: 'relic',
        text: 'RL.01 第一张占场 +2。',
      })
    }
    if (s.mapEffect === 'ME.05' && card.cell) {
      const m = MIRROR[card.cell]
      const ally = m ? cardAt(s, m) : undefined
      if (ally && ally.owner === card.owner) this.changePoints(card, 2, events, 'map')
    }
    events.push({
      type: 'battle.cardEntered',
      card: card.id,
      cell,
      covered: coveredPts !== null,
      motion: 'place',
      cause: this.causeNow(),
      text: `${cardName(card.defId)}进入格${cell}${coveredPts !== null ? `（覆盖 -${coveredPts}）` : ''}。`,
    })
    this.lastCurrent.set(card.id, currentPoints(s, card))
    this.flushPoints(events, 'aura')
    if (card.owner === 'player' && card.isAvatar) {
      this.adjustOccupy(1, 1, events, false, {
        actor: card.id,
        defId: card.defId,
        timing: 'enter',
        op: 'enter',
      })
    }
    this.runEffects(card, 'enter', events)
    this.runEffects(card, 'play', events)
    if (cardDef(card.defId).burn) this.markBurned(card)
  }

  private runEffects(source: CardInst, timing: Timing, events: BattleEvent[], extra: Partial<FxCtx> = {}): void {
    const def = cardDef(source.defId)
    const list = def.effects.filter((e) => e.timing === timing)
    if (!list.length) return
    for (const fx of list) {
      const ctx: FxCtx = { source, sacrificed: [], spent: 0, ...extra }
      if (fx.ops.some((op) => op.op === 'spawnCopyAtMirror')) {
        const m = source.cell ? MIRROR[source.cell] : undefined
        if (!m || cardAt(this.state, m)) continue
      }
      if (fx.sacrifice) {
        if (this.state.deck.length < fx.sacrifice) continue
        ctx.sacrificed = this.sacrifice(fx.sacrifice, events)
      }
      if (fx.spendRes && this.state.resA < fx.spendRes) continue
      this.causeStack.push({
        actor: source.id,
        defId: source.defId,
        timing,
        op: fx.ops[0]?.op ?? timing,
      })
      const from = events.length
      let aborted = false
      try {
        if (fx.spendRes) {
          this.addRes(-fx.spendRes, events)
          ctx.spent = fx.spendRes
        }
        if (fx.spendResUpTo) {
          const others = boardCards(this.state).filter((c) => c.owner === source.owner && c.id !== source.id).length
          const n = Math.min(this.state.resA, fx.spendResUpTo, others)
          if (n) this.addRes(-n, events)
          ctx.spent = n
        }
        if (fx.spendResAll) {
          const n = Math.min(this.state.resA, fx.spendResAll)
          if (n) this.addRes(-n, events)
          ctx.spent = n
        }
        for (const op of fx.ops) {
          this.resolveOp(op, ctx, events)
          if (this.state.result) { aborted = true; break }
        }
        if (!aborted) {
          const hit = events.slice(from).some((e) => eventCause(e)?.actor === source.id)
          events.push({
            type: 'battle.effectResolved',
            card: source.id,
            defId: source.defId,
            timing,
            cell: source.cell,
            hit,
            text: `${cardName(source.defId)}结算${timing}。`,
          })
        }
      } finally {
        this.causeStack.pop()
      }
      if (aborted) return
    }
  }

  private resolveOp(op: Op, ctx: FxCtx, events: BattleEvent[]): void {
    const base = this.causeNow()
    this.causeStack.push({
      actor: base?.actor ?? ctx.source.id,
      defId: base?.defId ?? ctx.source.defId,
      timing: base?.timing ?? 'play',
      op: op.op,
    })
    try {
      this.applyOp(op, ctx, events)
    } finally {
      this.causeStack.pop()
    }
  }

  private applyOp(op: Op, ctx: FxCtx, events: BattleEvent[]): void {
    const s = this.state
    switch (op.op) {
      case 'mark':
        for (const t of this.pick(op.sel, ctx, op.one)) this.addStatus(t, 'marked', events)
        return
      case 'unmark':
        for (const t of this.pick(op.sel, ctx, op.one)) this.stripStatus(t, 'marked', events)
        return
      case 'damage':
        for (const t of this.pick(op.sel, ctx, op.one)) {
          if (op.ifMarked && hasStatus(t, 'marked')) {
            this.changePoints(t, -this.amt(op.ifMarked.n, ctx, t), events, this.fxSource())
            if (op.ifMarked.unmark) this.stripStatus(t, 'marked', events)
          } else {
            this.changePoints(t, -this.amt(op.n, ctx, t), events, this.fxSource())
          }
        }
        return
      case 'buff':
        for (const t of this.pick(op.sel, ctx, op.one)) this.changePoints(t, this.amt(op.n, ctx, t), events, this.fxSource())
        return
      case 'status':
        for (const t of this.pick(op.sel, ctx, op.one)) this.addStatus(t, op.status, events)
        return
      case 'remove':
        for (const t of this.pick(op.sel, ctx, op.one)) {
          if (op.maxPoints !== undefined && currentPoints(s, t) > op.maxPoints) continue
          this.removeCard(t, 'discard', 'effect', events)
        }
        return
      case 'draw':
        for (let i = 0; i < op.n; i++) this.draw(events)
        return
      case 'gainRes':
        this.addRes(op.n, events)
        return
      case 'spawnCopyAtMirror': {
        if (!ctx.source.cell) return
        const m = MIRROR[ctx.source.cell]
        if (!m || cardAt(s, m)) return
        const copy = this.spawnOnto(ctx.source.defId, ctx.source.owner, m, events)
        if (op.link) {
          const link = `l${s.nextId++}`
          ctx.source.linkId = link
          copy.linkId = link
        }
        return
      }
      case 'shuffleCopyToDeck':
        s.deck.push({ defId: ctx.source.defId, basePoints: cardDef(ctx.source.defId).basePoints })
        shuffle(s.rng, s.deck)
        return
      case 'shuffleSelfToDeck':
        s.deck.push({ defId: ctx.source.defId, basePoints: ctx.source.basePoints, boxUid: ctx.source.boxUid })
        shuffle(s.rng, s.deck)
        ctx.source.zone = 'gone'
        return
      case 'shuffleDiscardToDeck':
        for (const id of [...s.discard]) {
          const c = s.cards[id]
          s.deck.push({ defId: c.defId, basePoints: c.basePoints, boxUid: c.boxUid })
          c.zone = 'gone'
        }
        s.discard = []
        shuffle(s.rng, s.deck)
        return
      case 'discardToHand': {
        const t = ctx.chosen
        if (!t || !s.discard.includes(t.id)) return
        s.discard = s.discard.filter((id) => id !== t.id)
        if (s.hand.length >= ANCHORS.handCap) {
          s.discard.push(t.id)
          t.zone = 'discard'
        } else {
          t.zone = 'hand'
          t.cell = undefined
          s.hand.push(t.id)
          events.push({ type: 'battle.cardDrawn', card: t.id, defId: t.defId, deckLeft: s.deck.length, text: `${cardName(t.defId)}从弃牌回手。` })
        }
        return
      }
      case 'spawnHalfCopy': {
        const t = ctx.chosen
        const dest = ctx.dest
        if (!t || !dest || cardAt(s, dest) || t.isAvatar || t.owner !== 'player') return
        const copy = this.spawnOnto(t.defId, 'player', dest, events)
        copy.basePoints = currentPoints(s, t)
        copy.permanent = 0
        this.flushPoints(events, 'enter')
        return
      }
      case 'moveTowardAvatar':
        this.moveTowardAvatar(ctx.source, events, !!op.cover, !!op.pokeIfAdjacent)
        return
      case 'moveColumn':
        this.moveColumn(ctx.source, events)
        return
      case 'moveRowRandom':
        this.moveRow(ctx.source, events)
        return
      case 'moveChosenAdjacent': {
        const t = ctx.chosen
        const dest = ctx.dest
        if (!t?.cell || dest === undefined || cardAt(s, dest)) return
        if (!ADJACENT[t.cell].includes(dest)) return
        if (markedMoveBlocked(s, t)) return
        this.relocate(t, dest, events)
        return
      }
      case 'swapChosen': {
        const a = ctx.chosen
        const b = ctx.chosen2
        if (!a?.cell || !b?.cell || a.id === b.id) return
        const ca = a.cell, cb = b.cell
        a.cell = cb
        b.cell = ca
        s.board[ca] = b.id
        s.board[cb] = a.id
        this.flushPoints(events, 'aura')
        return
      }
      case 'resetChosen':
        if (ctx.chosen) {
          ctx.chosen.permanent = 0
          this.flushPoints(events, 'play')
        }
        return
      case 'gold':
        s.goldDelta += op.n
        return
      case 'burn':
        this.burn(ctx.source)
        return
      case 'spawnAdjacent':
        this.spawnAdjacent(ctx.source, op.defId, op.max, events)
        return
      case 'removeAdjacentDef':
        if (!ctx.source.cell) return
        for (const n of [...ADJACENT[ctx.source.cell]].sort((a, b) => a - b)) {
          const t = cardAt(s, n)
          if (t && t.defId === op.defId) this.removeCard(t, 'discard', 'effect', events)
        }
        return
      case 'pollute':
        s.deck.push({ defId: op.defId, basePoints: cardDef(op.defId).basePoints })
        shuffle(s.rng, s.deck)
        return
      case 'nibbleHandOccupy': {
        const occ = s.hand.map((id) => s.cards[id]).filter((c) => c.kind === 'occupy')
        if (!occ.length) return
        const t = occ[nextInt(s.rng, occ.length)]
        const before = currentPoints(s, t)
        this.changePoints(t, -op.n, events, 'turnEnd')
        if (before > 0 && currentPoints(s, t) === 0) {
          this.removeCard(t, 'discard', 'effect', events)
          const av = avatarOf(s)
          if (av) this.changePoints(av, -2, events, 'turnEnd')
        }
        return
      }
      case 'sealHighestAdjacentOpponent': {
        if (!ctx.source.cell) return
        const cands = ADJACENT[ctx.source.cell].map((c) => cardAt(s, c)).filter((c): c is CardInst => !!c && c.owner !== ctx.source.owner)
        if (!cands.length) return
        cands.sort((a, b) => {
          const d = currentPoints(s, b) - currentPoints(s, a)
          return d !== 0 ? d : (a.cell ?? 0) - (b.cell ?? 0)
        })
        this.addStatus(cands[0], 'sealed', events)
        return
      }
      case 'transferMark': {
        const t = ctx.chosen
        if (!t?.cell || !hasStatus(t, 'marked')) return
        this.stripStatus(t, 'marked', events)
        const next = ADJACENT[t.cell].map((c) => cardAt(s, c)).filter((c): c is CardInst => !!c && c.owner === t.owner)
        next.sort((a, b) => (a.cell ?? 0) - (b.cell ?? 0))
        if (next[0]) this.addStatus(next[0], 'marked', events)
        return
      }
      case 'markOrDraw': {
        const t = ctx.chosen
        if (!t) return
        if (hasStatus(t, 'marked')) this.draw(events)
        else this.addStatus(t, 'marked', events)
        return
      }
      case 'buffDifferentAlliesByRes': {
        const allies = boardCards(s)
          .filter((c) => c.owner === ctx.source.owner && c.id !== ctx.source.id)
          .sort((a, b) => (a.cell ?? 0) - (b.cell ?? 0))
        const n = Math.min(ctx.spent, allies.length)
        for (let i = 0; i < n; i++) this.changePoints(allies[i], 2, events, 'enter')
        return
      }
      case 'ifResAtLeast':
        for (const inner of (s.resA >= op.n ? op.then : op.else)) this.resolveOp(inner, ctx, events)
        return
      case 'ifDeckAtMost':
        for (const inner of (s.deck.length <= op.n ? op.then : op.else)) this.resolveOp(inner, ctx, events)
        return
      case 'ifAdjacentMarked': {
        if (!ctx.source.cell) return
        const hit = ADJACENT[ctx.source.cell].some((c) => {
          const t = cardAt(s, c)
          return t && t.owner !== ctx.source.owner && hasStatus(t, 'marked')
        })
        if (hit) for (const inner of op.then) this.resolveOp(inner, ctx, events)
        return
      }
      case 'ifCorner':
        if (ctx.source.cell && isCorner(ctx.source.cell)) for (const inner of op.then) this.resolveOp(inner, ctx, events)
        return
      case 'n06Tax': {
        if (!ctx.source.cell) return
        const allies = ADJACENT[ctx.source.cell].map((c) => cardAt(s, c)).filter((c): c is CardInst => !!c && c.owner === ctx.source.owner)
        allies.sort((a, b) => (a.cell ?? 0) - (b.cell ?? 0))
        if (allies[0]) this.changePoints(allies[0], -2, events, 'enter')
        return
      }
      case 'deckThick':
        this.changePoints(ctx.source, s.deck.length >= op.ge ? op.plus : -op.minus, events, 'turnStart')
        return
      case 'leaveAdjSwing':
        this.adjSwing(ctx.source, op.enemy, op.ally, events)
        return
      case 'selfMinusThenSpawn':
        this.changePoints(ctx.source, -op.minus, events, 'turnEnd')
        this.spawnAdjacent(ctx.source, op.defId, 1, events)
        return
      case 'timerBlast':
        if (ctx.source.cell) {
          for (const n of ADJACENT[ctx.source.cell]) {
            const t = cardAt(s, n)
            if (t && t.owner !== ctx.source.owner) this.changePoints(t, -op.adj, events, 'timer')
          }
        }
        this.changePoints(ctx.source, -op.self, events, 'timer')
        return
      default:
        return
    }
  }

  private pick(sel: Sel, ctx: FxCtx, one?: boolean): CardInst[] {
    const s = this.state
    const src = ctx.source
    let list: CardInst[] = []
    if (sel === 'self') list = [src]
    else if (sel === 'chosen' && ctx.chosen) list = [ctx.chosen]
    else if (sel === 'chosen2' && ctx.chosen2) list = [ctx.chosen2]
    else if (sel === 'allAllies') list = boardCards(s).filter((c) => c.owner === src.owner)
    else if (sel === 'allEnemies') list = boardCards(s).filter((c) => c.owner !== src.owner)
    else if (sel === 'otherAllies') list = boardCards(s).filter((c) => c.owner === src.owner && c.id !== src.id)
    else if (sel === 'playerAvatar') {
      const av = avatarOf(s)
      if (av) list = [av]
    } else if (sel === 'mirrorOccupant' && src.cell) {
      const m = MIRROR[src.cell]
      const t = m ? cardAt(s, m) : undefined
      if (t && t.owner !== src.owner) list = [t]
    } else if (src.cell && (sel === 'adjacentEnemies' || sel === 'adjacentAllies' || sel === 'adjacent')) {
      list = ADJACENT[src.cell].map((c) => cardAt(s, c)).filter((c): c is CardInst => {
        if (!c) return false
        if (sel === 'adjacent') return true
        if (sel === 'adjacentEnemies') return c.owner !== src.owner
        return c.owner === src.owner
      })
    } else if (sel === 'markedEnemies') {
      list = boardCards(s).filter((c) => c.owner !== src.owner && hasStatus(c, 'marked'))
    }
    list.sort((a, b) => (a.cell ?? 0) - (b.cell ?? 0))
    if (one && list.length) return [list[0]]
    return list
  }

  private amt(n: Amt, ctx: FxCtx, target?: CardInst): number {
    const s = this.state
    if (typeof n === 'number') return n
    if (n === 'discardCount*2') return s.discard.length * 2
    if (n === 'occupyDiscardCount') return s.discard.map((id) => s.cards[id]).filter((c) => c.kind === 'occupy').length
    if (n === 'markedCount') return boardCards(s).filter((c) => c.owner !== ctx.source.owner && hasStatus(c, 'marked')).length
    if (n === 'chosenAdjAllies*2' && target?.cell) {
      return ADJACENT[target.cell].filter((c) => cardAt(s, c)?.owner === ctx.source.owner).length * 2
    }
    if (n === 'sacrificeBaseSum') {
      return ctx.sacrificed.reduce((sum, e) => sum + (isBodyKind(cardDef(e.defId).kind) ? e.basePoints : 0), 0)
    }
    if (n === 'resSpent*2') return ctx.spent * 2
    if (n === 'adjacentEnemiesToSelf' && ctx.source.cell) {
      return ADJACENT[ctx.source.cell].filter((c) => {
        const t = cardAt(s, c)
        return t && t.owner !== ctx.source.owner
      }).length * 2
    }
    if (n === 'halfChosenCurrent' && target) return Math.ceil(currentPoints(s, target) / 2)
    return 0
  }

  private changePoints(card: CardInst, delta: number, events: BattleEvent[], source: PointsSource, cause?: Cause): void {
    if (!delta || isGone(card)) return
    const why = cause ?? this.causeNow()
    if (delta < 0 && hasStatus(card, 'protected')) {
      this.stripStatus(card, 'protected', events, why)
      return
    }
    let d = delta
    let vulnerableBonus = 0
    if (d < 0 && hasStatus(card, 'vulnerable')) {
      vulnerableBonus = Math.ceil(Math.abs(d) * 0.25)
      d -= vulnerableBonus
    }
    const before = currentPoints(this.state, card)
    card.permanent += d
    const after = currentPoints(this.state, card)
    this.lastCurrent.set(card.id, after)
    events.push({
      type: 'battle.pointsChanged',
      card: card.id,
      before,
      after,
      source,
      cause: why,
      vulnerableBonus,
      mapEffect: source === 'map' ? this.state.mapEffect : undefined,
      text: `${cardName(card.defId)} ${before}→${after}。`,
    })
    this.flushPoints(events, 'aura')
  }

  private addStatus(card: CardInst, status: CardInst['statuses'][number], events: BattleEvent[]): void {
    if (status === 'marked' && hasStatus(card, 'marked')) return
    if (hasStatus(card, status) && status !== 'marked') return
    card.statuses.push(status)
    events.push({
      type: 'battle.statusAdded',
      card: card.id,
      status,
      cause: this.causeNow(),
      text: `${cardName(card.defId)}获得${status}。`,
    })
    this.flushPoints(events, 'lock')
  }

  private stripStatus(card: CardInst, status: CardInst['statuses'][number], events: BattleEvent[], cause?: Cause): void {
    if (!hasStatus(card, status)) return
    card.statuses = card.statuses.filter((st) => st !== status)
    events.push({
      type: 'battle.statusRemoved',
      card: card.id,
      status,
      cause: cause ?? this.causeNow(),
      text: `${cardName(card.defId)}失去${status}。`,
    })
    this.flushPoints(events, 'lock')
  }

  private unsealAll(events: BattleEvent[]): void {
    for (const card of Object.values(this.state.cards)) {
      if (hasStatus(card, 'sealed')) this.stripStatus(card, 'sealed', events)
    }
  }

  private removeCard(card: CardInst, to: RemoveTo, reason: RemoveReason, events: BattleEvent[]): void {
    const s = this.state
    if (isGone(card)) return
    const cell = card.cell
    const wasBoard = card.zone === 'board'
    if (cell && s.board[cell] === card.id) s.board[cell] = null
    s.hand = s.hand.filter((id) => id !== card.id)
    const rebirth = wasBoard && hasStatus(card, 'rebirth')
    if (rebirth) {
      card.statuses = card.statuses.filter((st) => st !== 'rebirth')
      events.push({
        type: 'battle.statusRemoved',
        card: card.id,
        status: 'rebirth',
        cause: this.causeNow(),
        text: `${cardName(card.defId)}返魂。`,
      })
    }
    this.lastCurrent.delete(card.id)
    events.push({
      type: 'battle.cardRemoved',
      card: card.id,
      defId: card.defId,
      cell: cell ?? 1,
      to: rebirth ? 'hand' : to,
      reason,
      cause: this.causeNow(),
      text: `${cardName(card.defId)}离场（${reason}）。`,
    })
    if (wasBoard) {
      card.cell = cell
      this.runEffects(card, 'leave', events)
      this.fireLeaveWatchers(card, events)
    }
    card.cell = undefined
    if (isGone(card)) {
      this.flushPoints(events, 'aura')
      if (card.isAvatar) this.settle('lose', 'avatarGone', events)
      else this.checkClear(events)
      return
    }
    if (rebirth) {
      if (card.owner !== 'player' || s.hand.length >= ANCHORS.handCap) {
        card.zone = 'discard'
        if (card.owner === 'player') s.discard.push(card.id)
        else s.enemyDiscard.push(card.id)
      } else {
        card.zone = 'hand'
        s.hand.push(card.id)
      }
    } else if (to === 'gone') {
      card.zone = 'gone'
    } else {
      card.zone = 'discard'
      if (card.owner === 'player') s.discard.push(card.id)
      else s.enemyDiscard.push(card.id)
    }
    this.flushPoints(events, 'aura')
    if (card.linkId && wasBoard) {
      const partner = Object.values(s.cards).find((c) => c.id !== card.id && c.linkId === card.linkId && c.zone === 'board')
      if (partner) {
        partner.linkId = undefined
        card.linkId = undefined
        this.removeCard(partner, 'discard', 'link', events)
      }
    }
    if (card.isAvatar) this.settle('lose', 'avatarGone', events)
    else this.checkClear(events)
  }

  private toDiscard(card: CardInst): void {
    const s = this.state
    s.hand = s.hand.filter((id) => id !== card.id)
    card.zone = 'discard'
    card.cell = undefined
    if (card.owner === 'player') s.discard.push(card.id)
    else s.enemyDiscard.push(card.id)
  }

  private markBurned(card: CardInst): void {
    if (card.boxUid && !this.state.burnedUids.includes(card.boxUid)) this.state.burnedUids.push(card.boxUid)
  }

  private burn(card: CardInst): void {
    const s = this.state
    this.markBurned(card)
    s.hand = s.hand.filter((id) => id !== card.id)
    if (card.cell && s.board[card.cell] === card.id) s.board[card.cell] = null
    card.zone = 'gone'
    card.cell = undefined
  }

  private draw(events: BattleEvent[]): void {
    const s = this.state
    if (s.hand.length >= ANCHORS.handCap) return
    if (!s.deck.length) return
    const entry = s.deck.shift()!
    const inst = this.spawn(entry.defId, 'player', 'hand')
    inst.basePoints = entry.basePoints
    inst.boxUid = entry.boxUid
    s.hand.push(inst.id)
    events.push({
      type: 'battle.cardDrawn',
      card: inst.id,
      defId: entry.defId,
      deckLeft: s.deck.length,
      text: `抽到${cardName(entry.defId)}。`,
    })
    if (inst.defId === 'PC.X01') {
      this.runEffects(inst, 'play', events)
      if (inst.zone === 'hand') this.removeCard(inst, 'discard', 'effect', events)
    }
  }

  private sacrifice(n: number, events: BattleEvent[]): DeckEntry[] {
    const s = this.state
    const taken: DeckEntry[] = []
    for (let i = 0; i < n; i++) {
      if (!s.deck.length) break
      const idx = nextInt(s.rng, s.deck.length)
      const [entry] = s.deck.splice(idx, 1)
      taken.push(entry)
      const inst = this.spawn(entry.defId, 'player', 'discard')
      inst.basePoints = entry.basePoints
      inst.boxUid = entry.boxUid
      s.discard.push(inst.id)
    }
    void events
    return taken
  }

  private spawn(defId: string, owner: Side, zone: CardInst['zone']): CardInst {
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
      isAvatar: def.kind === 'avatar',
      timer: def.timer,
      timerMax: def.timer,
    }
    this.state.cards[id] = inst
    return inst
  }

  private spawnOnto(defId: string, owner: Side, cell: Cell, events: BattleEvent[]): CardInst {
    const inst = this.spawn(defId, owner, 'board')
    inst.cell = cell
    this.state.board[cell] = inst.id
    events.push({
      type: 'battle.cardEntered',
      card: inst.id,
      cell,
      covered: false,
      motion: 'place',
      cause: this.causeNow(),
      text: `${cardName(defId)}生成在格${cell}。`,
    })
    this.lastCurrent.set(inst.id, currentPoints(this.state, inst))
    this.runEffects(inst, 'enter', events)
    this.flushPoints(events, 'enter')
    return inst
  }

  private spawnAdjacent(source: CardInst, defId: string, max: number, events: BattleEvent[]): void {
    if (!source.cell) return
    const empties = ADJACENT[source.cell].filter((c) => !cardAt(this.state, c)).sort((a, b) => a - b)
    for (const cell of empties.slice(0, max)) {
      this.spawnOnto(defId, source.owner, cell, events)
      if (this.state.result) return
    }
  }

  private adjSwing(source: CardInst, enemy: number, ally: number, events: BattleEvent[]): void {
    const cell = source.cell
    if (!cell) {
      // already left; use last known from event? source.cell cleared. skip unless we pass cell
      return
    }
    for (const n of ADJACENT[cell]) {
      const t = cardAt(this.state, n)
      if (!t) continue
      if (t.owner !== source.owner && enemy) this.changePoints(t, enemy, events, 'leave')
      if (t.owner === source.owner && ally) this.changePoints(t, ally, events, 'leave')
    }
  }

  private relocate(card: CardInst, dest: Cell, events: BattleEvent[]): void {
    const s = this.state
    if (!card.cell) return
    const from = card.cell
    if (s.board[from] === card.id) s.board[from] = null
    card.cell = dest
    s.board[dest] = card.id
    events.push({
      type: 'battle.cardEntered',
      card: card.id,
      cell: dest,
      covered: false,
      motion: 'move',
      from,
      cause: this.causeNow(),
      text: `${cardName(card.defId)}移动到格${dest}。`,
    })
    this.flushPoints(events, 'aura')
  }

  private tryCoverMove(card: CardInst, dest: Cell, events: BattleEvent[]): boolean {
    const s = this.state
    if (markedMoveBlocked(s, card)) return false
    const here = cardAt(s, dest)
    if (!here) {
      this.relocate(card, dest, events)
      return true
    }
    if (here.owner === card.owner) return false
    const ap = currentPoints(s, card)
    const vp = currentPoints(s, here)
    if (ap < vp) return false
    events.push({
      type: 'battle.cardCovered',
      victim: here.id,
      by: card.id,
      cell: dest,
      victimPoints: vp,
      tied: ap === vp,
      text: `${cardName(card.defId)}移动覆盖${cardName(here.defId)}。`,
    })
    const from = card.cell
    if (from && s.board[from] === card.id) s.board[from] = null
    if (ap === vp) {
      this.removeCard(here, 'discard', 'tie', events)
      this.removeCard(card, 'discard', 'tie', events)
      return true
    }
    this.removeCard(here, 'discard', 'cover', events)
    if (s.result) return true
    card.permanent -= vp
    card.cell = dest
    s.board[dest] = card.id
    this.runEffects(card, 'onCover', events)
    if (s.mapEffect === 'ME.02') this.changePoints(card, -1, events, 'map')
    this.flushPoints(events, 'cover')
    return true
  }

  private moveTowardAvatar(card: CardInst, events: BattleEvent[], cover: boolean, poke: boolean): void {
    const av = avatarOf(this.state)
    if (!card.cell) return
    if (poke && av?.cell && ADJACENT[card.cell].includes(av.cell)) {
      this.changePoints(av, -1, events, 'turnEnd')
      return
    }
    if (!av?.cell) return
    const dests = ADJACENT[card.cell].filter((c) => {
      const here = cardAt(this.state, c)
      if (cover) return !here || here.owner !== card.owner
      return !here
    })
    const scored = dests.map((c) => ({
      c,
      d: Math.abs(cellCol(c) - cellCol(av.cell!)) + Math.abs(cellRow(c) - cellRow(av.cell!)),
    }))
    const now = Math.abs(cellCol(card.cell) - cellCol(av.cell)) + Math.abs(cellRow(card.cell) - cellRow(av.cell))
    const better = scored.filter((x) => x.d < now).sort((a, b) => a.d - b.d || a.c - b.c)
    if (!better.length) return
    const dest = better[0].c
    if (cover) this.tryCoverMove(card, dest, events)
    else if (!cardAt(this.state, dest) && !markedMoveBlocked(this.state, card)) this.relocate(card, dest, events)
  }

  private moveColumn(card: CardInst, events: BattleEvent[]): void {
    if (!card.cell) return
    const col = cellCol(card.cell)
    const row = cellRow(card.cell)
    const up = row > 0 ? ((row - 1) * 3 + col + 1) as Cell : null
    const down = row < 2 ? ((row + 1) * 3 + col + 1) as Cell : null
    const opts = [up, down].filter((c): c is Cell => c !== null)
    if (!opts.length) return
    const dest = opts[nextInt(this.state.rng, opts.length)]
    this.tryCoverMove(card, dest, events)
  }

  private moveRow(card: CardInst, events: BattleEvent[]): void {
    if (!card.cell) return
    const row = cellRow(card.cell)
    const col = cellCol(card.cell)
    const opts: Cell[] = []
    if (col > 0) opts.push((row * 3 + col) as Cell)
    if (col < 2) opts.push((row * 3 + col + 2) as Cell)
    if (!opts.length) return
    const dest = opts[nextInt(this.state.rng, opts.length)]
    if (cardAt(this.state, dest) || markedMoveBlocked(this.state, card)) return
    this.relocate(card, dest, events)
  }

  private firePlayWatchers(played: CardInst, events: BattleEvent[]): void {
    for (const c of boardCards(this.state)) {
      if (isSealed(c) || c.id === played.id) continue
      if (c.defId === 'PC.N11' && c.owner === played.owner) {
        this.changePoints(c, 1, events, 'play', { actor: c.id, defId: c.defId, timing: 'play', op: 'spellFeed' })
      }
      if (c.defId === 'EC.21' && played.kind === 'spell' && played.owner !== c.owner) {
        const why = { actor: c.id, defId: c.defId, timing: 'play' as const, op: 'spellFeed' }
        this.changePoints(c, 2, events, 'play', why)
        const foes = boardCards(this.state).filter((x) => x.owner !== c.owner)
        if (foes.length) {
          const t = foes[nextInt(this.state.rng, foes.length)]
          this.changePoints(t, -1, events, 'play', why)
        }
      }
    }
  }

  private fireLeaveWatchers(left: CardInst, events: BattleEvent[]): void {
    for (const c of boardCards(this.state)) {
      if (isSealed(c) || c.id === left.id) continue
      if (c.defId === 'PC.B07' && left.kind === 'occupy') {
        this.changePoints(c, 2, events, 'leave', { actor: c.id, defId: c.defId, timing: 'leave', op: 'leaveAdjSwing' })
      }
    }
  }

  private adjustOccupy(dCur: number, dCap: number, events: BattleEvent[], absoluteCap = false, cause?: Cause): void {
    const s = this.state
    if (absoluteCap) {
      s.occupyCap = Math.max(0, s.occupyCap + dCap)
      s.occupy = Math.max(0, s.occupy + dCur)
    } else {
      if (!dCur && !dCap) return
      s.occupyCap = Math.max(0, s.occupyCap + dCap)
      s.occupy = Math.max(0, s.occupy + dCur)
    }
    events.push({
      type: 'battle.occupyChanged',
      current: s.occupy,
      cap: s.occupyCap,
      cause,
      text: `占领费用 ${s.occupy}/${s.occupyCap}。`,
    })
  }

  private addRes(delta: number, events: BattleEvent[]): void {
    this.state.resA = Math.max(0, this.state.resA + delta)
    events.push({
      type: 'battle.resourceChanged',
      resource: 'RES.A',
      current: this.state.resA,
      cause: this.causeNow(),
      text: `RES.A ${this.state.resA}。`,
    })
  }

  private checkClear(events: BattleEvent[]): void {
    if (this.state.result) return
    if (!boardCards(this.state).some((c) => c.owner === 'enemy')) this.settle('win', 'clear', events)
  }

  private checkNoPlay(events: BattleEvent[]): void {
    if (this.state.result || this.state.phase !== 'play') return
    if (this.state.deck.length > 0) return
    const affordable = this.state.hand.some((id) => cardDef(this.state.cards[id].defId).cost <= this.state.occupy)
    if (!affordable) this.settle('lose', 'noPlay', events)
  }

  private settle(outcome: 'win' | 'lose', reason: BattleEvent extends { reason: infer R } ? never : 'lead' | 'clear' | 'avatarGone' | 'noPlay', events: BattleEvent[]): void {
    const s = this.state
    if (s.result) return
    const avatarCost = avatarCostOf(s)
    s.result = { outcome, reason, avatarCost }
    s.phase = 'over'
    events.push({ type: 'battle.phaseChanged', phase: 'over', text: '战斗结束。' })
    const why = reason === 'lead' ? '总点数更大' : reason === 'clear' ? '清场' : reason === 'avatarGone' ? '化身离场' : '无牌可出'
    events.push({
      type: 'battle.settled',
      outcome,
      reason,
      avatarCost,
      text: `${outcome === 'win' ? '胜利' : '失败'}（${why}），化身代价 ${avatarCost}。`,
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
        const auras = auraContributions(this.state, card)
        const map = mapShare(this.state, card)
        events.push({
          type: 'battle.pointsChanged',
          card: card.id,
          before: prev,
          after: now,
          source,
          vulnerableBonus: 0,
          auras: source === 'aura' || auras.length ? auras : undefined,
          mapEffect: source === 'map' ? this.state.mapEffect : map?.id,
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

export function isPlayCell(n: number): n is Cell {
  return isCell(n)
}
