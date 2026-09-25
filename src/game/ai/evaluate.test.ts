import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../../config/decks'
import { createMatch } from '../core/matchEngine'
import type { MatchState } from '../types'
import type { OpponentBelief } from './belief'
import { evaluateForMonster } from './evaluate'

function withMonsterPower(power: number): MatchState {
  const state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0)
  state.board[0].card = { instanceId: 'monster-top', cardId: 'sva_occluder', owner: 'monster', currentPower: power }
  state.monster.hand = []
  return state
}

function belief(cardId: string): OpponentBelief {
  return { survivors: [cardId], worlds: [{ hand: [cardId], deck: [], weight: 1 }] }
}

describe('cover reach', () => {
  it('treats a count bonus and a mirror self bonus as enough to cover', () => {
    const four = withMonsterPower(4)
    expect(evaluateForMonster(four, belief('player_syzygy'))).toBeLessThan(evaluateForMonster(four, belief('player_calibration')))

    const three = withMonsterPower(3)
    expect(evaluateForMonster(three, belief('rk_dipole'))).toBeLessThan(evaluateForMonster(three, belief('player_calibration')))
  })
})
