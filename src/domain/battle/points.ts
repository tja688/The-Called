import { cardDef } from '../../content/cards'
import { mapEffectDef } from '../../content/mapEffects'
import { ADJACENT, DIAG_ADJ, MIRROR, cellCol, cellRow, isCorner, type Cell } from '../geometry'
import type { Side } from '../types'
import { isBodyKind } from '../types'
import type { AuraShare } from './events'
import { avatarOf, boardCards, cardAt, isSealed, type BattleState, type CardInst } from './state'

/** 变化之后、这张卡身上每一条驻场贡献。与 auraBonus 同口径。 */
export function auraContributions(state: BattleState, card: CardInst): AuraShare[] {
  if (card.zone !== 'board' || !card.cell) return []
  const out: AuraShare[] = []
  for (const other of boardCards(state)) {
    if (other.id === card.id || isSealed(other)) continue
    for (const aura of cardDef(other.defId).auras ?? []) {
      if (aura.aura === 'adjacentAllies' && other.owner === card.owner && ADJACENT[other.cell as Cell].includes(card.cell)) {
        out.push({ card: other.id, defId: other.defId, n: aura.n })
      }
      if (aura.aura === 'mirrorAlly' && other.owner === card.owner && MIRROR[other.cell as Cell] === card.cell) {
        out.push({ card: other.id, defId: other.defId, n: aura.n })
      }
      if (aura.aura === 'columnOpponents' && other.owner !== card.owner && cellCol(other.cell!) === cellCol(card.cell)) {
        out.push({ card: other.id, defId: other.defId, n: aura.n })
      }
      if (aura.aura === 'rowOpponents' && other.owner !== card.owner && cellRow(other.cell!) === cellRow(card.cell)) {
        out.push({ card: other.id, defId: other.defId, n: aura.n })
      }
      if (aura.aura === 'diagOpponents' && other.owner !== card.owner && DIAG_ADJ[other.cell as Cell].includes(card.cell)) {
        out.push({ card: other.id, defId: other.defId, n: aura.n })
      }
    }
  }
  const self = cardDef(card.defId)
  if (!isSealed(card)) {
    for (const aura of self.auras ?? []) {
      if (aura.aura === 'perAdjacentOpponent') {
        const n = ADJACENT[card.cell as Cell].filter((c) => {
          const t = cardAt(state, c)
          return t && t.owner !== card.owner
        }).length
        if (n) out.push({ card: card.id, defId: card.defId, n: aura.n * n })
      }
      if (aura.aura === 'mirrorOpponentCurrent') {
        const m = MIRROR[card.cell as Cell]
        if (m) {
          const t = cardAt(state, m)
          if (t && t.owner !== card.owner) {
            const pts = currentPointsRaw(state, t, true)
            if (pts) out.push({ card: t.id, defId: t.defId, n: pts })
          }
        }
      }
    }
  }
  return out
}

function auraBonus(state: BattleState, card: CardInst): number {
  return auraContributions(state, card).reduce((sum, a) => sum + a.n, 0)
}

function mapBonus(state: BattleState, card: CardInst): number {
  if (card.zone !== 'board' || !card.cell || !state.mapEffect) return 0
  const me = mapEffectDef(state.mapEffect)
  if (me.kind === 'adjacentAlly') {
    return ADJACENT[card.cell as Cell].filter((c) => {
      const t = cardAt(state, c)
      return t && t.owner === card.owner
    }).length
  }
  if (me.kind === 'corner' && isCorner(card.cell)) return 1
  if (me.kind === 'centerMinus' && card.cell === 5) return -2
  if (me.kind === 'fullRow') {
    const row = cellRow(card.cell)
    const cells = [row * 3 + 1, row * 3 + 2, row * 3 + 3] as Cell[]
    if (cells.every((c) => cardAt(state, c)?.owner === card.owner)) return 3
  }
  if (me.kind === 'isolated') {
    const empty = ADJACENT[card.cell as Cell].every((c) => !cardAt(state, c))
    if (empty) return 3
  }
  if (me.kind === 'diagEnemy') {
    const hit = DIAG_ADJ[card.cell as Cell].some((c) => {
      const t = cardAt(state, c)
      return t && t.owner !== card.owner
    })
    if (hit) return -2
  }
  return 0
}

export function mapShare(state: BattleState, card: CardInst): { id: string; n: number } | null {
  if (!state.mapEffect) return null
  const n = mapBonus(state, card)
  if (!n) return null
  return { id: state.mapEffect, n }
}

function currentPointsRaw(state: BattleState, card: CardInst, skipMirror = false): number {
  if (!isBodyKind(card.kind)) return 0
  let p = card.basePoints + card.permanent
  if (card.zone === 'board' && card.cell) {
    p += skipMirror ? 0 : auraBonus(state, card)
    p += mapBonus(state, card)
  }
  return Math.max(0, p)
}

/** 当前点数。封印的牌仍用这个数做覆盖判定。手牌没有地图/驻场。 */
export function currentPoints(state: BattleState, card: CardInst): number {
  return currentPointsRaw(state, card, false)
}

/** 一方总点数：未封印战场身体的当前点数之和。 */
export function finalPoints(state: BattleState, side: Side): number {
  let sum = 0
  for (const c of boardCards(state)) {
    if (c.owner !== side || !isBodyKind(c.kind) || isSealed(c)) continue
    sum += currentPoints(state, c)
  }
  return sum
}

export function isLeading(state: BattleState): boolean {
  return finalPoints(state, 'player') > finalPoints(state, 'enemy')
}

export function avatarCostOf(state: BattleState): number {
  const av = avatarOf(state)
  const now = av && av.zone === 'board' ? currentPoints(state, av) : 0
  return Math.max(0, state.initialAvatar - now)
}

export function fenceBlocks(state: BattleState, cell: Cell, side: Side): boolean {
  for (const n of ADJACENT[cell]) {
    const c = cardAt(state, n)
    if (!c || isSealed(c) || c.owner === side) continue
    if ((cardDef(c.defId).auras ?? []).some((a) => a.aura === 'fence')) return true
  }
  return false
}

export function markedMoveBlocked(state: BattleState, card: CardInst): boolean {
  if (!card.statuses.includes('marked')) return false
  return boardCards(state).some((c) => {
    if (c.owner === card.owner || isSealed(c)) return false
    return (cardDef(c.defId).auras ?? []).some((a) => a.aura === 'blockMarkedMove')
  })
}
