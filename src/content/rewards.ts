import type { RngState } from '../core/Rng'
import { nextFloat, pick, shuffle } from '../core/Rng'
import type { Rarity, SchoolId } from '../domain/types'
import { ANCHORS } from './anchors'
import { CARDS, isRewardable } from './cards'

export type DrawRarity = 'white' | 'blue' | 'gold'

const DOWN: Record<DrawRarity, DrawRarity | null> = {
  gold: 'blue',
  blue: 'white',
  white: null,
}

export function rollRarity(rng: RngState): DrawRarity {
  const n = nextFloat(rng) * 100
  if (n < ANCHORS.rarityWhite) return 'white'
  if (n < ANCHORS.rarityWhite + ANCHORS.rarityBlue) return 'blue'
  return 'gold'
}

export interface DrawOpts {
  /** 只抽该体系，不含中立（「本体系蓝/金」）。 */
  schoolOnly?: boolean
  /** 只抽中立。 */
  neutralsOnly?: boolean
}

export function rewardableIds(school: SchoolId, rarity?: Rarity, opts?: DrawOpts): string[] {
  return Object.values(CARDS)
    .filter((c) => {
      if (!isRewardable(c.id)) return false
      if (rarity && c.rarity !== rarity) return false
      if (opts?.schoolOnly) return c.school === school
      if (opts?.neutralsOnly) return c.school === 'neutral'
      return c.school === school || c.school === 'neutral'
    })
    .map((c) => c.id)
}

export function recastPool(rarity: Rarity, except: string): string[] {
  return Object.values(CARDS)
    .filter((c) => isRewardable(c.id) && c.rarity === rarity && c.id !== except)
    .map((c) => c.id)
}

export function drawPlayerCards(
  rng: RngState,
  school: SchoolId,
  count: number,
  exclude: string[] = [],
): string[] {
  const out: string[] = []
  const taken = new Set(exclude)
  for (let i = 0; i < count; i++) {
    const id = drawOne(rng, school, taken)
    if (!id) break
    out.push(id)
    taken.add(id)
  }
  return out
}

export function drawOne(rng: RngState, school: SchoolId, taken: Set<string>, opts?: DrawOpts): string | undefined {
  let rarity: DrawRarity | null = rollRarity(rng)
  while (rarity) {
    const pool = rewardableIds(school, rarity, opts).filter((id) => !taken.has(id))
    if (pool.length) return pick(rng, pool)
    rarity = DOWN[rarity]
  }
  return undefined
}

/** 商店/战斗奖励：先掷稀有度，该档抽空则金→蓝→白。 */
export function drawOfRarity(rng: RngState, school: SchoolId, rarity: DrawRarity, taken: Set<string> = new Set(), opts?: DrawOpts): string | undefined {
  let r: DrawRarity | null = rarity
  while (r) {
    const pool = rewardableIds(school, r, opts).filter((id) => !taken.has(id))
    if (pool.length) return pick(rng, shuffle(rng, [...pool]))
    r = DOWN[r]
  }
  return undefined
}

/** 事件「本体系蓝/金」：不降档、不掺中立。 */
export function drawExact(rng: RngState, school: SchoolId, rarity: DrawRarity, taken: Set<string> = new Set(), opts?: DrawOpts): string | undefined {
  const pool = rewardableIds(school, rarity, opts).filter((id) => !taken.has(id))
  return pool.length ? pick(rng, pool) : undefined
}

export function shopPrice(rng: RngState, rarity: DrawRarity): number {
  const base = rarity === 'white' ? ANCHORS.shopWhite : rarity === 'blue' ? ANCHORS.shopBlue : ANCHORS.shopGold
  const factor = 0.95 + nextFloat(rng) * 0.1
  return Math.max(1, Math.round(base * factor))
}
