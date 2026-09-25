import { getCardDefinition } from '../../config/cardCatalog'
import type { MonsterAiProfile } from '../../config/monsterStrategies'
import { canPlaceCard, passTurn, playCard, resolveFinalBattleTurn } from '../core/matchEngine'
import { getOrthogonalNeighbors } from '../core/spatial'
import type { BoardCell, CardInstance, CellId, MatchState, PlayCardAction } from '../types'
import { createOpponentBelief, spendSurvivor, syntheticOpponentCard, type OpponentBelief } from './belief'
import { evaluateForMonster } from './evaluate'

const NODE_LIMIT = 20_000
const QUIET_PLIES = 1

type BeliefPlay = { cardId: string; cellId: CellId }

function settle(state: MatchState): MatchState {
  let current = state
  for (let step = 0; step < 6; step += 1) {
    if (current.status !== 'playing' || !current.finalBattle || !current.openingTurn) return current
    const next = resolveFinalBattleTurn(current)
    if (next === current) return current
    current = next
  }
  return current
}

function depthFor(state: MatchState): number {
  if (state.finalBattle) return 5
  const empty = state.board.filter((cell) => !cell.card).length
  if (empty <= 1) return 4
  if (empty <= 3) return 3
  return 2
}

function neighborCells(board: BoardCell[], cellId: CellId) {
  const ids = new Set(getOrthogonalNeighbors(cellId))
  return board.filter((cell) => ids.has(cell.id))
}

/** Cheap ordering key. The search, not this estimate, decides the move. */
function placementTempo(card: CardInstance, cell: BoardCell, board: BoardCell[]): number {
  const effect = getCardDefinition(card.cardId).effect
  const neighbors = neighborCells(board, cell.id)
  const edge = cell.row === 0 || cell.col === 0 || cell.row === 2 || cell.col === 2
  let power = card.currentPower
  if (effect.type === 'self_power_if_position') {
    const met = effect.condition === 'edge' ? edge
      : effect.condition === 'adjacent_friendly'
        ? neighbors.some((neighbor) => neighbor.card?.owner === card.owner)
        : neighbors.some((neighbor) => neighbor.card && neighbor.card.owner !== card.owner)
    if (met) power += effect.amount
  }
  if (effect.type === 'self_power_on_cover' && cell.card && cell.card.owner !== card.owner) power += effect.amount
  const hits = effect.type === 'adjacent_power_change'
    ? neighbors.filter((neighbor) => neighbor.card?.owner === (effect.target === 'friendly' ? card.owner : (card.owner === 'player' ? 'monster' : 'player'))).length
    : 0
  const aura = effect.type === 'adjacent_power_change'
    ? hits * (effect.target === 'enemy' ? -effect.amount : effect.amount)
    : 0
  const covered = cell.card && cell.card.owner !== card.owner ? cell.card.currentPower : 0
  if (covered > 0 && power - covered <= 0) return covered + aura
  return power + aura
}

function monsterMoves(state: MatchState): PlayCardAction[] {
  const moves: PlayCardAction[] = []
  for (const card of state.monster.hand) {
    for (const cell of state.board) {
      if (!canPlaceCard(state, card, cell)) continue
      moves.push({ side: 'monster', cardInstanceId: card.instanceId, cellId: cell.id })
    }
  }
  const cardAt = new Map(state.monster.hand.map((card) => [card.instanceId, card]))
  const cellAt = new Map(state.board.map((cell) => [cell.id, cell]))
  moves.sort((left, right) => {
    const leftTempo = placementTempo(cardAt.get(left.cardInstanceId)!, cellAt.get(left.cellId)!, state.board)
    const rightTempo = placementTempo(cardAt.get(right.cardInstanceId)!, cellAt.get(right.cellId)!, state.board)
    return rightTempo - leftTempo || left.cellId.localeCompare(right.cellId) || left.cardInstanceId.localeCompare(right.cardInstanceId)
  })
  return moves
}

function playerMoves(state: MatchState, belief: OpponentBelief): BeliefPlay[] {
  if (state.player.hand.length === 0) return []
  const moves: BeliefPlay[] = []
  const seen = new Set<string>()
  for (const cardId of belief.survivors) {
    if (seen.has(cardId)) continue
    seen.add(cardId)
    const card = syntheticOpponentCard(cardId)
    for (const cell of state.board) {
      if (!canPlaceCard(state, card, cell)) continue
      moves.push({ cardId, cellId: cell.id })
    }
  }
  moves.sort((left, right) => {
    const leftTempo = placementTempo(syntheticOpponentCard(left.cardId), state.board.find((cell) => cell.id === left.cellId)!, state.board)
    const rightTempo = placementTempo(syntheticOpponentCard(right.cardId), state.board.find((cell) => cell.id === right.cellId)!, state.board)
    return rightTempo - leftTempo || left.cellId.localeCompare(right.cellId) || left.cardId.localeCompare(right.cardId)
  })
  return moves
}

function isForcing(card: CardInstance, cell: BoardCell, board: BoardCell[]): boolean {
  if (cell.card && cell.card.owner !== card.owner) return true
  const effect = getCardDefinition(card.cardId).effect
  if (effect.type !== 'adjacent_power_change' || effect.target !== 'enemy' || effect.amount >= 0) return false
  return neighborCells(board, cell.id).some((neighbor) => neighbor.card && neighbor.card.owner !== card.owner)
}

function applyBeliefPlay(state: MatchState, play: BeliefPlay): MatchState | null {
  if (state.player.hand.length === 0) return null
  const probe = structuredClone(state)
  probe.player.hand[0] = syntheticOpponentCard(play.cardId)
  const result = playCard(probe, { side: 'player', cardInstanceId: probe.player.hand[0].instanceId, cellId: play.cellId })
  return result.error ? null : result.state
}

type Budget = { nodes: number }

function minimax(state: MatchState, belief: OpponentBelief, depth: number, alpha: number, beta: number, budget: Budget): number {
  const settled = settle(state)
  if (settled.status === 'finished') return evaluateForMonster(settled, belief)
  if (budget.nodes >= NODE_LIMIT) return evaluateForMonster(settled, belief)
  if (depth <= 0) return quiesce(settled, belief, alpha, beta, QUIET_PLIES, budget)

  budget.nodes += 1
  if (settled.turn === 'monster') {
    const moves = monsterMoves(settled)
    if (moves.length === 0) return passValue(settled, belief, depth, alpha, beta, budget)
    let best = -Infinity
    for (const move of moves) {
      const result = playCard(settled, move)
      if (result.error) continue
      best = Math.max(best, minimax(result.state, belief, depth - 1, alpha, beta, budget))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best === -Infinity ? evaluateForMonster(settled, belief) : best
  }

  const replies = playerMoves(settled, belief)
  if (replies.length === 0) return passValue(settled, belief, depth, alpha, beta, budget)
  let best = Infinity
  for (const reply of replies) {
    const next = applyBeliefPlay(settled, reply)
    if (!next) continue
    best = Math.min(best, minimax(next, spendSurvivor(belief, reply.cardId), depth - 1, alpha, beta, budget))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best === Infinity ? evaluateForMonster(settled, belief) : best
}

function passValue(state: MatchState, belief: OpponentBelief, depth: number, alpha: number, beta: number, budget: Budget): number {
  const passed = passTurn(state)
  if (passed === state || passed.turn === state.turn) return evaluateForMonster(state, belief)
  return minimax(passed, belief, depth - 1, alpha, beta, budget)
}

function quiesce(state: MatchState, belief: OpponentBelief, alpha: number, beta: number, quiet: number, budget: Budget): number {
  const settled = settle(state)
  if (settled.status === 'finished') return evaluateForMonster(settled, belief)
  const stand = evaluateForMonster(settled, belief)
  if (quiet <= 0 || budget.nodes >= NODE_LIMIT) return stand
  budget.nodes += 1

  if (settled.turn === 'monster') {
    let best = stand
    alpha = Math.max(alpha, best)
    if (alpha >= beta) return best
    for (const move of monsterMoves(settled)) {
      const card = settled.monster.hand.find((candidate) => candidate.instanceId === move.cardInstanceId)
      const cell = settled.board.find((candidate) => candidate.id === move.cellId)
      if (!card || !cell || !isForcing(card, cell, settled.board)) continue
      const result = playCard(settled, move)
      if (result.error) continue
      best = Math.max(best, quiesce(result.state, belief, alpha, beta, quiet - 1, budget))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }

  let best = stand
  beta = Math.min(beta, best)
  if (alpha >= beta) return best
  for (const reply of playerMoves(settled, belief)) {
    const card = syntheticOpponentCard(reply.cardId)
    const cell = settled.board.find((candidate) => candidate.id === reply.cellId)
    if (!cell || !isForcing(card, cell, settled.board)) continue
    const next = applyBeliefPlay(settled, reply)
    if (!next) continue
    best = Math.min(best, quiesce(next, spendSurvivor(belief, reply.cardId), alpha, beta, quiet - 1, budget))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

export function selectMonsterAction(
  state: MatchState,
  profile: MonsterAiProfile,
  lockedInstanceId?: string,
): PlayCardAction | null {
  if (state.status !== 'playing' || state.turn !== 'monster' || state.openingTurn) return null
  const moves = monsterMoves(state).filter((move) => !lockedInstanceId || move.cardInstanceId === lockedInstanceId)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]

  const belief = createOpponentBelief(state, profile.opponentDeck)
  const depth = depthFor(state)
  const budget: Budget = { nodes: 0 }
  let best = moves[0]
  let bestScore = -Infinity
  let bestBody = -Infinity
  let alpha = -Infinity
  for (const move of moves) {
    const result = playCard(state, move)
    if (result.error) continue
    const score = minimax(result.state, belief, depth - 1, alpha, Infinity, budget)
    const placed = result.state.board.find((cell) => cell.id === move.cellId)?.card
    const body = placed?.owner === 'monster' ? placed.currentPower : 0
    const better = score > bestScore || (score === bestScore && body > bestBody)
    if (better) {
      best = move
      bestScore = score
      bestBody = body
      alpha = Math.max(alpha, score)
    }
  }
  return best
}
