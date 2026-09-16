import { BattleAggregate } from '../domain/battle/BattleAggregate'
import type { EncounterId } from '../domain/types'
import { AVATAR_ID } from '../content/cards'
import type { Cell } from '../domain/geometry'

export const ECHO = ['P05', 'P02', 'P01', 'P01', 'P06', 'P03', 'P04', 'P07', 'P02', 'P01']

export function startBattle(encounterId: EncounterId, deck = ECHO, handDelta = 0) {
  return BattleAggregate.start({ encounterId, deck: [...deck], seed: 1, handDelta })
}

export function handByDef(agg: BattleAggregate, defId: string) {
  return agg.state.hand.map((id) => agg.state.cards[id]).find((c) => c.defId === defId)
}

export function boardByDef(agg: BattleAggregate, defId: string) {
  return Object.values(agg.state.cards).find((c) => c.defId === defId && c.zone === 'board')
}

export function playDef(agg: BattleAggregate, defId: string, cell?: Cell, targetDef?: string) {
  const card = defId === AVATAR_ID
    ? agg.state.hand.map((id) => agg.state.cards[id]).find((c) => c.isAvatar)
    : handByDef(agg, defId)
  if (!card) throw new Error(`手里没有 ${defId}`)
  let target: string | undefined
  if (targetDef) {
    const t = boardByDef(agg, targetDef)
    if (!t) throw new Error(`场上没有 ${targetDef}`)
    target = t.id
  }
  return agg.playerPlay(card.id, cell, target)
}

export function avatar(agg: BattleAggregate) {
  return Object.values(agg.state.cards).find((c) => c.isAvatar)!
}
