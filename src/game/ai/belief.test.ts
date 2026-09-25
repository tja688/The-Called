import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../../config/decks'
import { createMatch } from '../core/matchEngine'
import type { CardInstance, MatchState } from '../types'
import { createOpponentBelief } from './belief'
import { observeMonster } from './observation'

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

  it('weights possible hands and drops a card once the graveyard shows it', () => {
    const state = fresh()
    const buried = state.player.deck.find((card) => card.cardId === 'player_reference_point')
    if (!buried) throw new Error('missing reference')
    state.player.deck = state.player.deck.filter((card) => card.instanceId !== buried.instanceId)
    state.graveyard = [buried]
    const belief = createOpponentBelief(state, beginnerPlayerDeck)
    expect(belief.survivors.filter((cardId) => cardId === 'player_reference_point')).toHaveLength(2)
    const mass = belief.worlds.reduce((sum, world) => sum + world.weight, 0)
    expect(mass).toBeGreaterThan(0.99)
    expect(mass).toBeLessThan(1.01)
    expect(belief.worlds.every((world) => world.hand.length === state.player.hand.length)).toBe(true)
  })

  it('does not change when the hidden hand and deck trade cards', () => {
    const state = fresh()
    const swapped: MatchState = structuredClone(state)
    const hidden = [...swapped.player.hand, ...swapped.player.deck].reverse()
    swapped.player.hand = hidden.slice(0, state.player.hand.length)
    swapped.player.deck = hidden.slice(state.player.hand.length)
    expect(createOpponentBelief(swapped, beginnerPlayerDeck)).toEqual(createOpponentBelief(state, beginnerPlayerDeck))
    expect(observeMonster(swapped).ownDeckCounts).toEqual(observeMonster(state).ownDeckCounts)
    expect(swapped.player.hand.map((card: CardInstance) => card.instanceId)).not.toEqual(state.player.hand.map((card) => card.instanceId))
  })
})
