import { cardDef } from '../../content/cards'
import { isCorner, type Cell, CELLS } from '../../domain/geometry'
import { currentPoints, finalPoints, woundEstimate } from '../../domain/battle/points'
import { avatarOf, cardAt, type BattleState } from '../../domain/battle/state'
import type { BattlePhase, CardStatus, Side, Zone } from '../../domain/types'
import type { EncounterId } from '../../domain/types'
import type { BattleResult } from '../../domain/battle/state'

export interface CardView {
  id: string
  defId: string
  name: string
  owner: Side
  kind: 'occupy' | 'spell'
  zone: Zone
  cell?: Cell
  basePoints: number
  currentPoints: number
  sealed: boolean
  isAvatar: boolean
  statuses: CardStatus[]
}

export interface CellView {
  id: Cell
  card?: string
  corner: boolean
  shadowActive: boolean
}

export interface BattleView {
  encounterId: EncounterId
  cells: CellView[]
  cards: Record<string, CardView>
  hand: string[]
  deckLeft: number
  discardCount: number
  mana: number
  manaCap: number
  playerFinal: number
  enemyFinal: number
  leading: boolean
  turn: number
  opening: boolean
  phase: BattlePhase
  avatar: { onBoard: boolean; current: number; woundEstimate: number }
  mustPlaceAvatar: boolean
  canEndTurn: boolean
  result?: BattleResult
}

export function toBattleView(state: BattleState, mustPlaceAvatar: boolean, canEndTurn: boolean): BattleView {
  const cards: Record<string, CardView> = {}
  for (const inst of Object.values(state.cards)) {
    cards[inst.id] = {
      id: inst.id,
      defId: inst.defId,
      name: cardDef(inst.defId).name,
      owner: inst.owner,
      kind: inst.kind,
      zone: inst.zone,
      cell: inst.cell,
      basePoints: inst.basePoints,
      currentPoints: currentPoints(state, inst),
      sealed: inst.statuses.includes('sealed'),
      isAvatar: inst.isAvatar,
      statuses: [...inst.statuses],
    }
  }
  const av = avatarOf(state)
  return {
    encounterId: state.encounterId,
    cells: CELLS.map((id) => {
      const inst = cardAt(state, id)
      const corner = isCorner(id)
      return { id, card: inst?.id, corner, shadowActive: corner && !!inst }
    }),
    cards,
    hand: [...state.hand],
    deckLeft: state.deck.length,
    discardCount: state.discard.length,
    mana: state.mana,
    manaCap: state.manaCap,
    playerFinal: finalPoints(state, 'player'),
    enemyFinal: finalPoints(state, 'enemy'),
    leading: state.leading,
    turn: state.turn,
    opening: state.opening,
    phase: state.phase,
    avatar: {
      onBoard: !!av && av.zone === 'board',
      current: av ? currentPoints(state, av) : 0,
      woundEstimate: woundEstimate(state),
    },
    mustPlaceAvatar,
    canEndTurn,
    result: state.result,
  }
}
