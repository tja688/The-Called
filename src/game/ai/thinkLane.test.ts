import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../../config/decks'
import { svarbhanuBeginnerStrategy } from '../../config/monsterStrategies'
import { createMatch } from '../core/matchEngine'
import { searchMonsterAction, selectMonsterAction } from './search'

import { driveThink } from './thinkLane'

describe('monster think lane', () => {
  it('yields during the search and still chooses the synchronous move', () => {
    const state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    state.turn = 'monster'
    state.player.hand = []
    state.player.deck = []
    state.monster.deck = []
    state.monster.hand = state.monster.hand.slice(0, 2)
    const sync = selectMonsterAction(state, svarbhanuBeginnerStrategy)
    const gen = searchMonsterAction(state, svarbhanuBeginnerStrategy, undefined, 0)
    let yields = 0
    let step = gen.next()
    while (!step.done) {
      yields += 1
      step = gen.next()
    }
    expect(yields).toBeGreaterThan(1)
    expect(step.value).toEqual(sync)
  })

  it('returns to the caller before the search finishes', () => {
    const state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    state.turn = 'monster'
    const queued: Array<() => void> = []
    let settled = false
    driveThink(
      searchMonsterAction(state, svarbhanuBeginnerStrategy, undefined, 0),
      () => { settled = true },
      (step) => { queued.push(step) },
    )
    expect(settled).toBe(false)
    expect(queued.length).toBe(1)
    let guard = 0
    while (!settled && queued.length > 0 && guard < 100_000) {
      guard += 1
      queued.shift()?.()
    }
    expect(settled).toBe(true)
    expect(guard).toBeGreaterThan(1)
  })
})
