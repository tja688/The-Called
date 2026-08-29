import { getCardDefinition } from '../../config/cardCatalog'
import type { DeckConfig } from '../../config/decks'
import { beginnerMatchRules, type MatchRules } from '../../config/matchRules'
import type { BoardCell, CardInstance, CellId, MatchResult, MatchState, PlayCardAction, PlayResult, Side } from '../types'
import { createBoard, getOrthogonalNeighbors } from './spatial'

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
    result: null,
    message: rules.playerStarts ? '你的回合：选择一张牌。' : '怪物正在思考。',
  }
}

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

function resolveEntryEffect(board: BoardCell[], cellId: CellId, coveredEnemy: boolean, rules: MatchRules) {
  const placedCell = board.find((cell) => cell.id === cellId)
  if (!placedCell?.card) return
  const definition = getCardDefinition(placedCell.card.cardId)
  const effect = definition.effect
  if (effect.type === 'self_power_on_cover' && coveredEnemy) placedCell.card.currentPower += effect.amount
  if (effect.type === 'adjacent_power_change') {
    const targetOwner = effect.target === 'friendly' ? placedCell.card.owner : otherSide(placedCell.card.owner)
    for (const cell of adjacentCells(board, cellId)) {
      if (cell.card?.owner === targetOwner) {
        cell.card.currentPower = Math.max(rules.minimumPower, cell.card.currentPower + effect.amount)
      }
    }
  }
  if (effect.type !== 'self_power_if_position') return

  const neighbors = adjacentCells(board, cellId)
  const isEdge = placedCell.row === 0 || placedCell.col === 0
    || placedCell.row === beginnerMatchRules.boardSize - 1 || placedCell.col === beginnerMatchRules.boardSize - 1
  const conditionMet = effect.condition === 'edge' ? isEdge
    : effect.condition === 'adjacent_friendly' ? neighbors.some((cell) => cell.card?.owner === placedCell.card?.owner)
      : neighbors.some((cell) => cell.card && cell.card.owner !== placedCell.card?.owner)
  if (conditionMet) placedCell.card.currentPower += effect.amount
}

function scoreMatch(state: MatchState, rules: MatchRules): MatchResult {
  const playerPower = getBoardPower(state, 'player')
  const monsterPower = getBoardPower(state, 'monster')
  let winner: MatchResult['winner'] = playerPower === monsterPower ? rules.tieResult : playerPower > monsterPower ? 'player' : 'monster'
  if (winner === 'player' || winner === 'monster' || winner === 'draw') return { winner, playerPower, monsterPower }
  winner = 'draw'
  return { winner, playerPower, monsterPower }
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
  state.message = nextSide === 'player' ? '你的回合：选择一张牌。' : '怪物正在思考。'
}

export function playCard(state: MatchState, action: PlayCardAction, rules: MatchRules = beginnerMatchRules): PlayResult {
  if (state.status !== 'playing') return { state, error: 'MATCH_FINISHED' }
  if (state.turn !== action.side) return { state, error: 'NOT_YOUR_TURN' }
  const sideState = state[action.side]
  const handIndex = sideState.hand.findIndex((card) => card.instanceId === action.cardInstanceId)
  if (handIndex < 0) return { state, error: 'CARD_NOT_IN_HAND' }
  const card = sideState.hand[handIndex]
  const cell = state.board.find((candidate) => candidate.id === action.cellId)
  if (!cell || !canPlaceCard(state, card, cell, rules)) return { state, error: 'INVALID_PLACEMENT' }

  const next = structuredClone(state)
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

  if (rules.fullBoardEndsMatch && next.board.every((boardCell) => boardCell.card)) {
    next.result = scoreMatch(next, rules)
    next.status = 'finished'
    // The engine owns the outcome, while the HUD owns the localized display
    // name of the configured opponent.
    next.message = next.result.winner === 'draw' ? '平局。' : next.result.winner === 'player' ? '你赢了！' : '怪物获胜。'
    return { state: next }
  }

  advanceTurn(next, rules)
  return { state: next }
}
