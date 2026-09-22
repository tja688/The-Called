import type { RngState } from '../../core/Rng'
import type { BattleOutcome, BattlePhase, CardKind, CardStatus, SettleReason, Side, Zone } from '../types'
import type { Cell } from '../geometry'

export interface DeckEntry {
  defId: string
  basePoints: number
  boxUid?: string
}

export interface CardInst {
  id: string
  defId: string
  owner: Side
  kind: CardKind
  zone: Zone
  cell?: Cell
  basePoints: number
  permanent: number
  statuses: CardStatus[]
  isAvatar: boolean
  boxUid?: string
  timer?: number
  timerMax?: number
  linkId?: string
}

export interface BattleResult {
  outcome: BattleOutcome
  reason: SettleReason
  avatarCost: number
}

export interface BattleState {
  encounterId: string
  boss: boolean
  rng: RngState
  nextId: number
  cards: Record<string, CardInst>
  board: (string | null)[]
  hand: string[]
  deck: DeckEntry[]
  discard: string[]
  enemyDiscard: string[]
  occupy: number
  occupyCap: number
  resA: number
  goldDelta: number
  burnedUids: string[]
  firstOccupyDone: boolean
  activated: boolean
  relicFirstOccupy: boolean
  mapEffect?: string
  initialAvatar: number
  turn: number
  phase: BattlePhase
  opening: boolean
  result?: BattleResult
}

export function emptyBoard(): (string | null)[] {
  return [null, null, null, null, null, null, null, null, null, null]
}

export function isSealed(card: CardInst): boolean {
  return card.statuses.includes('sealed')
}

export function hasStatus(card: CardInst, status: CardStatus): boolean {
  return card.statuses.includes(status)
}

export function boardCards(state: BattleState): CardInst[] {
  const out: CardInst[] = []
  for (let i = 1; i <= 9; i++) {
    const id = state.board[i]
    if (id) out.push(state.cards[id])
  }
  return out
}

export function avatarOf(state: BattleState): CardInst | undefined {
  return Object.values(state.cards).find((c) => c.isAvatar)
}

export function cardAt(state: BattleState, cell: number): CardInst | undefined {
  const id = state.board[cell]
  return id ? state.cards[id] : undefined
}

export function isGone(card: CardInst): boolean {
  return card.zone === 'gone'
}
