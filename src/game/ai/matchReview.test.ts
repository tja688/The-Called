import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, monsterDeckForLevel } from '../../config/decks'
import { svarbhanuBeginnerStrategy } from '../../config/monsterStrategies'
import { canPlaceCard, createMatch, passTurn, playCard, resolveFinalBattleTurn, resolveIdleTurn } from '../core/matchEngine'
import type { MatchState, PlayCardAction, Side } from '../types'
import { chooseMonsterAction, chooseShownCard } from './monsterAI'

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

function finishOpening(state: MatchState): MatchState {
  let current = state
  for (let step = 0; step < 6 && current.status === 'playing' && current.finalBattle && current.openingTurn; step += 1) {
    const next = resolveFinalBattleTurn(current)
    if (next === current) break
    current = next
  }
  return current
}

function greedyPlay(state: MatchState, side: Side, lockedInstanceId?: string): PlayCardAction | null {
  let best: PlayCardAction | null = null
  let bestScore = -Infinity
  for (const action of legalMoves(state, side)) {
    if (lockedInstanceId && action.cardInstanceId !== lockedInstanceId) continue
    const result = playCard(state, action)
    if (result.error) continue
    const own = result.state.board.reduce((total, cell) => total + (cell.card?.owner === side ? cell.card.currentPower : 0), 0)
    const other = result.state.board.reduce((total, cell) => total + (cell.card && cell.card.owner !== side ? cell.card.currentPower : 0), 0)
    const score = own - other
    if (score > bestScore) {
      best = action
      bestScore = score
    }
  }
  return best
}

type Trace = { finished: boolean; plies: number; brokeLock: boolean; illegal: string | null; winner: string | null }

function playFairMatch(seed: number, monster: 'search' | 'greedy' | 'first'): Trace {
  let state = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, monsterDeckForLevel('level-01'), mulberry32(seed))
  let telegraph = chooseShownCard(state, svarbhanuBeginnerStrategy)?.instanceId
  let brokeLock = false
  let illegal: string | null = null
  let plies = 0
  for (; plies < 40 && state.status === 'playing'; plies += 1) {
    state = finishOpening(state)
    if (state.status !== 'playing') break
    if (state.turn === 'player') {
      const action = greedyPlay(state, 'player')
      if (!action) {
        const passed = resolveIdleTurn(state)
        if (passed === state) {
          illegal = 'player stuck'
          break
        }
        state = passed
        if (telegraph && !state.monster.hand.some((card) => card.instanceId === telegraph)) {
          telegraph = state.status === 'playing' && state.turn === 'player' ? chooseShownCard(state)?.instanceId : undefined
        }
        continue
      }
      const result = playCard(state, action)
      if (result.error) {
        illegal = result.error
        break
      }
      state = result.state
      if (!telegraph || !state.monster.hand.some((card) => card.instanceId === telegraph)) {
        telegraph = state.status === 'playing' && state.turn === 'player' ? chooseShownCard(state, svarbhanuBeginnerStrategy)?.instanceId : undefined
      }
      continue
    }
    const action = monster === 'search'
      ? chooseMonsterAction(state, svarbhanuBeginnerStrategy, telegraph)
      : monster === 'greedy'
        ? greedyPlay(state, 'monster', telegraph)
        : legalMoves(state, 'monster').find((action) => !telegraph || action.cardInstanceId === telegraph) ?? null
    if (telegraph && action && action.cardInstanceId !== telegraph) brokeLock = true
    if (!action) {
      const conceded = telegraph ? passTurn(state) : state
      const passed = conceded.status !== 'playing' || conceded.openingTurn ? conceded : resolveIdleTurn(conceded)
      if (passed === state) {
        illegal = 'monster stuck'
        break
      }
      state = passed
      telegraph = state.status === 'playing' && state.turn === 'player' ? chooseShownCard(state, svarbhanuBeginnerStrategy)?.instanceId : undefined
      continue
    }
    const result = playCard(state, action)
    if (result.error) {
      illegal = result.error
      break
    }
    state = result.state
    telegraph = state.status === 'playing' && state.turn === 'player' ? chooseShownCard(state, svarbhanuBeginnerStrategy)?.instanceId : undefined
  }
  return {
    finished: state.status === 'finished',
    plies,
    brokeLock,
    illegal,
    winner: state.result?.winner ?? null,
  }
}

describe('match review', () => {
  it('finishes fair matches, keeps the announced card, and only plays legal cells', () => {
    const traces = [1, 2, 3, 4, 5, 6].map((seed) => playFairMatch(seed, 'search'))
    expect(traces.every((trace) => trace.finished)).toBe(true)
    expect(traces.every((trace) => !trace.brokeLock)).toBe(true)
    expect(traces.every((trace) => trace.illegal === null)).toBe(true)
  }, 60_000)

  it('does not lose ground to a greedy monster across the same openings', () => {
    let search = 0
    let greedy = 0
    for (const seed of [1, 2, 3, 4]) {
      const searched = playFairMatch(seed, 'search')
      const blunt = playFairMatch(seed, 'greedy')
      search += searched.winner === 'monster' ? 1 : searched.winner === 'draw' ? 0 : -1
      greedy += blunt.winner === 'monster' ? 1 : blunt.winner === 'draw' ? 0 : -1
    }
    expect(search).toBeGreaterThanOrEqual(greedy)
  }, 60_000)
})
