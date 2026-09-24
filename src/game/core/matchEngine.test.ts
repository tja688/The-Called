import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../../config/decks'
import type { CardInstance, CellId, MatchState, Side } from '../types'
import { canPlaceCard, createMatch, finalBattleMessage, getBoardPower, passTurn, playCard, resolveFinalBattleTurn } from './matchEngine'

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
    expect(success.state.board[0].card?.currentPower).toBe(1)
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

  it('subtracts the covered Power after entry effects', () => {
    const state = makeMatch()
    const falsification = findCard(state, 'player', 'player_falsification')
    state.board[0].card = { instanceId: 'enemy-three', cardId: 'sva_boundary_convergence', owner: 'monster', currentPower: 3 }
    const result = playCard(state, { side: 'player', cardInstanceId: falsification.instanceId, cellId: state.board[0].id })
    expect(result.state.board[0].card?.currentPower).toBe(2)
    expect(result.resolution?.cover).toMatchObject({ fromPower: 5, subtract: 3, toPower: 2 })
  })

  it('removes a top card reduced to 0 and does not uncover cards beneath it', () => {
    const state = makeMatch()
    const correction = findCard(state, 'player', 'player_error_correction')
    state.board[1].card = { instanceId: 'enemy-one', cardId: 'sva_occluder', owner: 'monster', currentPower: 1 }
    state.board[1].coveredCards = [{ instanceId: 'buried', cardId: 'sva_afterimage', owner: 'player', currentPower: 2 }]
    const result = playCard(state, { side: 'player', cardInstanceId: correction.instanceId, cellId: 'cell-0-0' })
    expect(result.state.board[1].card).toBeNull()
    expect(result.state.board[1].coveredCards).toEqual([])
    expect(result.resolution?.removed.map((item) => item.card.instanceId)).toEqual(['enemy-one'])
  })

  it('checks a full board only after 0-Power cards have left', () => {
    const state = makeMatch()
    const correction = findCard(state, 'player', 'player_error_correction')
    state.board.forEach((cell, index) => {
      if (cell.id === 'cell-2-2') return
      cell.card = {
        instanceId: `board-${index}`,
        cardId: 'sva_afterimage',
        owner: 'monster',
        currentPower: cell.id === 'cell-2-1' ? 1 : 3,
      }
    })
    const result = playCard(state, { side: 'player', cardInstanceId: correction.instanceId, cellId: 'cell-2-2' })
    expect(result.state.board.find((cell) => cell.id === 'cell-2-1')?.card).toBeNull()
    expect(result.state.finalBattle).toBe(false)
    expect(result.state.status).toBe('playing')
  })

  it('passes a monster turn that has no legal play', () => {
    const state = makeMatch()
    state.turn = 'monster'
    state.monster.hand = []
    const passed = passTurn(state)
    expect(passed.turn).toBe('player')
    expect(passed.round).toBe(state.round + 1)
  })

  it('enters final battle when the ninth cell is filled instead of scoring', () => {
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
    expect(result.state.status).toBe('playing')
    expect(result.state.finalBattle).toBe(true)
    expect(result.state.openingTurn).toBe(true)
    expect(result.state.turn).toBe('monster')
    expect(result.state.message).toBe(finalBattleMessage)
    expect(result.state.result).toBeNull()
    expect(getBoardPower(result.state, 'player')).toBe(21)
  })

  it('awards the lead at the start of a final-battle turn', () => {
    const state = makeMatch()
    state.finalBattle = true
    state.openingTurn = true
    state.turn = 'player'
    state.board.forEach((cell, index) => {
      cell.card = {
        instanceId: `board-${index}`,
        cardId: 'player_observation_record',
        owner: index < 5 ? 'player' : 'monster',
        currentPower: index < 5 ? 3 : 2,
      }
    })
    const resolved = resolveFinalBattleTurn(state)
    expect(resolved.status).toBe('finished')
    expect(resolved.result).toEqual({ winner: 'player', playerPower: 15, monsterPower: 8 })
  })

  it('lets the trailing side cover, then scores that Power on the next turn start', () => {
    const state = makeMatch()
    state.finalBattle = true
    state.openingTurn = true
    state.turn = 'monster'
    state.player.hand = []
    state.board.forEach((cell, index) => {
      const playerCell = index < 2
      cell.card = {
        instanceId: `board-${index}`,
        cardId: playerCell ? 'player_observation_record' : 'sva_afterimage',
        owner: playerCell ? 'player' : 'monster',
        currentPower: index === 0 ? 4 : 0,
      }
    })
    const cover = findCard(state, 'monster', 'sva_black_box_model')
    const spare = state.monster.deck.find((card) => card.cardId === 'sva_occluder')
    if (!spare) throw new Error('Missing spare cover')
    state.monster.hand = [cover, spare]
    state.monster.deck = state.monster.deck.filter((card) => card.instanceId !== spare.instanceId)
    const opened = resolveFinalBattleTurn(state)
    expect(opened.status).toBe('playing')
    expect(opened.openingTurn).toBe(false)
    const covered = playCard(opened, { side: 'monster', cardInstanceId: cover.instanceId, cellId: opened.board[0].id })
    expect(covered.state.board[0].card?.currentPower).toBe(1)
    expect(covered.state.turn).toBe('player')
    expect(getBoardPower(covered.state, 'monster')).toBe(1)
    expect(getBoardPower(covered.state, 'player')).toBe(0)
    const passed = resolveFinalBattleTurn(covered.state)
    expect(passed.turn).toBe('monster')
    expect(passed.openingTurn).toBe(true)
    const resolved = resolveFinalBattleTurn(passed)
    expect(resolved.result?.winner).toBe('monster')
    expect(resolved.result?.monsterPower).toBe(1)
  })

  it('gives the cell majority to the winner when neither side can cover and Power is tied', () => {
    const state = makeMatch()
    state.finalBattle = true
    state.openingTurn = true
    state.turn = 'monster'
    state.player.hand = []
    state.monster.hand = []
    state.board.forEach((cell, index) => {
      const playerCell = index < 5
      cell.card = {
        instanceId: `board-${index}`,
        cardId: playerCell ? 'player_observation_record' : 'sva_afterimage',
        owner: playerCell ? 'player' : 'monster',
        currentPower: playerCell ? 2 : index < 7 ? 3 : 2,
      }
    })
    const resolved = resolveFinalBattleTurn(state)
    expect(resolved.status).toBe('finished')
    expect(resolved.result).toEqual({ winner: 'player', playerPower: 10, monsterPower: 10 })
  })
})
