import { describe, expect, it } from 'vitest'
import { getCardDefinition } from '../../config/cardCatalog'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../../config/decks'
import type { CardInstance, CellId, MatchState, Side } from '../types'
import { canPlaceCard, createMatch, finalBattleMessage, getBoardPower, passTurn, playCard, resolveFinalBattleTurn, resolveIdleTurn } from './matchEngine'

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
    expect(result.state.graveyard.map((card) => card.instanceId)).toEqual(['enemy-one', 'buried'])
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
    expect(covered.state.board[0].card?.currentPower).toBe(2)
    expect(covered.state.turn).toBe('player')
    expect(getBoardPower(covered.state, 'monster')).toBe(2)
    expect(getBoardPower(covered.state, 'player')).toBe(0)
    const passed = resolveFinalBattleTurn(covered.state)
    expect(passed.turn).toBe('monster')
    expect(passed.openingTurn).toBe(true)
    const resolved = resolveFinalBattleTurn(passed)
    expect(resolved.result?.winner).toBe('monster')
    expect(resolved.result?.monsterPower).toBe(2)
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

  it('draws when Power and cell count are both tied and nobody can move', () => {
    const state = makeMatch()
    state.finalBattle = true
    state.openingTurn = true
    state.turn = 'monster'
    state.player.hand = []
    state.monster.hand = []
    state.board.forEach((cell, index) => {
      if (index === 8) return
      const playerCell = index < 4
      cell.card = {
        instanceId: `board-${index}`,
        cardId: playerCell ? 'player_observation_record' : 'sva_afterimage',
        owner: playerCell ? 'player' : 'monster',
        currentPower: 2,
      }
    })
    const resolved = resolveFinalBattleTurn(state)
    expect(resolved.result).toEqual({ winner: 'draw', playerPower: 8, monsterPower: 8 })
  })

  it('ends a holed board once neither side can play or draw', () => {
    const state = makeMatch()
    state.turn = 'player'
    state.player.hand = []
    state.player.deck = []
    state.monster.hand = []
    state.monster.deck = []
    state.player.turnsTaken = 2
    state.monster.turnsTaken = 2
    state.board.forEach((cell, index) => {
      if (index > 5) return
      const playerCell = index < 3
      cell.card = {
        instanceId: `board-${index}`,
        cardId: playerCell ? 'player_observation_record' : 'sva_afterimage',
        owner: playerCell ? 'player' : 'monster',
        currentPower: 2,
      }
    })
    const ended = resolveIdleTurn(state)
    expect(ended.status).toBe('finished')
    expect(ended.result).toEqual({ winner: 'draw', playerPower: 6, monsterPower: 6 })

    const monsterCanPlay = structuredClone(state)
    monsterCanPlay.monster.hand = [{
      instanceId: 'late-cover',
      cardId: 'sva_occluder',
      owner: 'monster',
      currentPower: 4,
    }]
    const passed = resolveIdleTurn(monsterCanPlay)
    expect(passed.status).toBe('playing')
    expect(passed.turn).toBe('monster')
  })
})

function hold(state: MatchState, side: Side, cardId: string): CardInstance {
  const card: CardInstance = {
    instanceId: `${side}-${cardId}-held`,
    cardId,
    owner: side,
    currentPower: getCardDefinition(cardId).power,
  }
  state[side].hand = [card]
  state.turn = side
  return card
}

function top(state: MatchState, cellId: CellId) {
  return state.board.find((cell) => cell.id === cellId)?.card
}

describe('entry effects', () => {
  it('adds Power in the center, in a corner, and when the card is isolated', () => {
    const center = makeMatch()
    const node = hold(center, 'monster', 'rk_node')
    expect(playCard(center, { side: 'monster', cardInstanceId: node.instanceId, cellId: 'cell-1-1' }).state.board.find((cell) => cell.id === 'cell-1-1')?.card?.currentPower).toBe(5)
    const offCenter = makeMatch()
    const nodeEdge = hold(offCenter, 'monster', 'rk_node')
    expect(playCard(offCenter, { side: 'monster', cardInstanceId: nodeEdge.instanceId, cellId: 'cell-0-1' }).state.board[1].card?.currentPower).toBe(3)

    const corner = makeMatch()
    const horn = hold(corner, 'monster', 'moon_horn')
    expect(playCard(corner, { side: 'monster', cardInstanceId: horn.instanceId, cellId: 'cell-0-0' }).state.board[0].card?.currentPower).toBe(5)
    const edge = makeMatch()
    const hornEdge = hold(edge, 'monster', 'moon_horn')
    expect(playCard(edge, { side: 'monster', cardInstanceId: hornEdge.instanceId, cellId: 'cell-0-1' }).state.board[1].card?.currentPower).toBe(4)

    const alone = makeMatch()
    const pole = hold(alone, 'monster', 'rk_vacant_pole')
    expect(playCard(alone, { side: 'monster', cardInstanceId: pole.instanceId, cellId: 'cell-1-1' }).state.board.find((cell) => cell.id === 'cell-1-1')?.card?.currentPower).toBe(6)
    const crowded = makeMatch()
    crowded.board[1].card = { instanceId: 'friend', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    const beside = hold(crowded, 'monster', 'rk_vacant_pole')
    expect(playCard(crowded, { side: 'monster', cardInstanceId: beside.instanceId, cellId: 'cell-0-0' }).state.board[0].card?.currentPower).toBe(5)
  })

  it('buffs from a mirrored card and does nothing when the mirror is the same cell', () => {
    const mirrored = makeMatch()
    mirrored.board[8].card = { instanceId: 'far', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    const dipole = hold(mirrored, 'monster', 'rk_dipole')
    expect(playCard(mirrored, { side: 'monster', cardInstanceId: dipole.instanceId, cellId: 'cell-0-0' }).state.board[0].card?.currentPower).toBe(4)

    const empty = makeMatch()
    const lonely = hold(empty, 'monster', 'rk_dipole')
    expect(playCard(empty, { side: 'monster', cardInstanceId: lonely.instanceId, cellId: 'cell-0-0' }).state.board[0].card?.currentPower).toBe(3)

    const center = makeMatch()
    center.board[0].card = { instanceId: 'corner', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    const middle = hold(center, 'monster', 'rk_dipole')
    expect(playCard(center, { side: 'monster', cardInstanceId: middle.instanceId, cellId: 'cell-1-1' }).state.board.find((cell) => cell.id === 'cell-1-1')?.card?.currentPower).toBe(3)
  })

  it('reduces the mirrored enemy and leaves the center play untouched', () => {
    const state = makeMatch()
    state.board[0].card = { instanceId: 'victim', cardId: 'player_observation_record', owner: 'player', currentPower: 1 }
    const antipode = hold(state, 'monster', 'rk_antipode')
    const hit = playCard(state, { side: 'monster', cardInstanceId: antipode.instanceId, cellId: 'cell-2-2' })
    expect(top(hit.state, 'cell-0-0')).toBeNull()
    expect(hit.resolution?.removed.map((item) => item.card.instanceId)).toEqual(['victim'])
    expect(top(hit.state, 'cell-2-2')?.currentPower).toBe(5)

    const center = makeMatch()
    center.board[0].card = { instanceId: 'safe', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    const middle = hold(center, 'monster', 'rk_antipode')
    const played = playCard(center, { side: 'monster', cardInstanceId: middle.instanceId, cellId: 'cell-1-1' })
    expect(top(played.state, 'cell-1-1')?.currentPower).toBe(5)
    expect(top(played.state, 'cell-0-0')?.currentPower).toBe(4)
  })

  it('reduces other cards in the same row or column and removes a card reduced to 0', () => {
    const row = makeMatch()
    row.board[0].card = { instanceId: 'row-a', cardId: 'player_calibration', owner: 'player', currentPower: 1 }
    row.board[2].card = { instanceId: 'row-b', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    row.board[3].card = { instanceId: 'other-row', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    const latitude = hold(row, 'monster', 'rk_latitude')
    const across = playCard(row, { side: 'monster', cardInstanceId: latitude.instanceId, cellId: 'cell-0-1' })
    expect(top(across.state, 'cell-0-0')).toBeNull()
    expect(top(across.state, 'cell-0-2')?.currentPower).toBe(3)
    expect(top(across.state, 'cell-1-0')?.currentPower).toBe(4)

    const column = makeMatch()
    column.board[0].card = { instanceId: 'col-a', cardId: 'player_calibration', owner: 'player', currentPower: 1 }
    column.board[6].card = { instanceId: 'col-b', cardId: 'player_observation_record', owner: 'player', currentPower: 3 }
    column.board[4].card = { instanceId: 'other-col', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    const longitude = hold(column, 'monster', 'rk_longitude')
    const down = playCard(column, { side: 'monster', cardInstanceId: longitude.instanceId, cellId: 'cell-1-0' })
    expect(top(down.state, 'cell-0-0')).toBeNull()
    expect(top(down.state, 'cell-2-0')?.currentPower).toBe(2)
    expect(top(down.state, 'cell-1-1')?.currentPower).toBe(4)
  })

  it('taxes enemy cards on the edge and leaves the center and friendly cards', () => {
    const state = makeMatch()
    state.board[0].card = { instanceId: 'edge-one', cardId: 'player_calibration', owner: 'player', currentPower: 1 }
    state.board[2].card = { instanceId: 'edge-four', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    state.board[4].card = { instanceId: 'center-player', cardId: 'player_observation_record', owner: 'player', currentPower: 4 }
    state.board[8].card = { instanceId: 'own-edge', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    const tide = hold(state, 'monster', 'moon_tide')
    const result = playCard(state, { side: 'monster', cardInstanceId: tide.instanceId, cellId: 'cell-1-0' })
    expect(top(result.state, 'cell-0-0')).toBeNull()
    expect(top(result.state, 'cell-0-2')?.currentPower).toBe(3)
    expect(top(result.state, 'cell-1-1')?.currentPower).toBe(4)
    expect(top(result.state, 'cell-2-2')?.currentPower).toBe(4)
  })

  it('adds Power only once three friendly cards, including this one, are on the board', () => {
    const short = makeMatch()
    short.board[0].card = { instanceId: 'one', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    const early = hold(short, 'monster', 'moon_full')
    expect(playCard(short, { side: 'monster', cardInstanceId: early.instanceId, cellId: 'cell-0-1' }).state.board[1].card?.currentPower).toBe(5)

    const ready = makeMatch()
    ready.board[0].card = { instanceId: 'one', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    ready.board[2].card = { instanceId: 'two', cardId: 'sva_occluder', owner: 'monster', currentPower: 4 }
    const full = hold(ready, 'monster', 'moon_full')
    expect(playCard(ready, { side: 'monster', cardInstanceId: full.instanceId, cellId: 'cell-0-1' }).state.board[1].card?.currentPower).toBe(6)
  })
})
