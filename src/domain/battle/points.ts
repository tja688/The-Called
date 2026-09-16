import { ANCHORS } from '../../content/anchors'
import { cardDef } from '../../content/cards'
import { isCorner } from '../geometry'
import type { Side } from '../types'
import { avatarOf, boardCards, isSealed, type BattleState, type CardInst } from './state'

function auraBonus(state: BattleState, card: CardInst): number {
  if (card.zone !== 'board' || !card.cell) return 0
  let bonus = 0
  for (const other of boardCards(state)) {
    if (other.id === card.id || isSealed(other)) continue
    const aura = cardDef(other.defId).aura
    if (aura?.do === 'buffRowEnemies' && card.owner === 'enemy') {
      const row = Math.floor((card.cell - 1) / 3)
      if (row === aura.row) bonus += aura.amount
    }
  }
  return bonus
}

function mapBonus(card: CardInst): number {
  if (card.zone !== 'board' || !card.cell) return 0
  return isCorner(card.cell) ? ANCHORS.shadowCorner : 0
}

export function avatarFloorValue(state: BattleState): number | undefined {
  let floor: number | undefined
  for (const c of boardCards(state)) {
    if (c.owner !== 'player' || isSealed(c)) continue
    const aura = cardDef(c.defId).aura
    if (aura?.do === 'avatarFloor') floor = Math.max(floor ?? 0, aura.floor)
  }
  return floor
}

export function incomingReduction(state: BattleState): number {
  let n = 0
  for (const c of boardCards(state)) {
    if (c.owner !== 'player' || isSealed(c)) continue
    const aura = cardDef(c.defId).aura
    if (aura?.do === 'reduceAvatarIncoming') n += aura.amount
  }
  return n
}

/** 当前点数。封印的牌仍用这个数做覆盖判定。 */
export function currentPoints(state: BattleState, card: CardInst): number {
  if (card.kind !== 'occupy') return 0
  let p = Math.max(0, card.basePoints + card.permanent + auraBonus(state, card) + mapBonus(card))
  if (card.isAvatar) {
    const floor = avatarFloorValue(state)
    if (floor !== undefined) p = Math.max(p, floor)
  }
  return p
}

/** 一方最终点数：未封印战场占场的当前点数之和。 */
export function finalPoints(state: BattleState, side: Side): number {
  let sum = 0
  for (const c of boardCards(state)) {
    if (c.owner !== side || c.kind !== 'occupy' || isSealed(c)) continue
    sum += currentPoints(state, c)
  }
  return sum
}

export function isLeading(state: BattleState): boolean {
  return finalPoints(state, 'player') > finalPoints(state, 'enemy')
}

export function woundEstimate(state: BattleState): number {
  const av = avatarOf(state)
  if (!av || av.zone !== 'board') return av ? 0 : ANCHORS.avatarBase
  return Math.max(0, ANCHORS.avatarBase - currentPoints(state, av))
}
