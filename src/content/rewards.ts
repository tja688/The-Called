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

export function rewardableIds(school: SchoolId, rarity?: Rarity): string[] {
  return Object.values(CARDS)
    .filter((c) => isRewardable(c.id) && (c.school === school || c.school === 'neutral') && (!rarity || c.rarity === rarity))
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

export function drawOne(rng: RngState, school: SchoolId, taken: Set<string>): string | undefined {
  let rarity: DrawRarity | null = rollRarity(rng)
  while (rarity) {
    const pool = rewardableIds(school, rarity).filter((id) => !taken.has(id))
    if (pool.length) return pick(rng, pool)
    rarity = DOWN[rarity]
  }
  return undefined
}

export function drawOfRarity(rng: RngState, school: SchoolId, rarity: DrawRarity, taken: Set<string> = new Set()): string | undefined {
  let r: DrawRarity | null = rarity
  while (r) {
    const pool = rewardableIds(school, r).filter((id) => !taken.has(id))
    if (pool.length) return pick(rng, shuffle(rng, [...pool]))
    r = DOWN[r]
  }
  return undefined
}

export function shopPrice(rng: RngState, rarity: DrawRarity): number {
  const base = rarity === 'white' ? ANCHORS.shopWhite : rarity === 'blue' ? ANCHORS.shopBlue : ANCHORS.shopGold
  const factor = 0.95 + nextFloat(rng) * 0.1
  return Math.max(1, Math.round(base * factor))
}
