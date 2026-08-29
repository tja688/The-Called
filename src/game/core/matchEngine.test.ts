import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../../config/decks'
import type { CardInstance, CellId, MatchState, Side } from '../types'
import { canPlaceCard, createMatch, getBoardPower, playCard } from './matchEngine'

const makeMatch = () => createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)

function findCard(state: MatchState, side: Side, cardId: string): CardInstance {
  const card = [...state[side].hand, ...state[side].deck].find((candidate) => candidate.cardId === cardId)
  if (!card) throw new Error(`Missing ${cardId}`)
  state[side].hand = [card]
  state[side].deck = state[side].deck.filter((candidate) => candidate.instanceId !== card.instanceId)
  return card
}

describe('beginner match engine', () => {
  it('starts with the player, five cards each, and a 3x3 board', () => {
    const state = makeMatch()
    expect(state.turn).toBe('player')
    expect(state.player.hand).toHaveLength(5)
    expect(state.monster.hand).toHaveLength(5)
    expect(state.board).toHaveLength(9)
  })

  it('allows strictly higher Power to cover but rejects equal Power', () => {
    const state = makeMatch()
    const highCard = findCard(state, 'player', 'player_reference_point')
    state.board[0].card = { instanceId: 'enemy-four', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    const success = playCard(state, { side: 'player', cardInstanceId: highCard.instanceId, cellId: state.board[0].id })
    expect(success.error).toBeUndefined()
    expect(success.state.board[0].card?.owner).toBe('player')
    expect(success.state.board[0].coveredCards.map((card) => card.instanceId)).toEqual(['enemy-four'])

    const monsterCard = findCard(success.state, 'monster', 'sva_boundary_convergence')
    monsterCard.currentPower = 6
    const coveredAgain = playCard(success.state, {
      side: 'monster',
      cardInstanceId: monsterCard.instanceId,
      cellId: success.state.board[0].id,
    })
    expect(coveredAgain.state.board[0].card?.instanceId).toBe(monsterCard.instanceId)
    expect(coveredAgain.state.board[0].coveredCards.map((card) => card.instanceId)).toEqual([
      'enemy-four',
      highCard.instanceId,
    ])

    const equalState = makeMatch()
    const equalCard = findCard(equalState, 'player', 'player_observation_record')
    equalState.board[0].card = { instanceId: 'enemy-four', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    const rejected = playCard(equalState, { side: 'player', cardInstanceId: equalCard.instanceId, cellId: equalState.board[0].id })
    expect(rejected.error).toBe('INVALID_PLACEMENT')
    expect(rejected.state.player.hand).toContainEqual(equalCard)
  })

  it('allows a card of any Power to be placed on every empty cell', () => {
    const state = makeMatch()
    const calibration = findCard(state, 'player', 'player_calibration')

    for (const cell of state.board) expect(canPlaceCard(state, calibration, cell)).toBe(true)
  })

  it('applies simple edge and automatic adjacent Power effects', () => {
    const edgeState = makeMatch()
    const edgeCard = findCard(edgeState, 'player', 'player_boundary_condition')
    const edgeResult = playCard(edgeState, { side: 'player', cardInstanceId: edgeCard.instanceId, cellId: 'cell-0-0' })
    expect(edgeResult.state.board[0].card?.currentPower).toBe(5)

    const targetState = makeMatch()
    const correction = findCard(targetState, 'player', 'player_error_correction')
    targetState.board[1].card = { instanceId: 'enemy-four', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    targetState.board[3].card = { instanceId: 'enemy-three', cardId: 'sva_boundary_convergence', owner: 'monster', currentPower: 3 }
    const targetResult = playCard(targetState, { side: 'player', cardInstanceId: correction.instanceId, cellId: 'cell-0-0' })
    expect(targetResult.state.board[1].card?.currentPower).toBe(3)
    expect(targetResult.state.board[3].card?.currentPower).toBe(2)

    const buffState = makeMatch()
    const calibration = findCard(buffState, 'player', 'player_calibration')
    buffState.board[1].card = { instanceId: 'friend-one', cardId: 'player_reference_point', owner: 'player', currentPower: 5 }
    buffState.board[3].card = { instanceId: 'friend-two', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    const buffResult = playCard(buffState, { side: 'player', cardInstanceId: calibration.instanceId, cellId: 'cell-0-0' })
    expect(buffResult.state.board[1].card?.currentPower).toBe(6)
    expect(buffResult.state.board[3].card?.currentPower).toBe(5)
  })

  it('finishes when the ninth cell is filled and totals current Power', () => {
    const state = makeMatch()
    const finalCard = findCard(state, 'player', 'player_reference_point')
    state.board.slice(0, 8).forEach((cell, index) => {
      cell.card = {
        instanceId: `board-${index}`,
        cardId: index % 2 ? 'sva_afterimage' : 'player_observation_record',
        owner: index % 2 ? 'monster' : 'player',
        currentPower: index % 2 ? 2 : 4,
      }
    })
    const result = playCard(state, { side: 'player', cardInstanceId: finalCard.instanceId, cellId: 'cell-2-2' as CellId })
    expect(result.state.status).toBe('finished')
    expect(result.state.result).toEqual({ winner: 'player', playerPower: 21, monsterPower: 8 })
    expect(getBoardPower(result.state, 'player')).toBe(21)
  })
})
