import { describe, expect, it } from 'vitest'
import { getCardDefinition } from '../../config/cardCatalog'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../../config/decks'
import { svarbhanuBeginnerStrategy } from '../../config/monsterStrategies'
import { canPlaceCard, createMatch, getBoardPower, passTurn, playCard, resolveFinalBattleTurn } from '../core/matchEngine'
import { getOrthogonalNeighbors } from '../core/spatial'
import type { CardInstance, CellId, MatchState, PlayCardAction, Side } from '../types'
import { chooseMonsterAction, chooseShownCard } from './monsterAI'
import { observeMonster } from './observation'

function fixture(): MatchState {
  const state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0)
  for (const cell of state.board) {
    cell.card = null
    cell.coveredCards = []
  }
  state.player.hand = []
  state.player.deck = []
  state.monster.hand = []
  state.monster.deck = []
  state.turn = 'monster'
  state.status = 'playing'
  state.finalBattle = false
  state.openingTurn = false
  state.result = null
  return state
}

function give(state: MatchState, side: Side, cardId: string, power = getCardDefinition(cardId).power): CardInstance {
  const card: CardInstance = {
    instanceId: `${side}-${cardId}-${state[side].hand.length + 1}`,
    cardId,
    owner: side,
    currentPower: power,
  }
  state[side].hand.push(card)
  return card
}

function place(state: MatchState, cellId: CellId, side: Side, cardId: string, power: number) {
  const cell = state.board.find((candidate) => candidate.id === cellId)
  if (!cell) throw new Error(cellId)
  cell.card = { instanceId: `board-${cellId}`, cardId, owner: side, currentPower: power }
}

function fillRest(state: MatchState, owner: Side, power: number) {
  let index = 0
  for (const cell of state.board) {
    if (cell.card) continue
    index += 1
    cell.card = { instanceId: `fill-${owner}-${index}`, cardId: owner === 'player' ? 'player_observation_record' : 'sva_occluder', owner, currentPower: power }
  }
}

function mulberry32(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6D2B79F5) >>> 0
    let token = Math.imul(value ^ (value >>> 15), 1 | value)
    token = (token + Math.imul(token ^ (token >>> 7), 61 | token)) ^ token
    return ((token ^ (token >>> 14)) >>> 0) / 4294967296
  }
}

function legalMoves(state: MatchState, side: Side): PlayCardAction[] {
  const moves: PlayCardAction[] = []
  for (const card of state[side].hand) {
    for (const cell of state.board) {
      if (!canPlaceCard(state, card, cell)) continue
      moves.push({ side, cardInstanceId: card.instanceId, cellId: cell.id })
    }
  }
  return moves
}

function greedyPlay(state: MatchState, side: Side): PlayCardAction | null {
  const other = side === 'player' ? 'monster' : 'player'
  let best: PlayCardAction | null = null
  let bestScore = -Infinity
  for (const action of legalMoves(state, side)) {
    const result = playCard(state, action)
    if (result.error) continue
    const before = getBoardPower(state, side) - getBoardPower(state, other)
    const after = getBoardPower(result.state, side) - getBoardPower(result.state, other)
    const weakened = Math.max(0, getBoardPower(state, other) - getBoardPower(result.state, other))
    const score = (after - before) * 10 + weakened * 5 + (action.cellId === 'cell-1-1' ? 12 : 0)
    if (score > bestScore) {
      best = action
      bestScore = score
    }
  }
  return best
}

function finishOpening(state: MatchState): MatchState {
  let current = state
  for (let step = 0; step < 6 && current.status === 'playing' && current.finalBattle && current.openingTurn; step += 1) {
    const next = resolveFinalBattleTurn(current)
    if (next === current) break
    current = next
  }
  return current
}

describe('monster card AI', () => {
  it('returns nothing when it is not the monster decision, and does not pass up a legal card', () => {
    const state = fixture()
    give(state, 'monster', 'sva_occluder')
    expect(chooseMonsterAction({ ...state, turn: 'player' })).toBeNull()
    expect(chooseMonsterAction({ ...state, status: 'finished' })).toBeNull()
    expect(chooseMonsterAction({ ...state, openingTurn: true, finalBattle: true })).toBeNull()
    expect(chooseMonsterAction(fixture())).toBeNull()
    const action = chooseMonsterAction(state)
    expect(action?.cardInstanceId).toBe(state.monster.hand[0].instanceId)
  })

  it('does not mutate the match it was shown', () => {
    const state = fixture()
    give(state, 'monster', 'sva_black_box_model')
    give(state, 'monster', 'sva_afterimage')
    place(state, 'cell-0-0', 'player', 'player_observation_record', 4)
    const before = structuredClone(state)
    chooseMonsterAction(state)
    expect(state).toEqual(before)
  })

  it('plays the same card and cell when the hidden hand is rearranged', () => {
    const state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    state.turn = 'monster'
    place(state, 'cell-1-0', 'player', 'player_calibration', 3)
    const rearranged = structuredClone(state)
    rearranged.player.hand.reverse()
    const deckTop = rearranged.player.deck[0]
    rearranged.player.deck[0] = rearranged.player.hand[0]
    rearranged.player.hand[0] = deckTop
    const left = chooseMonsterAction(state)
    const right = chooseMonsterAction(rearranged)
    expect(left).toEqual(right)
  })

  it('places an edge bonus on an edge and an ally bonus beside a friend', () => {
    const edge = fixture()
    give(edge, 'monster', 'sva_boundary_convergence')
    expect(chooseMonsterAction(edge)?.cellId).not.toBe('cell-1-1')

    const ally = fixture()
    place(ally, 'cell-1-1', 'monster', 'sva_occluder', 4)
    give(ally, 'monster', 'sva_off_axis_projection')
    const beside = chooseMonsterAction(ally)?.cellId
    expect(beside && getOrthogonalNeighbors('cell-1-1')).toContain(beside)
  })

  it('hits every adjacent enemy with a debuff instead of standing off to the side', () => {
    const state = fixture()
    place(state, 'cell-0-1', 'player', 'player_observation_record', 4)
    place(state, 'cell-1-0', 'player', 'player_observation_record', 4)
    give(state, 'monster', 'sva_unobservable_zone')
    expect(chooseMonsterAction(state)?.cellId).toBe('cell-0-0')
  })

  it('removes a 1-Power enemy with a debuff instead of ignoring it', () => {
    const state = fixture()
    place(state, 'cell-0-1', 'player', 'sva_afterimage', 1)
    give(state, 'monster', 'sva_unobservable_zone')
    const cellId = chooseMonsterAction(state)?.cellId
    expect(cellId && getOrthogonalNeighbors(cellId)).toContain('cell-0-1')
  })

  it('refuses the greedy center fill that would lose on the spot', () => {
    const state = fixture()
    place(state, 'cell-0-1', 'player', 'player_calibration', 1)
    fillRest(state, 'player', 6)
    const center = state.board.find((cell) => cell.id === 'cell-1-1')
    if (!center) throw new Error('missing center')
    center.card = null
    const cover = give(state, 'monster', 'sva_occluder')
    const action = chooseMonsterAction(state)
    expect(action?.cardInstanceId).toBe(cover.instanceId)
    expect(action?.cellId).toBe('cell-0-1')
    expect(action?.cellId).not.toBe('cell-1-1')
    const played = playCard(state, action!)
    expect(played.error).toBeUndefined()
    expect(finishOpening(played.state).result?.winner).not.toBe('player')
  })

  it('spends the card that wins the final battle and keeps the card that would hand the lead back', () => {
    const state = fixture()
    state.finalBattle = true
    place(state, 'cell-0-0', 'player', 'player_observation_record', 4)
    place(state, 'cell-0-1', 'player', 'player_calibration', 1)
    place(state, 'cell-0-2', 'player', 'player_calibration', 3)
    place(state, 'cell-1-0', 'player', 'player_calibration', 3)
    place(state, 'cell-1-1', 'player', 'player_calibration', 3)
    place(state, 'cell-1-2', 'monster', 'sva_occluder', 2)
    place(state, 'cell-2-0', 'monster', 'sva_occluder', 2)
    place(state, 'cell-2-1', 'monster', 'sva_occluder', 3)
    place(state, 'cell-2-2', 'monster', 'sva_occluder', 3)
    const winner = give(state, 'monster', 'sva_black_box_model')
    const loser = give(state, 'monster', 'sva_afterimage')
    expect(getBoardPower(state, 'monster')).toBe(10)
    expect(getBoardPower(state, 'player')).toBe(14)
    const action = chooseMonsterAction(state)
    expect(action?.cardInstanceId).toBe(winner.instanceId)
    expect(action?.cardInstanceId).not.toBe(loser.instanceId)
    const won = finishOpening(playCard(state, action!).state)
    expect(won.result?.winner).toBe('monster')
    const thrown = finishOpening(playCard(state, { side: 'monster', cardInstanceId: loser.instanceId, cellId: 'cell-0-1' }).state)
    expect(thrown.result?.winner).toBe('player')
  })

  it('only returns actions the rules engine accepts, including random midgame positions', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const random = mulberry32(seed)
      let state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, random)
      for (let ply = 0; ply < 6 && state.status === 'playing'; ply += 1) {
        state = finishOpening(state)
        if (state.status !== 'playing') break
        const side = state.turn
        const moves = legalMoves(state, side)
        if (moves.length === 0) {
          state = passTurn(state)
          continue
        }
        state = playCard(state, moves[Math.floor(random() * moves.length)]).state
      }
      state = finishOpening(state)
      if (state.status !== 'playing' || state.turn !== 'monster' || state.openingTurn) continue
      const snapshot = structuredClone(state)
      const action = chooseMonsterAction(state, svarbhanuBeginnerStrategy)
      expect(state).toEqual(snapshot)
      if (!action) {
        expect(legalMoves(state, 'monster')).toHaveLength(0)
        continue
      }
      expect(playCard(state, action).error).toBeUndefined()
    }
  })

  it('answers an opening monster turn quickly enough to telegraph', () => {
    const state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    state.turn = 'monster'
    const started = performance.now()
    const action = chooseMonsterAction(state)
    expect(performance.now() - started).toBeLessThan(250)
    expect(playCard(state, action!).error).toBeUndefined()
  })

  it('plays the same cell when its own deck is reversed', () => {
    const state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    state.turn = 'monster'
    const reversed = structuredClone(state)
    reversed.monster.deck.reverse()
    reversed.player.hand.reverse()
    expect(observeMonster(reversed).ownDeckCounts).toEqual(observeMonster(state).ownDeckCounts)
    expect(chooseMonsterAction(reversed)).toEqual(chooseMonsterAction(state))
  })

  it('announces the card that survives the player’s answer, not the card that looks best immediately', () => {
    const state = fixture()
    state.turn = 'player'
    const five = give(state, 'monster', 'sva_occluder')
    const tide = give(state, 'monster', 'moon_tide')
    place(state, 'cell-0-1', 'player', 'player_observation_record', 3)
    place(state, 'cell-1-1', 'player', 'player_observation_record', 8)
    place(state, 'cell-1-0', 'monster', 'sva_occluder', 2)
    place(state, 'cell-1-2', 'monster', 'sva_occluder', 2)
    place(state, 'cell-2-0', 'monster', 'sva_occluder', 2)
    place(state, 'cell-2-1', 'monster', 'sva_occluder', 2)
    place(state, 'cell-2-2', 'monster', 'sva_occluder', 2)
    state.player.deck = []
    state.graveyard = []
    state.player.hand = [{
      instanceId: 'known-five',
      cardId: 'player_reference_point',
      owner: 'player',
      currentPower: 5,
    }]
    const known = {
      opponentDeck: { id: 'known', name: 'known', cards: [{ cardId: 'player_reference_point' as const, count: 1 }] },
      risk: 0,
    }
    expect(chooseShownCard(state, known)?.instanceId).toBe(tide.instanceId)
    const myopic = structuredClone(state)
    myopic.turn = 'monster'
    expect(chooseMonsterAction(myopic, known)?.cardInstanceId).toBe(five.instanceId)
  })

  it('places only the card that was already telegraphed', () => {
    const state = fixture()
    const locked = give(state, 'monster', 'sva_afterimage')
    give(state, 'monster', 'sva_black_box_model')
    const action = chooseMonsterAction(state, svarbhanuBeginnerStrategy, locked.instanceId)
    expect(action?.cardInstanceId).toBe(locked.instanceId)
    expect(playCard(state, action!).error).toBeUndefined()
  })

  it('outscored the old greedy monster against the same opponents', () => {
    let searchMargin = 0
    let greedyMargin = 0
    for (let seed = 1; seed <= 2; seed += 1) {
      const searched = playMatch(seed, (state) => chooseMonsterAction(state), dumpFirst)
      const greedy = playMatch(seed, (state) => greedyPlay(state, 'monster'), dumpFirst)
      searchMargin += margin(searched)
      greedyMargin += margin(greedy)
    }
    expect(searchMargin).toBeGreaterThan(greedyMargin)
  }, 20_000)

  it('plays the mirror cell, the shared row, and the center for the new effects', () => {
    const mirror = fixture()
    place(mirror, 'cell-0-0', 'player', 'player_observation_record', 4)
    give(mirror, 'monster', 'rk_antipode')
    expect(chooseMonsterAction(mirror)?.cellId).toBe('cell-2-2')

    const row = fixture()
    place(row, 'cell-0-0', 'player', 'player_calibration', 1)
    place(row, 'cell-0-2', 'player', 'player_calibration', 1)
    give(row, 'monster', 'rk_latitude')
    expect(chooseMonsterAction(row)?.cellId).toBe('cell-0-1')

    const center = fixture()
    give(center, 'monster', 'rk_node')
    expect(chooseMonsterAction(center)?.cellId).toBe('cell-1-1')
  })
})

function dumpFirst(state: MatchState, side: Side): PlayCardAction | null {
  return legalMoves(state, side)[0] ?? null
}

function margin(state: MatchState): number {
  if (state.result) return state.result.monsterPower - state.result.playerPower
  return getBoardPower(state, 'monster') - getBoardPower(state, 'player') - 30
}

function playMatch(
  seed: number,
  monster: (state: MatchState) => PlayCardAction | null,
  player: (state: MatchState, side: Side) => PlayCardAction | null,
): MatchState {
  let state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, mulberry32(seed))
  for (let guard = 0; guard < 30 && state.status === 'playing'; guard += 1) {
    state = finishOpening(state)
    if (state.status !== 'playing') break
    const action = state.turn === 'monster' ? monster(state) : player(state, 'player')
    state = action ? playCard(state, action).state : passTurn(state)
  }
  return state
}
