import type { RngState } from '../../core/Rng'
import type { BattlePhase, BattleOutcome, CardKind, CardStatus, SettleReason, Side, Zone } from '../types'
import type { Cell } from '../geometry'
import type { EncounterId } from '../types'

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
}

export interface BattleResult {
  outcome: BattleOutcome
  reason: SettleReason
  wound: number
}

export interface BattleState {
  encounterId: EncounterId
  rng: RngState
  nextId: number
  cards: Record<string, CardInst>
  board: (string | null)[]
  hand: string[]
  deck: string[]
  discard: string[]
  exile: string[]
  mana: number
  manaCap: number
  turn: number
  phase: BattlePhase
  opening: boolean
  leading: boolean
  result?: BattleResult
}

export function emptyBoard(): (string | null)[] {
  return [null, null, null, null, null, null, null, null, null, null]
}

export function isSealed(card: CardInst): boolean {
  return card.statuses.includes('sealed')
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
