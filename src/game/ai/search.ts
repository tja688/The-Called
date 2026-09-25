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
/** CPU time kept on one animation frame. The rest of the search continues next frame. */
export const THINK_SLICE_MS = 6

type Budget = { nodes: number; spent: number; mark: number; sliceEnd: number; sliceMs: number }
type TableEntry = { depth: number; score: number; flag: 'exact' | 'lower' | 'upper' }

function openBudget(sliceMs: number): Budget {
  const now = performance.now()
  return { nodes: 0, spent: 0, mark: now, sliceEnd: now + sliceMs, sliceMs }
}

/** True when the hard budget is spent. Yields once when this frame's slice is spent. */
function* gate(budget: Budget): Generator<void, boolean> {
  const now = performance.now()
  budget.spent += now - budget.mark
  budget.mark = now
  if (budget.nodes >= NODE_LIMIT || budget.spent >= HARD_MS) return true
  if (now < budget.sliceEnd) return false
  yield
  const resumed = performance.now()
  budget.mark = resumed
  budget.sliceEnd = resumed + budget.sliceMs
  return false
}

export function collectSearch<T>(gen: Generator<void, T>): T {
  let step = gen.next()
  while (!step.done) step = gen.next()
  return step.value
}

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

function* minimax(
  state: MatchState,
  belief: OpponentBelief,
  depth: number,
  alpha: number,
  beta: number,
  budget: Budget,
  table: Map<string, TableEntry>,
  lockedInstanceId?: string,
): Generator<void, number> {
  const settled = settle(state)
  if (settled.status === 'finished' || (yield* gate(budget))) return evaluateForMonster(settled, belief)
  if (depth <= 0) return yield* quiesce(settled, belief, alpha, beta, QUIET_PLIES, budget, table)

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
  if (moves.length === 0) return yield* passValue(settled, belief, depth, alpha, beta, budget, table, lockedInstanceId)

  const maximizing = settled.turn === 'monster'
  let best = maximizing ? -Infinity : Infinity
  let flag: TableEntry['flag'] = 'exact'
  for (const move of moves) {
    const nextLock = settled.turn === 'monster' ? undefined : lockedInstanceId
    const score = yield* minimax(move.state, belief, depth - 1, alpha, beta, budget, table, nextLock)
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

function* passValue(
  state: MatchState,
  belief: OpponentBelief,
  depth: number,
  alpha: number,
  beta: number,
  budget: Budget,
  table: Map<string, TableEntry>,
  lockedInstanceId?: string,
): Generator<void, number> {
  const passed = resolveIdleTurn(state)
  if (passed === state || passed.turn === state.turn) return evaluateForMonster(state, belief)
  return yield* minimax(passed, belief, depth - 1, alpha, beta, budget, table, lockedInstanceId)
}

function* quiesce(
  state: MatchState,
  belief: OpponentBelief,
  alpha: number,
  beta: number,
  quiet: number,
  budget: Budget,
  table: Map<string, TableEntry>,
): Generator<void, number> {
  const settled = settle(state)
  if (settled.status === 'finished') return evaluateForMonster(settled, belief)
  const stand = evaluateForMonster(settled, belief)
  if (quiet <= 0 || (yield* gate(budget))) return stand
  budget.nodes += 1
  const moves = readyMoves(settled, undefined, 8).filter((move) => isTactical(settled, move.state))
  if (settled.turn === 'monster') {
    let best = stand
    alpha = Math.max(alpha, best)
    for (const move of moves) {
      best = Math.max(best, yield* quiesce(move.state, belief, alpha, beta, quiet - 1, budget, table))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = stand
  beta = Math.min(beta, best)
  for (const move of moves) {
    best = Math.min(best, yield* quiesce(move.state, belief, alpha, beta, quiet - 1, budget, table))
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

function* worldScore(
  observation: MonsterObservation,
  world: BeliefWorld,
  belief: OpponentBelief,
  move: PlayCardAction,
  depth: number,
  budget: Budget,
  table: Map<string, TableEntry>,
): Generator<void, number | null> {
  const hypo = hypotheticalState(observation, world)
  const result = playCard(hypo, move)
  if (result.error) return null
  return yield* minimax(result.state, belief, depth - 1, -Infinity, Infinity, budget, table)
}

export function* searchMonsterAction(
  state: MatchState,
  profile: MonsterAiProfile,
  lockedInstanceId: string | undefined,
  sliceMs: number,
): Generator<void, PlayCardAction | null> {
  if (state.status !== 'playing' || state.turn !== 'monster' || state.openingTurn) return null
  const observation = observeMonster(state)
  const legal = readyMoves(hypotheticalState(observation, { hand: [], deck: [], weight: 1 }), lockedInstanceId)
  if (legal.length === 0) return null
  if (legal.length === 1) return legal[0].action

  const belief = createOpponentBelief(state, profile.opponentDeck)
  const budget = openBudget(sliceMs)
  const table = new Map<string, TableEntry>()
  let best = legal[0].action
  let bestScore = -Infinity
  const maxDepth = depthFor(state)

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (depth > 1 && (yield* gate(budget))) break
    let depthBest = best
    let depthScore = -Infinity
    let depthImmediate = -Infinity
    let depthTie = -Infinity
    let complete = true
    for (const move of legal) {
      if (depth > 1 && (yield* gate(budget))) {
        complete = false
        break
      }
      const scores: number[] = []
      const weights: number[] = []
      let worldsCut = false
      for (const world of belief.worlds) {
        if (yield* gate(budget)) {
          worldsCut = true
          break
        }
        const score = yield* worldScore(observation, world, belief, move.action, depth, budget, table)
        if (score === null) continue
        scores.push(score)
        weights.push(world.weight)
      }
      if (worldsCut) {
        complete = false
        break
      }
      if (scores.length === 0) continue
      const mixed = mixRisk(scores, weights, riskOf(profile))
      const immediate = evaluateForMonster(move.state, belief)
      const placed = move.state.board.find((cell) => cell.id === move.action.cellId)?.card
      const tie = tieBreak(move.action.cellId, placed)
      const better = mixed > depthScore
        || (mixed === depthScore && (immediate > depthImmediate || (immediate === depthImmediate && tie > depthTie)))
      if (better) {
        depthBest = move.action
        depthScore = mixed
        depthImmediate = immediate
        depthTie = tie
      }
    }
    if (!complete) break
    best = depthBest
    bestScore = depthScore
  }
  return bestScore === -Infinity ? legal[0].action : best
}

export function selectMonsterAction(
  state: MatchState,
  profile: MonsterAiProfile,
  lockedInstanceId?: string,
): PlayCardAction | null {
  return collectSearch(searchMonsterAction(state, profile, lockedInstanceId, Number.POSITIVE_INFINITY))
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
export function* searchMonsterIntent(
  state: MatchState,
  profile: MonsterAiProfile,
  sliceMs: number,
): Generator<void, CardInstance | null> {
  if (state.status !== 'playing' || state.turn !== 'player' || state.openingTurn) return null
  const cards = state.monster.hand
  if (cards.length === 0) return null
  const belief = createOpponentBelief(state, profile.opponentDeck)
  const observation = observeMonster(state)
  const budget = openBudget(sliceMs)
  let best = cards[0]
  let bestScore = -Infinity
  const seen = new Set<string>()

  for (const card of cards) {
    if (bestScore > -Infinity && (yield* gate(budget))) break
    const signature = `${card.cardId}:${card.currentPower}`
    if (seen.has(signature)) continue
    seen.add(signature)
    const scores: number[] = []
    const weights: number[] = []
    let cut = false
    for (const world of belief.worlds) {
      if (yield* gate(budget)) {
        cut = true
        break
      }
      const hypo = hypotheticalState(observation, world)
      const replies = readyMoves(hypo, undefined, INTENT_REPLIES)
      const answered = replies.length > 0 ? replies : [{ state: resolveIdleTurn(hypo) }]
      let answer = Infinity
      for (const reply of answered) {
        if (yield* gate(budget)) {
          cut = true
          break
        }
        answer = Math.min(answer, placementValue(reply.state, belief, card.instanceId))
      }
      if (cut) break
      if (answer === Infinity) continue
      scores.push(answer)
      weights.push(world.weight)
    }
    if (scores.length > 0) {
      const mixed = mixRisk(scores, weights, riskOf(profile))
      if (mixed > bestScore) {
        best = card
        bestScore = mixed
      }
    }
    if (cut) break
  }
  return best
}

export function chooseMonsterIntent(state: MatchState, profile: MonsterAiProfile): CardInstance | null {
  return collectSearch(searchMonsterIntent(state, profile, Number.POSITIVE_INFINITY))
}
