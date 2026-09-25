import { getCardDefinition } from '../../config/cardCatalog'
import type { DeckConfig } from '../../config/decks'
import { beginnerMatchRules, type MatchRules } from '../../config/matchRules'
import type { BoardCell, CardInstance, CellId, DepartingCard, MatchState, PlayCardAction, PlayResolution, PlayResult, Side } from '../types'
import { createBoard, getMirrorCell, getOrthogonalNeighbors } from './spatial'

const otherSide = (side: Side): Side => side === 'player' ? 'monster' : 'player'

function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function buildDeck(config: DeckConfig, owner: Side, random: () => number) {
  let copy = 0
  const cards = config.cards.flatMap(({ cardId, count }) => Array.from({ length: count }, () => {
    copy += 1
    const definition = getCardDefinition(cardId)
    return { instanceId: `${owner}-${cardId}-${copy}`, cardId, owner, currentPower: definition.power }
  }))
  return shuffle(cards, random)
}

function drawOpeningHand(deck: CardInstance[], count: number) {
  return { hand: deck.slice(0, count), deck: deck.slice(count) }
}

export function createMatch(
  levelId: string,
  monsterId: string,
  playerDeck: DeckConfig,
  monsterDeck: DeckConfig,
  random: () => number = Math.random,
  rules: MatchRules = beginnerMatchRules,
): MatchState {
  const playerCards = drawOpeningHand(buildDeck(playerDeck, 'player', random), rules.openingHandSize)
  const monsterCards = drawOpeningHand(buildDeck(monsterDeck, 'monster', random), rules.openingHandSize)
  return {
    levelId, monsterId, turn: rules.playerStarts ? 'player' : 'monster', round: 1, status: 'playing',
    board: createBoard(),
    player: { ...playerCards, turnsTaken: 0 },
    monster: { ...monsterCards, turnsTaken: 0 },
    finalBattle: false,
    openingTurn: false,
    result: null,
    message: rules.playerStarts ? '你的回合：选择一张牌。' : '怪物正在思考。',
    graveyard: [],
  }
}

export const finalBattleMessage = '终局之战。回合开始时，点数更高的一方获胜。'

export function getBoardPower(state: MatchState, side: Side) {
  return state.board.reduce((total, cell) => total + (cell.card?.owner === side ? cell.card.currentPower : 0), 0)
}

export function canPlaceCard(state: MatchState, card: CardInstance, cell: BoardCell, rules: MatchRules = beginnerMatchRules) {
  if (!cell.card) return true
  if (cell.card.owner === card.owner) return false
  return rules.equalPowerCanCover ? card.currentPower >= cell.card.currentPower : card.currentPower > cell.card.currentPower
}

function adjacentCells(board: BoardCell[], cellId: CellId) {
  const ids = new Set(getOrthogonalNeighbors(cellId))
  return board.filter((cell) => ids.has(cell.id))
}

function onOuterRing(index: number, boardSize: number) {
  return index === 0 || index === boardSize - 1
}

function positionConditionMet(board: BoardCell[], placedCell: BoardCell, condition: string, rules: MatchRules) {
  const owner = placedCell.card?.owner
  const neighbors = adjacentCells(board, placedCell.id)
  const center = (rules.boardSize - 1) / 2
  if (condition === 'edge') return onOuterRing(placedCell.row, rules.boardSize) || onOuterRing(placedCell.col, rules.boardSize)
  if (condition === 'corner') return onOuterRing(placedCell.row, rules.boardSize) && onOuterRing(placedCell.col, rules.boardSize)
  if (condition === 'center') return placedCell.row === center && placedCell.col === center
  if (condition === 'isolated') return neighbors.every((cell) => cell.card?.owner !== owner)
  if (condition === 'adjacent_friendly') return neighbors.some((cell) => cell.card?.owner === owner)
  return neighbors.some((cell) => cell.card && cell.card.owner !== owner)
}

function resolveEntryEffect(board: BoardCell[], cellId: CellId, coveredEnemy: boolean, rules: MatchRules) {
  const placedCell = board.find((cell) => cell.id === cellId)
  if (!placedCell?.card) return
  const definition = getCardDefinition(placedCell.card.cardId)
  const effect = definition.effect
  const owner = placedCell.card.owner
  const enemy = otherSide(owner)
  if (effect.type === 'self_power_on_cover' && coveredEnemy) placedCell.card.currentPower += effect.amount
  if (effect.type === 'adjacent_power_change') {
    const targetOwner = effect.target === 'friendly' ? owner : enemy
    for (const cell of adjacentCells(board, cellId)) {
      if (cell.card?.owner === targetOwner) {
        cell.card.currentPower = Math.max(rules.minimumPower, cell.card.currentPower + effect.amount)
      }
    }
  }
  if (effect.type === 'self_power_if_position' && positionConditionMet(board, placedCell, effect.condition, rules)) {
    placedCell.card.currentPower += effect.amount
  }
  if (effect.type === 'mirror') {
    const mirrorId = getMirrorCell(cellId)
    if (mirrorId !== cellId) {
      const mirror = board.find((cell) => cell.id === mirrorId)
      if (effect.affect === 'self' && mirror?.card) placedCell.card.currentPower += effect.amount
      if (effect.affect === 'enemy' && mirror?.card?.owner === enemy) {
        mirror.card.currentPower = Math.max(rules.minimumPower, mirror.card.currentPower + effect.amount)
      }
    }
  }
  if (effect.type === 'line') {
    const targetOwner = effect.target === 'friendly' ? owner : enemy
    for (const cell of board) {
      if (cell.id === cellId || cell.card?.owner !== targetOwner) continue
      const aligned = effect.axis === 'row' ? cell.row === placedCell.row : cell.col === placedCell.col
      if (!aligned) continue
      cell.card.currentPower = Math.max(rules.minimumPower, cell.card.currentPower + effect.amount)
    }
  }
  if (effect.type === 'edge_tax') {
    for (const cell of board) {
      if (cell.card?.owner !== enemy) continue
      if (!onOuterRing(cell.row, rules.boardSize) && !onOuterRing(cell.col, rules.boardSize)) continue
      cell.card.currentPower = Math.max(rules.minimumPower, cell.card.currentPower + effect.amount)
    }
  }
  if (effect.type === 'self_power_if_count') {
    const side = effect.side === 'friendly' ? owner : enemy
    const count = board.reduce((total, cell) => total + (cell.card?.owner === side ? 1 : 0), 0)
    if (count >= effect.minimum) placedCell.card.currentPower += effect.amount
  }
}

function controlledCells(state: MatchState, side: Side) {
  return state.board.reduce((total, cell) => total + (cell.card?.owner === side ? 1 : 0), 0)
}

function hasLegalMove(state: MatchState, side: Side, rules: MatchRules) {
  return state[side].hand.some((card) => state.board.some((cell) => canPlaceCard(state, card, cell, rules)))
}

function finishMatch(state: MatchState, winner: Side | 'draw') {
  const playerPower = getBoardPower(state, 'player')
  const monsterPower = getBoardPower(state, 'monster')
  state.result = { winner, playerPower, monsterPower }
  state.status = 'finished'
  state.openingTurn = false
  state.message = winner === 'player' ? '你赢了！' : winner === 'monster' ? '怪物获胜。' : '平局。'
}

function winnerByExhaustion(state: MatchState, rules: MatchRules): Side | 'draw' {
  const playerPower = getBoardPower(state, 'player')
  const monsterPower = getBoardPower(state, 'monster')
  if (playerPower !== monsterPower) return playerPower > monsterPower ? 'player' : 'monster'
  const playerCells = controlledCells(state, 'player')
  const monsterCells = controlledCells(state, 'monster')
  if (playerCells !== monsterCells) return playerCells > monsterCells ? 'player' : 'monster'
  return rules.tieResult
}

function removeSpentCards(state: MatchState): DepartingCard[] {
  const removed: DepartingCard[] = []
  state.graveyard ??= []
  for (const cell of state.board) {
    if (!cell.card || cell.card.currentPower > 0) continue
    const buried = cell.coveredCards ?? []
    removed.push({ cellId: cell.id, card: { ...cell.card } })
    for (const card of [cell.card, ...buried]) state.graveyard.push({ ...card })
    cell.card = null
    cell.coveredCards = []
  }
  return removed
}

export function passTurn(state: MatchState, rules: MatchRules = beginnerMatchRules): MatchState {
  if (state.status !== 'playing' || state.openingTurn) return state
  const next = structuredClone(state)
  advanceTurn(next, rules)
  return next
}

function canDrawLater(state: MatchState, side: Side, rules: MatchRules) {
  const pile = state[side]
  return pile.deck.length > 0 && pile.hand.length < rules.handLimit && (rules.drawOnFirstTurn || pile.turnsTaken > 0)
}

/**
 * A side with no legal cell passes. If the other side also cannot play, and
 * neither side will draw another card, the match ends on Power, then cells,
 * then the rules' tie result. A full board still goes through final battle.
 */
export function resolveIdleTurn(state: MatchState, rules: MatchRules = beginnerMatchRules): MatchState {
  if (state.status !== 'playing' || state.openingTurn) return state
  if (hasLegalMove(state, state.turn, rules)) return state
  const passed = passTurn(state, rules)
  if (passed.status !== 'playing' || (passed.finalBattle && passed.openingTurn)) return passed
  const next = passed.turn
  const previous = otherSide(next)
  const nobodyPlays = !hasLegalMove(passed, next, rules) && !hasLegalMove(passed, previous, rules)
  const nobodyDraws = !canDrawLater(passed, next, rules) && !canDrawLater(passed, previous, rules)
  if (!nobodyPlays || !nobodyDraws) return passed
  const finished = structuredClone(passed)
  finishMatch(finished, winnerByExhaustion(finished, rules))
  return finished
}

function advanceTurn(state: MatchState, rules: MatchRules) {
  const current = state[state.turn]
  current.turnsTaken += 1
  const nextSide = otherSide(state.turn)
  const next = state[nextSide]
  const shouldDraw = rules.drawOnFirstTurn || next.turnsTaken > 0
  if (shouldDraw && next.hand.length < rules.handLimit && next.deck.length > 0) {
    next.hand.push(next.deck.shift()!)
  } else if (shouldDraw && rules.fullHandDraw === 'discard' && next.deck.length > 0) {
    next.deck.shift()
  }
  state.turn = nextSide
  state.round += 1
  if (state.finalBattle) {
    state.openingTurn = true
    state.message = finalBattleMessage
    return
  }
  state.message = nextSide === 'player' ? '你的回合：选择一张牌。' : '怪物正在思考。'
}

export function resolveFinalBattleTurn(state: MatchState, rules: MatchRules = beginnerMatchRules): MatchState {
  if (state.status !== 'playing' || !state.finalBattle || !state.openingTurn) return state
  const next = structuredClone(state)
  const opponent = otherSide(next.turn)
  if (getBoardPower(next, next.turn) > getBoardPower(next, opponent)) {
    finishMatch(next, next.turn)
    return next
  }
  if (hasLegalMove(next, next.turn, rules)) {
    next.openingTurn = false
    return next
  }
  if (hasLegalMove(next, opponent, rules)) {
    advanceTurn(next, rules)
    return next
  }
  finishMatch(next, winnerByExhaustion(next, rules))
  return next
}

export function playCard(state: MatchState, action: PlayCardAction, rules: MatchRules = beginnerMatchRules): PlayResult {
  if (state.status !== 'playing') return { state, error: 'MATCH_FINISHED' }
  if (state.finalBattle && state.openingTurn) return { state, error: 'TURN_OPENING' }
  if (state.turn !== action.side) return { state, error: 'NOT_YOUR_TURN' }
  const sideState = state[action.side]
  const handIndex = sideState.hand.findIndex((card) => card.instanceId === action.cardInstanceId)
  if (handIndex < 0) return { state, error: 'CARD_NOT_IN_HAND' }
  const card = sideState.hand[handIndex]
  const cell = state.board.find((candidate) => candidate.id === action.cellId)
  if (!cell || !canPlaceCard(state, card, cell, rules)) return { state, error: 'INVALID_PLACEMENT' }

  const next = structuredClone(state)
  next.graveyard ??= []
  const nextSide = next[action.side]
  const played = nextSide.hand.splice(handIndex, 1)[0]
  const nextCell = next.board.find((candidate) => candidate.id === action.cellId)!
  const coveredEnemy = Boolean(nextCell.card && nextCell.card.owner !== action.side)
  // A covered card remains physically in its board cell. Only the top card
  // controls placement, effects, and scoring.
  if (coveredEnemy && nextCell.card) {
    // Normalize old development-session cells as well as newly created cells.
    // This keeps a hot-reloaded match from falling back to the retired discard path.
    nextCell.coveredCards ??= []
    nextCell.coveredCards.push(nextCell.card)
  }
  nextCell.card = played
  resolveEntryEffect(next.board, action.cellId, coveredEnemy, rules)
  let resolution: PlayResolution = { removed: [] }
  if (coveredEnemy && nextCell.card) {
    const covered = nextCell.coveredCards[nextCell.coveredCards.length - 1]
    const fromPower = nextCell.card.currentPower
    const subtract = covered.currentPower
    const toPower = Math.max(rules.minimumPower, fromPower - subtract)
    nextCell.card.currentPower = toPower
    if (subtract > 0) {
      resolution = {
        cover: { cellId: action.cellId, cardInstanceId: nextCell.card.instanceId, fromPower, subtract, toPower },
        removed: [],
      }
    }
  }
  resolution = { ...resolution, removed: removeSpentCards(next) }

  const enteringFinalBattle = rules.fullBoardStartsFinalBattle && !next.finalBattle && next.board.every((boardCell) => boardCell.card)
  advanceTurn(next, rules)
  if (enteringFinalBattle) {
    next.finalBattle = true
    next.openingTurn = true
    next.message = finalBattleMessage
  }
  return { state: next, resolution }
}
