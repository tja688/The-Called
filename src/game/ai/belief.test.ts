import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../../config/decks'
import { createMatch } from '../core/matchEngine'
import type { CardInstance, MatchState } from '../types'
import { createOpponentBelief } from './belief'

function fresh(): MatchState {
  return createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0)
}

describe('opponent belief', () => {
  it('keeps every unplaced copy when nothing has been destroyed', () => {
    const state = fresh()
    const belief = createOpponentBelief(state, beginnerPlayerDeck)
    expect(belief.survivors).toHaveLength(beginnerPlayerDeck.cards.reduce((sum, entry) => sum + entry.count, 0))
    expect(belief.survivors.filter((cardId) => cardId === 'player_reference_point')).toHaveLength(3)
  })

  it('drops cards that are visible on top of a cell or buried under one', () => {
    const state = fresh()
    state.board[0].card = { instanceId: 'top', cardId: 'player_reference_point', owner: 'player', currentPower: 5 }
    state.board[1].card = { instanceId: 'monster-top', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    state.board[1].coveredCards = [{ instanceId: 'buried', cardId: 'player_reference_point', owner: 'player', currentPower: 5 }]
    state.player.hand = state.player.hand.slice(0, 4)
    state.player.deck = state.player.deck.slice(0, 6)
    const belief = createOpponentBelief(state, beginnerPlayerDeck)
    expect(belief.survivors.filter((cardId) => cardId === 'player_reference_point')).toHaveLength(1)
  })

  it('assumes the weakest missing copies were destroyed', () => {
    const state = fresh()
    state.player.hand = []
    state.player.deck = []
    const belief = createOpponentBelief(state, beginnerPlayerDeck)
    expect(belief.survivors).toEqual([])
  })

  it('does not change when the hidden hand and deck trade cards', () => {
    const state = fresh()
    const swapped: MatchState = structuredClone(state)
    const hidden = [...swapped.player.hand, ...swapped.player.deck].reverse()
    swapped.player.hand = hidden.slice(0, state.player.hand.length)
    swapped.player.deck = hidden.slice(state.player.hand.length)
    expect(createOpponentBelief(swapped, beginnerPlayerDeck)).toEqual(createOpponentBelief(state, beginnerPlayerDeck))
    expect(swapped.player.hand.map((card: CardInstance) => card.instanceId)).not.toEqual(state.player.hand.map((card) => card.instanceId))
  })
})
