import { ANCHORS } from '../../content/anchors'
import { cardName, ECHO_DECK } from '../../content/cards'
import { DRAWER_EVENT } from '../../content/events'
import { rewardPool } from '../../content/rewards'
import { hashString, seedRng, shuffle, type RngState } from '../../core/Rng'
import type { EncounterId, NodeId, RunResult, Screen } from '../types'
import { NODE_ENCOUNTER, NODE_LABEL, NODES } from '../types'
import type { BattleResult } from '../battle/state'
import type { RunEvent } from './events'

export interface RunState {
  seed: number
  rng: RngState
  hp: number
  hpMax: number
  box: string[]
  deck: string[]
  screen: Screen
  progress: number
  attempt: number
  extraDraw: number
  obtainedRewards: string[]
  eventChosen?: 0 | 1 | 2
  rewardPicked?: string
  pendingReward?: string[]
  pendingEncounter?: EncounterId
  ended?: RunResult
}

export interface BattleSetup {
  encounterId: EncounterId
  deck: string[]
  seed: number
  handDelta: number
}

function counts(ids: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
  return m
}

function deckFitsBox(deck: string[], box: string[]): boolean {
  const have = counts(box)
  const want = counts(deck)
  for (const [id, n] of want) if ((have.get(id) ?? 0) < n) return false
  return true
}

export class RunAggregate {
  readonly state: RunState

  private constructor(state: RunState) {
    this.state = state
  }

  static start(seed: number): { aggregate: RunAggregate; events: RunEvent[] } {
    const box = [...ECHO_DECK]
    const deck = [...ECHO_DECK]
    const state: RunState = {
      seed,
      rng: seedRng(seed),
      hp: ANCHORS.hpStart,
      hpMax: ANCHORS.hpMax,
      box,
      deck,
      screen: 'map',
      progress: 0,
      attempt: 0,
      extraDraw: 0,
      obtainedRewards: [],
    }
    const agg = new RunAggregate(state)
    const events: RunEvent[] = [
      {
        type: 'run.started',
        seed,
        hp: state.hp,
        box: [...box],
        deck: [...deck],
        text: `开一趟。种子 ${seed}。残响 ${deck.length} 张，血 ${state.hp}。`,
      },
      { type: 'run.screen', screen: 'map', text: '回到地图。' },
    ]
    return { aggregate: agg, events }
  }

  static fromState(state: RunState): RunAggregate {
    return new RunAggregate(structuredClone(state))
  }

  availableNodes(): NodeId[] {
    if (this.state.ended || this.state.screen !== 'map') return []
    const node = NODES[this.state.progress]
    return node ? [node] : []
  }

  abandon(): RunEvent[] {
    if (this.state.ended) throw new Error('这趟已经结束')
    return this.end('defeat', '放弃')
  }

  enterNode(node: NodeId): RunEvent[] {
    const s = this.state
    if (s.ended) throw new Error('这趟已经结束')
    if (s.screen !== 'map') throw new Error('只能在地图上进入节点')
    if (this.availableNodes()[0] !== node) throw new Error('不能跳过节点')
    const events: RunEvent[] = []
    if (node === 'drawer') {
      s.screen = 'event'
      s.eventChosen = undefined
      events.push({ type: 'run.eventOffered', eventId: DRAWER_EVENT.id, text: `${DRAWER_EVENT.name}：三选一。` })
      events.push({ type: 'run.screen', screen: 'event', text: '事件。' })
      return events
    }
    const encounterId = NODE_ENCOUNTER[node]
    if (!encounterId) throw new Error(`节点 ${node} 不是战斗`)
    s.attempt += 1
    s.pendingEncounter = encounterId
    s.screen = 'battle'
    events.push({ type: 'run.battleQueued', encounterId, text: `遭遇${NODE_LABEL[node]}。` })
    events.push({ type: 'run.screen', screen: 'battle', text: '进入战斗。' })
    return events
  }

  battleSetup(): BattleSetup {
    const s = this.state
    if (!s.pendingEncounter) throw new Error('没有排队的战斗')
    const handDelta = s.pendingEncounter === 'boShou' ? s.extraDraw : 0
    if (s.pendingEncounter === 'boShou') s.extraDraw = 0
    return {
      encounterId: s.pendingEncounter,
      deck: [...s.deck],
      seed: hashString(`${s.seed}:battle:${s.pendingEncounter}:${s.attempt}`),
      handDelta,
    }
  }

  setDeck(deck: string[]): RunEvent[] {
    const s = this.state
    if (s.ended) throw new Error('这趟已经结束')
    if (s.screen !== 'map') throw new Error('只能在地图上改牌组')
    if (deck.length < 1) throw new Error('牌组至少 1 张')
    if (!deckFitsBox(deck, s.box)) throw new Error('牌组超出卡盒')
    s.deck = [...deck]
    return [{ type: 'run.deckChanged', deck: [...s.deck], text: `牌组改为 ${s.deck.length} 张。` }]
  }

  eventOption(index: 0 | 1 | 2): RunEvent[] {
    const s = this.state
    if (s.screen !== 'event') throw new Error('现在不是事件')
    if (s.eventChosen !== undefined) throw new Error('已经选过了')
    const opt = DRAWER_EVENT.options[index]
    if (!opt) throw new Error('没有这个选项')
    s.eventChosen = index
    const events: RunEvent[] = []
    if (index === 0) {
      s.box.push('EV01')
      events.push({ type: 'run.cardBoxed', cardId: 'EV01', text: `卡盒加入${cardName('EV01')}。` })
    } else if (index === 1) {
      const before = s.hp
      s.hp = Math.min(s.hpMax, s.hp + ANCHORS.bandage)
      events.push({
        type: 'run.hpChanged',
        before,
        after: s.hp,
        reason: 'bandage',
        text: `包扎 ${before}→${s.hp}。`,
      })
    } else {
      s.extraDraw = 1
    }
    events.push({ type: 'run.eventOffered', eventId: DRAWER_EVENT.id, text: `选了「${opt.label}」。` })
    return events
  }

  rewardPick(cardId: string): RunEvent[] {
    const s = this.state
    if (s.screen !== 'reward') throw new Error('现在不是奖励')
    if (s.rewardPicked) throw new Error('已经选过了')
    if (!s.pendingReward?.includes(cardId)) throw new Error('不在奖励池里')
    s.rewardPicked = cardId
    s.box.push(cardId)
    s.obtainedRewards.push(cardId)
    return [{ type: 'run.cardBoxed', cardId, text: `卡盒加入${cardName(cardId)}。` }]
  }

  applyBattleResult(result: BattleResult): RunEvent[] {
    const s = this.state
    if (s.screen !== 'battle' || !s.pendingEncounter) throw new Error('没有进行中的战斗')
    const encounterId = s.pendingEncounter
    const events: RunEvent[] = []
    if (result.outcome === 'lose' && encounterId === 'shouMen') {
      s.pendingEncounter = undefined
      return events.concat(this.end('defeat', '守门失败'))
    }
    const before = s.hp
    const delta = result.outcome === 'lose' ? ANCHORS.loseHp : result.wound
    s.hp = Math.max(0, s.hp - delta)
    events.push({
      type: 'run.hpChanged',
      before,
      after: s.hp,
      reason: result.outcome === 'lose' ? result.reason : 'wound',
      text: `血 ${before}→${s.hp}。`,
    })
    s.pendingEncounter = undefined
    if (s.hp <= 0) return events.concat(this.end('defeat', '血条归零'))
    if (result.outcome === 'win' && encounterId === 'shouMen') {
      return events.concat(this.end('victory', '守门胜利'))
    }
    if (result.outcome === 'win') {
      const pool = this.drawReward(encounterId)
      s.pendingReward = pool
      s.rewardPicked = undefined
      s.screen = 'reward'
      events.push({
        type: 'run.rewardOffered',
        pool: [...pool],
        text: `奖励：${pool.map(cardName).join('、')}。`,
      })
      events.push({ type: 'run.screen', screen: 'reward', text: '选择奖励。' })
      return events
    }
    s.screen = 'map'
    events.push({ type: 'run.screen', screen: 'map', text: '回到地图。节点还在。' })
    return events
  }

  returnToMap(): RunEvent[] {
    const s = this.state
    if (s.ended) throw new Error('这趟已经结束')
    if (s.screen === 'event') {
      if (s.eventChosen === undefined) throw new Error('还没选事件')
      s.eventChosen = undefined
      s.progress += 1
      s.screen = 'map'
      return [{ type: 'run.screen', screen: 'map', text: '回到地图。' }]
    }
    if (s.screen === 'reward') {
      if (!s.rewardPicked) throw new Error('还没选奖励')
      s.pendingReward = undefined
      s.rewardPicked = undefined
      s.progress += 1
      s.screen = 'map'
      return [{ type: 'run.screen', screen: 'map', text: '回到地图。' }]
    }
    throw new Error('现在不能回地图')
  }

  private drawReward(encounterId: EncounterId): string[] {
    const pool = rewardPool(encounterId).filter((id) => !this.state.obtainedRewards.includes(id))
    const bag = shuffle(this.state.rng, [...pool])
    return bag.slice(0, 3)
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
}
