import { cardDef, isNegative } from '../../content/cards'
import type { EventStep } from '../../content/events'
import { drawExact, drawOne } from '../../content/rewards'
import { nextFloat, type RngState } from '../../core/Rng'
import type { SchoolId } from '../types'
import type { RunEvent } from './events'

export interface EventCardRef {
  uid: string
  defId: string
  baseBonus: number
}

export interface EventHost {
  rng: RngState
  school: SchoolId
  box: EventCardRef[]
  hpMax: number
  payGold(amount: number, reason: string): RunEvent[]
  changeHp(delta: number, reason: string): RunEvent[]
  addToBox(defId: string, baseBonus?: number): RunEvent[]
  removeBoxUid(uid: string, events: RunEvent[]): void
  grantRelicOrGold(): RunEvent[]
  grantRandomNegative(): RunEvent[]
  beginEventBattle(): RunEvent[]
  offerReward(pool: string[], text: string): RunEvent[]
  bumpNonNegative(n: number): void
  setShopDiscount(rate: number): void
}

/** 返回 true 时不再追加「选了」那一行。奖励屏和事件战都是这样停住的。 */
export function runEventSteps(
  steps: EventStep[],
  host: EventHost,
  card: EventCardRef | undefined,
  events: RunEvent[],
): boolean {
  for (const step of steps) {
    if (runStep(step, host, card, events)) return true
  }
  return false
}

function runStep(step: EventStep, host: EventHost, card: EventCardRef | undefined, events: RunEvent[]): boolean {
  switch (step.step) {
    case 'gold':
      events.push(...host.payGold(-step.n, 'event'))
      return false
    case 'changeHp':
      events.push(...host.changeHp(step.n, 'event'))
      return false
    case 'healMaxRatio':
      events.push(...host.changeHp(Math.ceil(host.hpMax * step.ratio), 'event'))
      return false
    case 'relicOrGold':
      events.push(...host.grantRelicOrGold())
      return false
    case 'randomNegative':
      events.push(...host.grantRandomNegative())
      return false
    case 'addDrawn': {
      const id = drawExact(host.rng, host.school, step.rarity)
      if (id) events.push(...host.addToBox(id))
      return false
    }
    case 'chance':
      return runEventSteps(nextFloat(host.rng) < step.p ? step.then : step.else, host, card, events)
    case 'removePicked':
      if (card) host.removeBoxUid(card.uid, events)
      return false
    case 'bumpAndCopy':
      if (card) {
        card.baseBonus += step.n
        events.push(...host.addToBox(card.defId, card.baseBonus))
      }
      return false
    case 'sellPicked': {
      if (!card) return false
      const rarity = cardDef(card.defId).rarity
      const gold = rarity === 'gold' ? 45 : rarity === 'blue' ? 25 : 15
      host.removeBoxUid(card.uid, events)
      events.push(...host.payGold(-gold, 'event'))
      return false
    }
    case 'bumpPicked':
      if (card) card.baseBonus += step.n
      return false
    case 'offerExact':
      return offerPool(host, events, step.n, step.text, (taken) => drawExact(host.rng, host.school, step.rarity, taken))
    case 'offerNeutral':
      return offerPool(host, events, step.n, step.text, (taken) => drawOne(host.rng, host.school, taken, { neutralsOnly: true }))
    case 'perNegative': {
      const negs = host.box.filter((c) => isNegative(c.defId))
      if (step.hpEach) events.push(...host.changeHp(-step.hpEach * negs.length, 'event'))
      if (step.goldEach) events.push(...host.payGold(step.goldEach * negs.length, 'event'))
      for (const c of negs) host.removeBoxUid(c.uid, events)
      return false
    }
    case 'bumpNonNegative':
      host.bumpNonNegative(step.n)
      return false
    case 'shopDiscount':
      host.setShopDiscount(step.rate)
      return false
    case 'eventFight':
      events.push(...host.beginEventBattle())
      return true
  }
}

function offerPool(
  host: EventHost,
  events: RunEvent[],
  n: number,
  text: string,
  draw: (taken: Set<string>) => string | undefined,
): boolean {
  const taken = new Set<string>()
  const pool: string[] = []
  for (let i = 0; i < n; i++) {
    const id = draw(taken)
    if (!id) break
    pool.push(id)
    taken.add(id)
  }
  if (pool.length) events.push(...host.offerReward(pool, text))
  return true
}
