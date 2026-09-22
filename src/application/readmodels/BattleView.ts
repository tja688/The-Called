import { cardDef } from '../../content/cards'
import { isCorner, type Cell, CELLS } from '../../domain/geometry'
import { currentPoints, finalPoints, avatarCostOf } from '../../domain/battle/points'
import { avatarOf, cardAt, type BattleState } from '../../domain/battle/state'
import type { BattlePhase, CardKind, CardStatus, Side, Zone } from '../../domain/types'
import type { BattleResult } from '../../domain/battle/state'

export interface CardView {
  id: string
  defId: string
  name: string
  owner: Side
  kind: CardKind
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
  encounterId: string
  cells: CellView[]
  cards: Record<string, CardView>
  hand: string[]
  deckLeft: number
  /** 还没抽到的牌。下标 0 是下一张，界面按名字汇总，不按这个顺序摆。 */
  deck: { defId: string; basePoints: number }[]
  discardCount: number
  enemyDiscardCount: number
  occupy: number
  occupyCap: number
  resA: number
  playerFinal: number
  enemyFinal: number
  leading: boolean
  turn: number
  opening: boolean
  phase: BattlePhase
  avatar: { onBoard: boolean; current: number; avatarCost: number }
  mustPlaceAvatar: boolean
  canEndTurn: boolean
  canActivate: boolean
  result?: BattleResult
}

export function toBattleView(
  state: BattleState,
  mustPlaceAvatar: boolean,
  canEndTurn: boolean,
  canActivate: boolean,
): BattleView {
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
    deck: state.deck.map((e) => ({ defId: e.defId, basePoints: e.basePoints })),
    discardCount: state.discard.length,
    enemyDiscardCount: state.enemyDiscard.length,
    occupy: state.occupy,
    occupyCap: state.occupyCap,
    resA: state.resA,
    playerFinal: finalPoints(state, 'player'),
    enemyFinal: finalPoints(state, 'enemy'),
    leading: finalPoints(state, 'player') > finalPoints(state, 'enemy'),
    turn: state.turn,
    opening: state.opening,
    phase: state.phase,
    avatar: {
      onBoard: !!av && av.zone === 'board',
      current: av ? currentPoints(state, av) : 0,
      avatarCost: avatarCostOf(state),
    },
    mustPlaceAvatar,
    canEndTurn,
    canActivate,
    result: state.result,
  }
}
