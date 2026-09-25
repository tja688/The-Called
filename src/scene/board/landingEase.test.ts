import { describe, expect, it } from 'vitest'
import { landingEase } from './landingEase'
import { MONSTER_PENDING, PLAYER_PENDING } from '../cards/tacticalCards'

describe('card landing', () => {
  it('starts at rest, finishes seated, and is past the halfway mark early', () => {
    expect(landingEase(0)).toBe(0)
    expect(landingEase(1)).toBe(1)
    expect(landingEase(0.45)).toBeGreaterThan(0.55)
  })

  it('stacks the pending cards in one column, player below the monster, at one size', () => {
    expect(PLAYER_PENDING.x).toBe(MONSTER_PENDING.x)
    expect(PLAYER_PENDING.scale).toBe(MONSTER_PENDING.scale)
    expect(PLAYER_PENDING.y).toBe(MONSTER_PENDING.y)
    expect(PLAYER_PENDING.z).toBeGreaterThan(MONSTER_PENDING.z + 2)
  })
})