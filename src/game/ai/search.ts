import { getCardDefinition } from '../../config/cardCatalog'
import type { MonsterAiProfile } from '../../config/monsterStrategies'
import { canPlaceCard, getBoardPower, playCard, resolveFinalBattleTurn, resolveIdleTurn } from '../core/matchEngine'
import { BOARD_SIZE, getMirrorCell, getOrthogonalNeighbors } from '../core/spatial'
import type { BoardCell, CardInstance, CellId, MatchState, PlayCardAction } from '../types'
import { createOpponentBelief, mixRisk, type BeliefWorld, type OpponentBelief } from './belief'
import { evaluateForMonster } from './evaluate'
import { hypotheticalState, observeMonster, type MonsterObservation } from './observation'

const NODE_LIMIT = 20_000
const HARD_MS = 110
const QUIET_PLIES = 1
const INTENT_REPLIES = 8

type Budget = { nodes: number; deadline: number }
type TableEntry = { depth: number; score: number; flag: 'exact' | 'lower' | 'upper' }

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

function margin(state: MatchState): number {
  return getBoardPower(state, 'monster') - getBoardPower(state, 'player')
}

/** How much the rules engine changed the position. Used for ordering and quiescence. */
function stateDelta(before: MatchState, after: MatchState): number {
  const swing = margin(after) - margin(before)
  let removed = 0
  let stolen = 0
  for (const cell of after.board) {
    const previous = before.board.find((candidate) => candidate.id === cell.id)
    if (previous?.card && !cell.card) removed += 1
    if (previous?.card && cell.card && previous.card.owner !== cell.card.owner) stolen += 1
  }
  const battle = Number(after.finalBattle) - Number(before.finalBattle)
  const ended = after.status === 'finished' ? 1 : 0
  return swing * 100 + removed * 40 + stolen * 30 + battle * 20 + ended * 50
}

function onOuterRing(index: number) {
  return index === 0 || index === BOARD_SIZE - 1
}

function enemyOf(card: CardInstance) {
  return card.owner === 'player' ? 'monster' : 'player'
}

function neighborCells(board: BoardCell[], cellId: CellId) {
  const ids = new Set(getOrthogonalNeighbors(cellId))
  return board.filter((cell) => ids.has(cell.id))
}

/** Power taken from an enemy card. A card reduced to 0 contributes its whole Power. */
function enemySwing(power: number, amount: number) {
  const next = Math.max(0, power + amount)
  if (next === 0) return power
  return -amount
}

/** Cheap ordering key. The search, not this estimate, decides the move. */
function placementTempo(card: CardInstance, cell: BoardCell, board: BoardCell[]): number {
  const effect = getCardDefinition(card.cardId).effect
  const neighbors = neighborCells(board, cell.id)
  const enemy = enemyOf(card)
  const edge = onOuterRing(cell.row) || onOuterRing(cell.col)
  const corner = onOuterRing(cell.row) && onOuterRing(cell.col)
  const center = (BOARD_SIZE - 1) / 2
  let power = card.currentPower
  if (effect.type === 'self_power_if_position') {
    const met = effect.condition === 'edge' ? edge
      : effect.condition === 'corner' ? corner
        : effect.condition === 'center' ? cell.row === center && cell.col === center
          : effect.condition === 'isolated' ? neighbors.every((neighbor) => neighbor.card?.owner !== card.owner)
            : effect.condition === 'adjacent_friendly'
              ? neighbors.some((neighbor) => neighbor.card?.owner === card.owner)
              : neighbors.some((neighbor) => neighbor.card && neighbor.card.owner !== card.owner)
    if (met) power += effect.amount
  }
  if (effect.type === 'self_power_on_cover' && cell.card && cell.card.owner !== card.owner) power += effect.amount
  if (effect.type === 'mirror' && effect.affect === 'self') {
    const mirrorId = getMirrorCell(cell.id)
    const mirror = mirrorId === cell.id ? undefined : board.find((candidate) => candidate.id === mirrorId)
    if (mirror?.card) power += effect.amount
  }
  if (effect.type === 'self_power_if_count') {
    const side = effect.side === 'friendly' ? card.owner : enemy
    const count = board.reduce((total, candidate) => {
      if (candidate.id === cell.id) return total + (side === card.owner ? 1 : 0)
      return total + (candidate.card?.owner === side ? 1 : 0)
    }, 0)
    if (count >= effect.minimum) power += effect.amount
  }
  let aura = 0
  if (effect.type === 'adjacent_power_change') {
    const hits = neighbors.filter((neighbor) => neighbor.card?.owner === (effect.target === 'friendly' ? card.owner : enemy)).length
    aura = hits * (effect.target === 'enemy' ? -effect.amount : effect.amount)
  }
  if (effect.type === 'mirror' && effect.affect === 'enemy') {
    const mirrorId = getMirrorCell(cell.id)
    const mirror = mirrorId === cell.id ? undefined : board.find((candidate) => candidate.id === mirrorId)
    if (mirror?.card?.owner === enemy && effect.amount < 0) aura += enemySwing(mirror.card.currentPower, effect.amount)
  }
  if (effect.type === 'line') {
    const target = effect.target === 'friendly' ? card.owner : enemy
    for (const candidate of board) {
      if (candidate.id === cell.id || candidate.card?.owner !== target) continue
      const aligned = effect.axis === 'row' ? candidate.row === cell.row : candidate.col === cell.col
      if (!aligned) continue
      aura += effect.target === 'enemy' && effect.amount < 0 ? enemySwing(candidate.card.currentPower, effect.amount) : effect.amount
    }
  }
  if (effect.type === 'edge_tax' && effect.amount < 0) {
    for (const candidate of board) {
      if (candidate.id === cell.id || candidate.card?.owner !== enemy) continue
      if (!onOuterRing(candidate.row) && !onOuterRing(candidate.col)) continue
      aura += enemySwing(candidate.card.currentPower, effect.amount)
    }
  }
  const covered = cell.card && cell.card.owner !== card.owner ? cell.card.currentPower : 0
  if (covered > 0 && power - covered <= 0) return covered + aura
  return power + aura
}

function isForcing(card: CardInstance, cell: BoardCell, board: BoardCell[]): boolean {
  if (cell.card && cell.card.owner !== card.owner) return true
  const effect = getCardDefinition(card.cardId).effect
  const enemy = enemyOf(card)
  if (effect.type === 'adjacent_power_change' && effect.target === 'enemy' && effect.amount < 0) {
    return neighborCells(board, cell.id).some((neighbor) => neighbor.card?.owner === enemy)
  }
  if (effect.type === 'mirror' && effect.affect === 'enemy' && effect.amount < 0) {
    const mirrorId = getMirrorCell(cell.id)
    if (mirrorId === cell.id) return false
    return board.find((candidate) => candidate.id === mirrorId)?.card?.owner === enemy
  }
  if (effect.type === 'line' && effect.target === 'enemy' && effect.amount < 0) {
    return board.some((candidate) => {
      if (candidate.id === cell.id || candidate.card?.owner !== enemy) return false
      return effect.axis === 'row' ? candidate.row === cell.row : candidate.col === cell.col
    })
  }
  if (effect.type === 'edge_tax' && effect.amount < 0) {
    return board.some((candidate) => {
      if (candidate.id === cell.id || candidate.card?.owner !== enemy) return false
      return onOuterRing(candidate.row) || onOuterRing(candidate.col)
    })
  }
  return false
}

function isTactical(before: MatchState, after: MatchState): boolean {
  if (after.status !== before.status || after.finalBattle !== before.finalBattle) return true
  if (Math.abs(margin(after) - margin(before)) >= 2) return true
  const placed = after.board.find((cell) => {
    const previous = before.board.find((candidate) => candidate.id === cell.id)
    return cell.card && cell.card.owner === before.turn && previous?.card?.instanceId !== cell.card.instanceId
  })
  const origin = placed ? before.board.find((cell) => cell.id === placed.id) : undefined
  if (placed?.card && origin && isForcing(placed.card, origin, before.board)) return true
  return before.board.some((cell) => {
    const next = after.board.find((candidate) => candidate.id === cell.id)
    if (!next) return false
    if (Boolean(cell.card) !== Boolean(next.card)) return true
    return Boolean(cell.card && next.card && cell.card.owner !== next.card.owner)
  })
}

function stateKey(state: MatchState): string {
  const board = state.board.map((cell) => {
    const card = cell.card
    return card ? `${card.owner}:${card.cardId}:${card.currentPower}` : '.'
  }).join('/')
  const hand = state.monster.hand.map((card) => card.instanceId).join(',')
  const hidden = state.player.hand.map((card) => card.cardId).sort().join(',')
  return `${state.turn}|${state.finalBattle ? 1 : 0}|${board}|${hand}|${hidden}`
}

type ReadyMove = { action: PlayCardAction; state: MatchState; delta: number; tempo: number }

function readyMoves(state: MatchState, lockedInstanceId?: string, perCard = 3): ReadyMove[] {
  const side = state.turn
  const prepared: ReadyMove[] = []
  for (const card of state[side].hand) {
    if (lockedInstanceId && card.instanceId !== lockedInstanceId) continue
    const options: ReadyMove[] = []
    for (const cell of state.board) {
      if (!canPlaceCard(state, card, cell)) continue
      const action = { side, cardInstanceId: card.instanceId, cellId: cell.id }
      const result = playCard(state, action)
      if (result.error) continue
      options.push({ action, state: result.state, delta: stateDelta(state, result.state), tempo: placementTempo(card, cell, state.board) })
    }
    options.sort((left, right) => right.delta - left.delta || right.tempo - left.tempo || left.action.cellId.localeCompare(right.action.cellId))
    const kept = options.filter((move, index) => {
      if (index < perCard) return true
      const played = state[side].hand.find((candidate) => candidate.instanceId === move.action.cardInstanceId)
      const origin = state.board.find((candidate) => candidate.id === move.action.cellId)
      return Boolean(played && origin && isForcing(played, origin, state.board))
    })
    prepared.push(...kept)
  }
  prepared.sort((left, right) => right.delta - left.delta || right.tempo - left.tempo || left.action.cellId.localeCompare(right.action.cellId))
  return prepared
}

function riskOf(profile: MonsterAiProfile): number {
  return profile.risk ?? 0.35
}

function minimax(
  state: MatchState,
  belief: OpponentBelief,
  depth: number,
  alpha: number,
  beta: number,
  budget: Budget,
  table: Map<string, TableEntry>,
  lockedInstanceId?: string,
): number {
  const settled = settle(state)
  if (settled.status === 'finished' || budget.nodes >= NODE_LIMIT || performance.now() > budget.deadline) {
    return evaluateForMonster(settled, belief)
  }
  if (depth <= 0) return quiesce(settled, belief, alpha, beta, QUIET_PLIES, budget, table)

  const key = `${stateKey(settled)}|${depth}|${lockedInstanceId ?? ''}`
  const cached = table.get(key)
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') return cached.score
    if (cached.flag === 'lower') alpha = Math.max(alpha, cached.score)
    if (cached.flag === 'upper') beta = Math.min(beta, cached.score)
    if (alpha >= beta) return cached.score
  }

  budget.nodes += 1
  const originalAlpha = alpha
  const moves = readyMoves(settled, settled.turn === 'monster' ? lockedInstanceId : undefined)
  if (moves.length === 0) return passValue(settled, belief, depth, alpha, beta, budget, table, lockedInstanceId)

  const maximizing = settled.turn === 'monster'
  let best = maximizing ? -Infinity : Infinity
  let flag: TableEntry['flag'] = 'exact'
  for (const move of moves) {
    const nextLock = settled.turn === 'monster' ? undefined : lockedInstanceId
    const score = minimax(move.state, belief, depth - 1, alpha, beta, budget, table, nextLock)
    if (maximizing) {
      best = Math.max(best, score)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, score)
      beta = Math.min(beta, best)
    }
    if (alpha >= beta) {
      flag = maximizing ? 'lower' : 'upper'
      break
    }
  }
  if (best === -Infinity || best === Infinity) return evaluateForMonster(settled, belief)
  if (best <= originalAlpha) flag = 'upper'
  else if (best >= beta) flag = 'lower'
  table.set(key, { depth, score: best, flag })
  return best
}

function passValue(
  state: MatchState,
  belief: OpponentBelief,
  depth: number,
  alpha: number,
  beta: number,
  budget: Budget,
  table: Map<string, TableEntry>,
  lockedInstanceId?: string,
): number {
  const passed = resolveIdleTurn(state)
  if (passed === state || passed.turn === state.turn) return evaluateForMonster(state, belief)
  return minimax(passed, belief, depth - 1, alpha, beta, budget, table, lockedInstanceId)
}

function quiesce(
  state: MatchState,
  belief: OpponentBelief,
  alpha: number,
  beta: number,
  quiet: number,
  budget: Budget,
  table: Map<string, TableEntry>,
): number {
  const settled = settle(state)
  if (settled.status === 'finished') return evaluateForMonster(settled, belief)
  const stand = evaluateForMonster(settled, belief)
  if (quiet <= 0 || budget.nodes >= NODE_LIMIT || performance.now() > budget.deadline) return stand
  budget.nodes += 1
  const moves = readyMoves(settled, undefined, 8).filter((move) => isTactical(settled, move.state))
  if (settled.turn === 'monster') {
    let best = stand
    alpha = Math.max(alpha, best)
    for (const move of moves) {
      best = Math.max(best, quiesce(move.state, belief, alpha, beta, quiet - 1, budget, table))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = stand
  beta = Math.min(beta, best)
  for (const move of moves) {
    best = Math.min(best, quiesce(move.state, belief, alpha, beta, quiet - 1, budget, table))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

function tieBreak(cellId: CellId, card: CardInstance | null | undefined): number {
  const body = card?.owner === 'monster' ? card.currentPower : 0
  let hash = 2166136261
  const text = `${cellId}:${card?.instanceId ?? ''}`
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return body * 1_000_003 + (hash >>> 0)
}

function worldScore(
  observation: MonsterObservation,
  world: BeliefWorld,
  belief: OpponentBelief,
  move: PlayCardAction,
  depth: number,
  budget: Budget,
  table: Map<string, TableEntry>,
): number | null {
  const hypo = hypotheticalState(observation, world)
  const result = playCard(hypo, move)
  if (result.error) return null
  return minimax(result.state, belief, depth - 1, -Infinity, Infinity, budget, table)
}

export function selectMonsterAction(
  state: MatchState,
  profile: MonsterAiProfile,
  lockedInstanceId?: string,
): PlayCardAction | null {
  if (state.status !== 'playing' || state.turn !== 'monster' || state.openingTurn) return null
  const observation = observeMonster(state)
  const legal = readyMoves(hypotheticalState(observation, { hand: [], deck: [], weight: 1 }), lockedInstanceId)
  if (legal.length === 0) return null
  if (legal.length === 1) return legal[0].action

  const belief = createOpponentBelief(state, profile.opponentDeck)
  const deadline = performance.now() + HARD_MS
  const budget: Budget = { nodes: 0, deadline }
  const table = new Map<string, TableEntry>()
  let best = legal[0].action
  let bestScore = -Infinity
  let bestTie = -Infinity
  const maxDepth = depthFor(state)

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (performance.now() > deadline && depth > 1) break
    let depthBest = best
    let depthScore = -Infinity
    let depthTie = -Infinity
    let complete = true
    for (const move of legal) {
      if (performance.now() > deadline && depth > 1) {
        complete = false
        break
      }
      const scores: number[] = []
      const weights: number[] = []
      for (const world of belief.worlds) {
        const score = worldScore(observation, world, belief, move.action, depth, budget, table)
        if (score === null) continue
        scores.push(score)
        weights.push(world.weight)
      }
      if (scores.length === 0) continue
      const mixed = mixRisk(scores, weights, riskOf(profile))
      const placed = move.state.board.find((cell) => cell.id === move.action.cellId)?.card
      const tie = tieBreak(move.action.cellId, placed)
      const better = mixed > depthScore || (mixed === depthScore && tie > depthTie)
      if (better) {
        depthBest = move.action
        depthScore = mixed
        depthTie = tie
      }
    }
    if (!complete) break
    best = depthBest
    bestScore = depthScore
    bestTie = depthTie
  }
  return bestScore === -Infinity ? legal[0].action : best
}

function placementValue(state: MatchState, belief: OpponentBelief, lockedInstanceId: string): number {
  const settled = settle(state)
  if (settled.status === 'finished') return evaluateForMonster(settled, belief)
  if (settled.turn !== 'monster') return evaluateForMonster(settled, belief)
  const moves = readyMoves(settled, lockedInstanceId)
  if (moves.length === 0) {
    const passed = resolveIdleTurn(settled)
    return evaluateForMonster(passed === settled ? settled : settle(passed), belief)
  }
  let best = -Infinity
  for (const move of moves) best = Math.max(best, evaluateForMonster(settle(move.state), belief))
  return best
}

/**
 * Card to announce while the player still has a turn to answer it.
 * Value is the player's reply, then the best cell for that same card.
 * A card with no cell left is scored as a pass.
 */
export function chooseMonsterIntent(state: MatchState, profile: MonsterAiProfile): CardInstance | null {
  if (state.status !== 'playing' || state.turn !== 'player' || state.openingTurn) return null
  const cards = state.monster.hand
  if (cards.length === 0) return null
  const belief = createOpponentBelief(state, profile.opponentDeck)
  const observation = observeMonster(state)
  let best = cards[0]
  let bestScore = -Infinity
  const seen = new Set<string>()

  for (const card of cards) {
    const signature = `${card.cardId}:${card.currentPower}`
    if (seen.has(signature)) continue
    seen.add(signature)
    const scores: number[] = []
    const weights: number[] = []
    for (const world of belief.worlds) {
      const hypo = hypotheticalState(observation, world)
      const replies = readyMoves(hypo, undefined, INTENT_REPLIES)
      const answered = replies.length > 0 ? replies : [{ state: resolveIdleTurn(hypo) }]
      let answer = Infinity
      for (const reply of answered) answer = Math.min(answer, placementValue(reply.state, belief, card.instanceId))
      scores.push(answer)
      weights.push(world.weight)
    }
    const mixed = mixRisk(scores, weights, riskOf(profile))
    if (mixed > bestScore) {
      best = card
      bestScore = mixed
    }
  }
  return best
}
