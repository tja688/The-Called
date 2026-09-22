import { ANCHORS } from '../../content/anchors'
import { cardDef, cardName, isNegative } from '../../content/cards'
import { startingDeck } from '../../content/decks'
import { eventDef, eventsForFloor, EVENT_WEIGHT, eventOptionEnabled, eventCardEligible, type EventDef } from '../../content/events'
import { mapEffectsFor } from '../../content/mapEffects'
import { poolFor } from '../../content/encounters'
import { relicDef, relicPool } from '../../content/relics'
import { drawExact, drawOne, drawPlayerCards, recastPool, shopPrice, type DrawRarity } from '../../content/rewards'
import { hashString, nextFloat, pick, seedRng, type RngState } from '../../core/Rng'
import type { BattleResult } from '../battle/state'
import type { Coord, DeckId, NodeType, RunResult, SchoolId, Screen } from '../types'
import { manhattan } from '../types'
import type { RunEvent } from './events'
import { adjacentNodes, generateFloor, revealAround, type MapNode, type ShopStock } from './mapgen'

export interface BoxCard {
  uid: string
  defId: string
  baseBonus: number
}

export interface RunState {
  seed: number
  rng: RngState
  deckId: DeckId
  school: SchoolId
  avatarDefId: string
  avatarBase: number
  hp: number
  hpMax: number
  gold: number
  box: BoxCard[]
  deck: string[]
  relics: string[]
  nextUid: number
  copyBuys: number
  shopDiscount: number
  floor: 1
  floorEffect: string
  player: Coord
  nodes: MapNode[]
  seenEvents: string[]
  screen: Screen
  eventId?: string
  eventChosen?: 0 | 1 | 2
  pendingReward?: string[]
  rewardPicked?: string
  pendingEncounter?: string
  pendingNode?: string
  rewardGold?: number
  flowChosen?: boolean
  ended?: RunResult
}

export interface BattleSetup {
  encounterId: string
  deck: Array<{ defId: string; basePoints: number; boxUid?: string }>
  seed: number
  avatarDefId: string
  avatarBase: number
  mapEffect: string
  relicFirstOccupy: boolean
}

export class RunAggregate {
  readonly state: RunState

  private constructor(state: RunState) {
    this.state = state
  }

  static start(seed: number, deckId: DeckId): { aggregate: RunAggregate; events: RunEvent[] } {
    const start = startingDeck(deckId)
    const rng = seedRng(seed)
    const { nodes, origin } = generateFloor(rng)
    const fx = pick(rng, mapEffectsFor(1)).id
    const box: BoxCard[] = start.cards.map((defId, i) => ({ uid: `b${i + 1}`, defId, baseBonus: 0 }))
    const state: RunState = {
      seed,
      rng,
      deckId,
      school: start.school,
      avatarDefId: start.avatar,
      avatarBase: cardDef(start.avatar).basePoints,
      hp: ANCHORS.hpStart,
      hpMax: ANCHORS.hpMax,
      gold: 0,
      box,
      deck: box.map((c) => c.uid),
      relics: [],
      nextUid: box.length + 1,
      copyBuys: 0,
      shopDiscount: 0,
      floor: 1,
      floorEffect: fx,
      player: origin,
      nodes,
      seenEvents: [],
      screen: 'map',
    }
    revealAround(nodes, origin)
    const events: RunEvent[] = [
      {
        type: 'run.started',
        seed,
        deckId,
        hp: state.hp,
        box: box.map((c) => c.defId),
        deck: box.map((c) => c.defId),
        floorEffect: fx,
        text: `开一趟。${deckId}。种子 ${seed}。${fx}。`,
      },
      { type: 'run.screen', screen: 'map', text: '回到地图。' },
    ]
    return { aggregate: new RunAggregate(state), events }
  }

  static fromState(state: RunState): RunAggregate {
    return new RunAggregate(structuredClone(state))
  }

  availableNodes(): string[] {
    if (this.state.ended || this.state.screen !== 'map') return []
    const ids = adjacentNodes(this.state.nodes, this.state.player).map((n) => n.id)
    const here = this.state.nodes.find((n) => n.x === this.state.player.x && n.y === this.state.player.y)
    if (here && !ids.includes(here.id)) ids.unshift(here.id)
    return ids
  }

  nodeById(id: string): MapNode | undefined {
    return this.state.nodes.find((n) => n.id === id)
  }

  abandon(): RunEvent[] {
    if (this.state.ended) throw new Error('这趟已经结束')
    return this.end('defeat', '放弃')
  }

  enterNode(nodeId: string): RunEvent[] {
    const s = this.state
    if (s.ended) throw new Error('这趟已经结束')
    if (s.screen !== 'map') throw new Error('只能在地图上进入节点')
    const node = this.nodeById(nodeId)
    if (!node) throw new Error('没有这个节点')
    if (!this.availableNodes().includes(nodeId)) throw new Error('只能走正交相邻')
    s.player = { x: node.x, y: node.y }
    node.visited = true
    revealAround(s.nodes, s.player)
    const events: RunEvent[] = []

    if (node.type === 'nextFloor') return events.concat(this.end('victory', '下层'))

    const reenter = node.type === 'shop' || ((node.type === 'normal' || node.type === 'elite') && (node.lost || !node.completed))
    if (node.completed && !reenter) return events

    if (node.type === 'normal' || node.type === 'elite' || node.type === 'boss') return events.concat(this.enterBattle(node))
    if (node.type === 'event') return events.concat(this.enterEvent(node))
    if (node.type === 'shop') return events.concat(this.enterShop(node))
    if (node.type === 'rest') {
      s.screen = 'rest'
      s.pendingNode = node.id
      s.flowChosen = false
      events.push({ type: 'run.screen', screen: 'rest', text: '疗养地。' })
      return events
    }
    if (node.type === 'forge') {
      s.screen = 'forge'
      s.pendingNode = node.id
      s.flowChosen = false
      events.push({ type: 'run.screen', screen: 'forge', text: '锻造地。' })
      return events
    }
    if (node.type === 'chest') return events.concat(this.openChest(node))
    return events
  }

  battleSetup(): BattleSetup {
    const s = this.state
    if (!s.pendingEncounter) throw new Error('没有排队的战斗')
    return {
      encounterId: s.pendingEncounter,
      deck: s.deck.map((uid) => {
        if (uid === 'PC.N04' || uid.startsWith('N04')) return { defId: 'PC.N04', basePoints: cardDef('PC.N04').basePoints }
        const box = s.box.find((c) => c.uid === uid)
        if (!box) return { defId: 'PC.N04', basePoints: 1 }
        return { defId: box.defId, basePoints: cardDef(box.defId).basePoints + box.baseBonus, boxUid: box.uid }
      }),
      seed: hashString(`${s.seed}:battle:${s.pendingEncounter}:${s.pendingNode}:${s.hp}:${s.gold}`),
      avatarDefId: s.avatarDefId,
      avatarBase: s.avatarBase,
      mapEffect: s.floorEffect,
      relicFirstOccupy: s.relics.includes('RL.01'),
    }
  }

  setDeck(deck: string[]): RunEvent[] {
    const s = this.state
    if (s.ended) throw new Error('这趟已经结束')
    if (s.screen !== 'map') throw new Error('只能在地图上改牌组')
    if (deck.length < ANCHORS.deckMin) throw new Error('牌组下限 10 张')
    const uids = deck.filter((id) => id !== 'PC.N04' && !id.startsWith('N04'))
    const uniq = new Set(uids)
    if (uniq.size !== uids.length) throw new Error('卡盒条目不能重复编入')
    for (const uid of uids) {
      if (!s.box.some((c) => c.uid === uid)) throw new Error('牌组超出卡盒')
    }
    for (const card of s.box) {
      if (isNegative(card.defId) && s.deck.includes(card.uid) && !deck.includes(card.uid)) {
        throw new Error('负面卡不能从牌组拿掉')
      }
    }
    s.deck = [...deck]
    return [{ type: 'run.deckChanged', deck: this.deckDefIds(), text: `牌组改为 ${s.deck.length} 张。` }]
  }

  eventOption(index: 0 | 1 | 2, cardUid?: string, cardUid2?: string): RunEvent[] {
    const s = this.state
    if (s.screen !== 'event' || !s.eventId) throw new Error('现在不是事件')
    if (s.eventChosen !== undefined) throw new Error('已经选过了')
    const ev = eventDef(s.eventId)
    const opt = ev.options[index]
    if (!opt) throw new Error('没有这个选项')
    if (!this.optionEnabled(ev, opt.index)) throw new Error('选项条件不满足')
    if (opt.needsCard) {
      if (!cardUid) throw new Error('必须指定卡盒里的卡')
      const picked = s.box.find((c) => c.uid === cardUid)
      if (!picked || !eventCardEligible(ev, index, picked.defId)) throw new Error('不能选这张卡')
    }
    if (opt.needsCard2) {
      if (!cardUid2) throw new Error('必须指定第二张卡')
      const picked2 = s.box.find((c) => c.uid === cardUid2)
      if (!picked2 || picked2.uid === cardUid || !eventCardEligible(ev, index, picked2.defId)) throw new Error('不能选这张卡')
    }
    s.eventChosen = index
    return this.applyEvent(ev, index, cardUid, cardUid2)
  }

  rewardPick(cardId: string): RunEvent[] {
    const s = this.state
    if (s.screen !== 'reward') throw new Error('现在不是奖励')
    if (s.rewardPicked) throw new Error('已经选过了')
    if (!s.pendingReward?.includes(cardId)) throw new Error('不在奖励池里')
    s.rewardPicked = cardId
    return this.addToBox(cardId)
  }

  shopBuyCard(index: number): RunEvent[] {
    const s = this.state
    const node = this.needNode('shop')
    const offer = node.shop?.offers[index]
    if (!offer) throw new Error('没有这张陈列卡')
    const price = this.discounted(offer.price)
    if (s.gold < price) throw new Error('金币不够')
    const events = this.payGold(price, 'shop')
    node.shop!.offers.splice(index, 1)
    return events.concat(this.addToBox(offer.defId))
  }

  shopCopy(uid: string): RunEvent[] {
    const s = this.state
    this.needNode('shop')
    const card = s.box.find((c) => c.uid === uid)
    if (!card) throw new Error('卡盒里没有这张')
    if (card.defId.startsWith('PC.') && cardDef(card.defId).kind === 'avatar') throw new Error('化身不能复制')
    const price = this.discounted(ANCHORS.shopCopyFirst + s.copyBuys * ANCHORS.shopCopyStep)
    if (s.gold < price) throw new Error('金币不够')
    const events = this.payGold(price, 'copy')
    s.copyBuys += 1
    return events.concat(this.addToBox(card.defId, card.baseBonus))
  }

  shopBuyRelic(): RunEvent[] {
    const s = this.state
    const node = this.needNode('shop')
    if (!node.shop?.relicId || node.shop.relicSold) throw new Error('没有可买的遗物')
    const price = this.discounted(node.shop.relicPrice ?? relicDef(node.shop.relicId).price)
    if (s.gold < price) throw new Error('金币不够')
    const events = this.payGold(price, 'shop')
    events.push(...this.gainRelic(node.shop.relicId))
    node.shop.relicSold = true
    return events
  }

  restPick(choice: 'heal' | 'grow'): RunEvent[] {
    const s = this.state
    if (s.screen !== 'rest') throw new Error('现在不是疗养')
    const events: RunEvent[] = []
    if (s.flowChosen) throw new Error('已经选过了')
    if (choice === 'heal') {
      const add = Math.ceil(s.hpMax * ANCHORS.restHealPct)
      events.push(...this.changeHp(add, 'rest'))
    } else {
      s.avatarBase += 2
      s.hpMax += 2
      events.push(...this.changeHp(0, 'rest-grow'))
    }
    s.flowChosen = true
    return events
  }

  forgeBuff(uid: string): RunEvent[] {
    const s = this.state
    if (s.screen !== 'forge') throw new Error('现在不是锻造')
    const card = s.box.find((c) => c.uid === uid)
    if (!card) throw new Error('卡盒里没有这张')
    if (s.flowChosen) throw new Error('已经选过了')
    card.baseBonus += 2
    s.flowChosen = true
    return [{ type: 'run.deckChanged', deck: this.deckDefIds(), text: `${cardName(card.defId)} 基础点 +2。` }]
  }

  forgeRecast(uid: string): RunEvent[] {
    const s = this.state
    if (s.screen !== 'forge') throw new Error('现在不是锻造')
    const card = s.box.find((c) => c.uid === uid)
    if (!card) throw new Error('卡盒里没有这张')
    if (s.flowChosen) throw new Error('已经选过了')
    const rarity = cardDef(card.defId).rarity
    if (rarity === 'basic') throw new Error('基础卡不能重铸')
    const pool = recastPool(rarity, card.defId)
    if (!pool.length) throw new Error('没有可重铸的卡')
    const next = pick(s.rng, pool)
    const old = card.defId
    card.defId = next
    card.baseBonus = 0
    s.flowChosen = true
    return [
      { type: 'run.cardUnboxed', cardId: old, uid, text: `重铸走了${cardName(old)}。` },
      { type: 'run.cardBoxed', cardId: next, uid, text: `重铸成${cardName(next)}。` },
    ]
  }

  applyBattleResult(result: BattleResult, extra?: { goldDelta?: number; burnedUids?: string[] }): RunEvent[] {
    const s = this.state
    if (s.screen !== 'battle' || !s.pendingEncounter || !s.pendingNode) throw new Error('没有进行中的战斗')
    const node = this.nodeById(s.pendingNode)!
    const events: RunEvent[] = []
    if (extra?.burnedUids?.length) {
      for (const uid of extra.burnedUids) this.removeBoxUid(uid, events)
    }
    if (extra?.goldDelta) events.push(...this.payGold(-extra.goldDelta, 'card'))

    const encounter = s.pendingEncounter
    const boss = node.type === 'boss'
    events.push(...this.changeHp(-result.avatarCost, result.outcome === 'lose' ? result.reason : 'avatarCost'))
    if (s.hp <= 0) return events.concat(this.end('defeat', '血条归零'))

    if (result.outcome === 'lose') {
      if (boss) return events.concat(this.end('defeat', result.reason === 'avatarGone' ? 'BOSS 化身离场' : 'BOSS 无牌可出'))
      node.lost = true
      node.monsterId = undefined
      s.pendingEncounter = undefined
      s.pendingNode = undefined
      s.screen = 'map'
      events.push({ type: 'run.screen', screen: 'map', text: '战败回地图，可再进。' })
      return events
    }

    node.lost = false
    node.completed = true
    const gold = node.type === 'normal' ? ANCHORS.goldNormal : node.type === 'elite' ? ANCHORS.goldElite : ANCHORS.goldBoss
    events.push(...this.payGold(-gold, 'battle'))
    s.pendingEncounter = undefined

    if (node.type === 'boss') {
      this.spawnNextFloor(node)
      s.pendingNode = undefined
      s.screen = 'map'
      events.push({ type: 'run.screen', screen: 'map', text: 'BOSS 已退。下层已出现。' })
      return events
    }

    const pool = drawPlayerCards(s.rng, s.school, 3)
    s.pendingReward = pool
    s.rewardPicked = undefined
    s.rewardGold = node.type === 'elite' ? 0 : 0
    s.screen = 'reward'
    if (node.type === 'elite') events.push(...this.grantRelicOrGold())
    events.push({
      type: 'run.rewardOffered',
      pool: [...pool],
      gold,
      text: `奖励：${pool.map(cardName).join('、')}，${gold} 金。`,
    })
    events.push({ type: 'run.screen', screen: 'reward', text: '选择奖励。' })
    return events
  }

  returnToMap(): RunEvent[] {
    const s = this.state
    if (s.ended) throw new Error('这趟已经结束')
    if (s.screen === 'event') {
      if (s.eventChosen === undefined) throw new Error('还没选事件')
      this.finishNode()
      return this.toMap()
    }
    if (s.screen === 'reward') {
      if (!s.rewardPicked && (s.pendingReward?.length ?? 0) > 0) throw new Error('还没选奖励')
      s.pendingReward = undefined
      s.rewardPicked = undefined
      this.finishNode()
      return this.toMap()
    }
    if (s.screen === 'shop') {
      s.shopDiscount = 0
      s.pendingNode = undefined
      return this.toMap()
    }
    if (s.screen === 'rest' || s.screen === 'forge') {
      if (!s.flowChosen) throw new Error('还没选')
      this.finishNode()
      s.flowChosen = undefined
      return this.toMap()
    }
    if (s.screen === 'chest') {
      this.finishNode()
      return this.toMap()
    }
    throw new Error('现在不能回地图')
  }

  private enterBattle(node: MapNode): RunEvent[] {
    const s = this.state
    const tier = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : 'normal'
    if (!node.monsterId || node.lost) {
      const pool = poolFor(tier, 1)
      node.monsterId = pick(s.rng, pool).id
    }
    s.pendingEncounter = node.monsterId
    s.pendingNode = node.id
    s.screen = 'battle'
    return [
      { type: 'run.battleQueued', encounterId: node.monsterId, node: node.id, text: `遭遇${node.monsterId}。` },
      { type: 'run.screen', screen: 'battle', text: '进入战斗。' },
    ]
  }

  private enterEvent(node: MapNode): RunEvent[] {
    const s = this.state
    const ev = this.drawEvent()
    node.eventId = ev.id
    if (ev.id !== 'EV.EMPTY') s.seenEvents.push(ev.id)
    s.eventId = ev.id
    s.eventChosen = undefined
    s.pendingNode = node.id
    s.screen = 'event'
    return [
      { type: 'run.eventOffered', eventId: ev.id, text: `${ev.name}。` },
      { type: 'run.screen', screen: 'event', text: '事件。' },
    ]
  }

  private drawEvent(): EventDef {
    const s = this.state
    const pool = eventsForFloor(1).filter((e) =>
      !s.seenEvents.includes(e.id)
      && (!e.needNegative || s.box.some((c) => isNegative(c.defId)))
      && e.options.some((o) => eventOptionEnabled(e, o.index, s)),
    )
    if (!pool.length) return eventDef('EV.EMPTY')
    const weighted: EventDef[] = []
    for (const e of pool) {
      for (let i = 0; i < EVENT_WEIGHT[e.weight]; i++) weighted.push(e)
    }
    return pick(s.rng, weighted)
  }

  optionEnabled(ev: EventDef, index: number): boolean {
    return eventOptionEnabled(ev, index, this.state)
  }

  private applyEvent(ev: EventDef, index: number, uid?: string, uid2?: string): RunEvent[] {
    const s = this.state
    const events: RunEvent[] = []
    const card = uid ? s.box.find((c) => c.uid === uid) : undefined
    const card2 = uid2 ? s.box.find((c) => c.uid === uid2) : undefined

    if (ev.id === 'EV.01' && index === 0) events.push(...this.payGold(-30, 'event'))
    else if (ev.id === 'EV.01' && index === 1) {
      events.push(...this.grantRelicOrGold())
      events.push(...this.changeHp(-4, 'event'))
    } else if (ev.id === 'EV.02' && index === 0) {
      events.push(...this.changeHp(Math.ceil(s.hpMax * 0.3), 'event'))
    } else if (ev.id === 'EV.02' && index === 1) {
      if (nextFloat(s.rng) < 0.5) events.push(...this.payGold(-80, 'event'))
      else events.push(...this.changeHp(-6, 'event'))
    } else if (ev.id === 'EV.03' && index === 0) {
      events.push(...this.changeHp(-2, 'event'))
      events.push(...this.grantRandomCard())
    } else if (ev.id === 'EV.03' && index === 1) {
      events.push(...this.grantRandomCard())
      events.push(...this.addToBox(nextFloat(s.rng) < 0.5 ? 'PC.X01' : 'PC.X02'))
    } else if (ev.id === 'EV.04' && index === 0 && card && !isNegative(card.defId)) {
      this.removeBoxUid(card.uid, events)
    } else if (ev.id === 'EV.04' && index === 1 && card) {
      card.baseBonus += 1
      events.push(...this.addToBox(card.defId, card.baseBonus))
    } else if (ev.id === 'EV.05' && index === 0) {
      const gold = drawExact(s.rng, s.school, 'gold', new Set(), { schoolOnly: true })
      if (gold) events.push(...this.addToBox(gold))
      events.push(...this.addToBox('PC.X02'))
    } else if (ev.id === 'EV.05' && index === 1) {
      const blue = drawExact(s.rng, s.school, 'blue', new Set(), { schoolOnly: true })
      if (blue) events.push(...this.addToBox(blue))
    } else if (ev.id === 'EV.06' && index === 0 && card && !isNegative(card.defId)) {
      const r = cardDef(card.defId).rarity
      const gold = r === 'gold' ? 45 : r === 'blue' ? 25 : 15
      this.removeBoxUid(card.uid, events)
      events.push(...this.payGold(-gold, 'event'))
    } else if (ev.id === 'EV.06' && index === 1 && card) {
      events.push(...this.payGold(40, 'event'))
      card.baseBonus += 3
    } else if (ev.id === 'EV.07' && card) {
      if (index === 0 && cardDef(card.defId).rarity === 'white' && !isNegative(card.defId)) {
        events.push(...this.addToBox(card.defId, card.baseBonus))
        events.push(...this.addToBox(card.defId, card.baseBonus))
      } else if (index === 1 && cardDef(card.defId).rarity === 'blue') {
        events.push(...this.addToBox(card.defId, card.baseBonus))
      } else if (index === 2 && cardDef(card.defId).rarity === 'gold') {
        events.push(...this.changeHp(-5, 'event'))
        events.push(...this.addToBox(card.defId, card.baseBonus))
      }
    } else if (ev.id === 'EV.09' && index === 0) {
      const taken = new Set<string>()
      const blues: string[] = []
      for (let i = 0; i < 3; i++) {
        const id = drawExact(s.rng, s.school, 'blue', taken, { schoolOnly: true })
        if (!id) break
        blues.push(id)
        taken.add(id)
      }
      if (!blues.length) return events
      s.pendingReward = blues
      s.rewardPicked = undefined
      s.rewardGold = 0
      s.screen = 'reward'
      events.push({ type: 'run.rewardOffered', pool: [...blues], gold: 0, text: '挑选一张本体系蓝卡。' })
      events.push({ type: 'run.screen', screen: 'reward', text: '选择奖励。' })
      return events
    } else if (ev.id === 'EV.09' && index === 1) {
      events.push(...this.payGold(-15, 'event'))
      const taken = new Set<string>()
      const pool: string[] = []
      for (let i = 0; i < 3; i++) {
        const id = drawOne(s.rng, s.school, taken, { neutralsOnly: true })
        if (!id) break
        pool.push(id)
        taken.add(id)
      }
      if (!pool.length) return events
      s.pendingReward = pool
      s.rewardPicked = undefined
      s.rewardGold = 15
      s.screen = 'reward'
      events.push({ type: 'run.rewardOffered', pool: [...pool], gold: 15, text: '挑选一张中立卡。' })
      events.push({ type: 'run.screen', screen: 'reward', text: '选择奖励。' })
      return events
    } else if (ev.id === 'EV.10') {
      const negs = s.box.filter((c) => isNegative(c.defId))
      if (index === 0) {
        events.push(...this.changeHp(-3 * negs.length, 'event'))
        for (const c of negs) this.removeBoxUid(c.uid, events)
      } else if (index === 1) {
        events.push(...this.payGold(25 * negs.length, 'event'))
        for (const c of negs) this.removeBoxUid(c.uid, events)
      } else {
        events.push(...this.payGold(-20 * negs.length, 'event'))
      }
    } else if (ev.id === 'EV.11' && index === 0) {
      events.push(...this.payGold(30, 'event'))
      if (nextFloat(s.rng) < 0.5) {
        const gold = drawExact(s.rng, s.school, 'gold', new Set(), { schoolOnly: true })
        if (gold) events.push(...this.addToBox(gold))
      } else events.push(...this.addToBox('PC.X01'))
    } else if (ev.id === 'EV.14' && index === 0) events.push(...this.changeHp(8, 'event'))
    else if (ev.id === 'EV.14' && index === 1 && card) {
      events.push(...this.changeHp(-4, 'event'))
      card.baseBonus += 2
    } else if (ev.id === 'EV.14' && index === 2 && card && card2 && card.uid !== card2.uid) {
      events.push(...this.changeHp(-8, 'event'))
      card.baseBonus += 2
      card2.baseBonus += 2
    } else if (ev.id === 'EV.15' && index === 0) events.push(...this.payGold(-45, 'event'))
    else if (ev.id === 'EV.15' && index === 1) events.push(...this.grantRelicOrGold())
    else if (ev.id === 'EV.15' && index === 2) s.shopDiscount = 0.3
    else if (ev.id === 'EV.17' && index === 0 && card && ['blue', 'gold'].includes(cardDef(card.defId).rarity)) {
      this.removeBoxUid(card.uid, events)
      const a = drawExact(s.rng, s.school, 'white')
      const b = drawExact(s.rng, s.school, 'white', a ? new Set([a]) : new Set())
      if (a) events.push(...this.addToBox(a))
      if (b) events.push(...this.addToBox(b))
      events.push(...this.payGold(-20, 'event'))
    } else if (ev.id === 'EV.17' && index === 1 && card && card2) {
      this.removeBoxUid(card.uid, events)
      this.removeBoxUid(card2.uid, events)
      const blue = drawExact(s.rng, s.school, 'blue', new Set(), { schoolOnly: true })
      if (blue) events.push(...this.addToBox(blue))
    } else if (ev.id === 'EV.EMPTY') {
      events.push(...this.payGold(-ANCHORS.goldFallback, 'event'))
    }

    events.push({ type: 'run.eventOffered', eventId: ev.id, text: `选了「${ev.options[index].label}」。` })
    if (s.hp <= 0) return events.concat(this.end('defeat', '血条归零'))
    return events
  }

  private enterShop(node: MapNode): RunEvent[] {
    const s = this.state
    if (!node.shop) node.shop = this.rollShop()
    s.pendingNode = node.id
    s.screen = 'shop'
    return [
      {
        type: 'run.shopOffered',
        cards: node.shop.offers.map((o) => o.defId),
        relicId: node.shop.relicSold ? undefined : node.shop.relicId,
        text: '商店开张。',
      },
      { type: 'run.screen', screen: 'shop', text: '商店。' },
    ]
  }

  private rollShop(): ShopStock {
    const s = this.state
    const offers = []
    const taken = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const id = drawOne(s.rng, s.school, taken)
      if (!id) break
      taken.add(id)
      const rarity = cardDef(id).rarity as DrawRarity
      offers.push({ defId: id, price: shopPrice(s.rng, rarity) })
    }
    const available = relicPool().filter((r) => !s.relics.includes(r.id))
    const relic = available.length ? pick(s.rng, available) : undefined
    return { offers, relicId: relic?.id, relicPrice: relic?.price }
  }

  private openChest(node: MapNode): RunEvent[] {
    const s = this.state
    s.pendingNode = node.id
    s.screen = 'chest'
    const events: RunEvent[] = this.grantRelicOrGold()
    events.push({ type: 'run.screen', screen: 'chest', text: '宝箱。' })
    node.completed = true
    return events
  }

  private spawnNextFloor(boss: MapNode): void {
    const s = this.state
    const empties = [
      { x: boss.x, y: boss.y - 1 },
      { x: boss.x + 1, y: boss.y },
      { x: boss.x, y: boss.y + 1 },
      { x: boss.x - 1, y: boss.y },
    ].filter((p) => !s.nodes.some((n) => n.x === p.x && n.y === p.y) && !(p.x === 0 && p.y === 0))
    const pos = empties.length ? pick(s.rng, empties) : { x: boss.x, y: boss.y }
    s.nodes.push({
      id: 'next',
      type: 'nextFloor',
      x: pos.x,
      y: pos.y,
      visited: false,
      completed: false,
      lost: false,
      revealed: manhattan(pos, s.player) <= 1,
    })
    revealAround(s.nodes, s.player)
  }

  private grantRandomCard(): RunEvent[] {
    const id = drawOne(this.state.rng, this.state.school, new Set())
    return id ? this.addToBox(id) : []
  }

  private grantRelicOrGold(): RunEvent[] {
    const s = this.state
    const pool = relicPool().filter((r) => !s.relics.includes(r.id))
    if (!pool.length) return this.payGold(-ANCHORS.goldFallback, 'relic-fallback')
    return this.gainRelic(pick(s.rng, pool).id)
  }

  private gainRelic(id: string): RunEvent[] {
    const s = this.state
    if (s.relics.includes(id)) return this.payGold(-ANCHORS.goldFallback, 'relic-fallback')
    s.relics.push(id)
    return [{ type: 'run.relicGained', relicId: id, text: `获得${id}。` }]
  }

  private addToBox(defId: string, baseBonus = 0): RunEvent[] {
    const s = this.state
    const uid = `b${s.nextUid++}`
    s.box.push({ uid, defId, baseBonus })
    if (isNegative(defId) && !s.deck.includes(uid)) s.deck.push(uid)
    this.repairDeck()
    return [{ type: 'run.cardBoxed', cardId: defId, uid, text: `卡盒加入${cardName(defId)}。` }]
  }

  private removeBoxUid(uid: string, events: RunEvent[]): void {
    const s = this.state
    const card = s.box.find((c) => c.uid === uid)
    if (!card) return
    s.box = s.box.filter((c) => c.uid !== uid)
    s.deck = s.deck.filter((id) => id !== uid)
    this.repairDeck()
    events.push({ type: 'run.cardUnboxed', cardId: card.defId, uid, text: `卡盒移除${cardName(card.defId)}。` })
  }

  private repairDeck(): void {
    const s = this.state
    s.deck = s.deck.filter((id) => id === 'PC.N04' || id.startsWith('N04') || s.box.some((c) => c.uid === id))
    while (s.deck.length < ANCHORS.deckMin) s.deck.push('PC.N04')
  }

  private changeHp(delta: number, reason: string): RunEvent[] {
    const s = this.state
    const before = s.hp
    s.hp = Math.max(0, Math.min(s.hpMax, s.hp + delta))
    if (before === s.hp && reason !== 'rest-grow') return []
    return [{ type: 'run.hpChanged', before, after: s.hp, reason, text: `血 ${before}→${s.hp}。` }]
  }

  private payGold(amount: number, reason: string): RunEvent[] {
    const s = this.state
    const before = s.gold
    s.gold = Math.max(0, s.gold - amount)
    return [{ type: 'run.goldChanged', before, after: s.gold, reason, text: `金币 ${before}→${s.gold}。` }]
  }

  private discounted(price: number): number {
    return Math.max(1, Math.round(price * (1 - this.state.shopDiscount)))
  }

  private needNode(type: NodeType): MapNode {
    const s = this.state
    if (s.screen !== type) throw new Error(`现在不是${type}`)
    const node = s.pendingNode ? this.nodeById(s.pendingNode) : undefined
    if (!node) throw new Error('没有当前节点')
    return node
  }

  private finishNode(): void {
    const s = this.state
    const node = s.pendingNode ? this.nodeById(s.pendingNode) : undefined
    if (node && node.type !== 'shop') node.completed = true
    s.pendingNode = undefined
    s.eventId = undefined
    s.eventChosen = undefined
  }

  private toMap(): RunEvent[] {
    this.state.screen = 'map'
    return [{ type: 'run.screen', screen: 'map', text: '回到地图。' }]
  }

  private end(result: RunResult, why: string): RunEvent[] {
    const s = this.state
    s.ended = result
    s.screen = 'over'
    s.pendingEncounter = undefined
    return [
      { type: 'run.ended', result, text: `${result === 'victory' ? '通关' : '失败'}（${why}）。` },
      { type: 'run.screen', screen: 'over', text: '结束。' },
    ]
  }

  private deckDefIds(): string[] {
    return this.state.deck.map((id) => {
      if (id === 'PC.N04' || id.startsWith('N04')) return 'PC.N04'
      return this.state.box.find((c) => c.uid === id)?.defId ?? 'PC.N04'
    })
  }
}
