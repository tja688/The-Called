import { BattleAggregate } from '../domain/battle/BattleAggregate'
import type { Cell } from '../domain/geometry'
import { STARTING_DECKS } from '../content/decks'
import { GameService } from '../application/GameService'
import type { DeckId } from '../domain/types'

export const DECK_A = [...STARTING_DECKS['DK.A'].cards]

/** 多塞几张占场，避免开局抽空后被无牌可出误杀。 */
export function fat(deck: string[], pad = 8): string[] {
  return [...deck, ...Array(pad).fill('PC.N01')]
}

export function startBattle(
  encounterId = 'MON.N01',
  deck: string[] = DECK_A,
  extra: { avatarDefId?: string; avatarBase?: number; mapEffect?: string; relic?: boolean; seed?: number } = {},
) {
  return BattleAggregate.start({
    encounterId,
    deck: [...deck],
    seed: extra.seed ?? 1,
    avatarDefId: extra.avatarDefId ?? 'PC.A00',
    avatarBase: extra.avatarBase,
    mapEffect: extra.mapEffect,
    relicFirstOccupy: extra.relic,
    shuffleDeck: false,
  })
}

export function handByDef(agg: BattleAggregate, defId: string) {
  return agg.state.hand.map((id) => agg.state.cards[id]).find((c) => c.defId === defId)
}

export function boardByDef(agg: BattleAggregate, defId: string) {
  return Object.values(agg.state.cards).find((c) => c.defId === defId && c.zone === 'board')
}

export function playDef(agg: BattleAggregate, defId: string, cell?: Cell, targetDef?: string, target2Def?: string) {
  const card = agg.state.hand.map((id) => agg.state.cards[id]).find((c) => c.defId === defId && (defId.endsWith('00') ? c.isAvatar : true))
    ?? agg.state.hand.map((id) => agg.state.cards[id]).find((c) => c.isAvatar && (defId === 'PC.A00' || defId === 'PC.B00' || defId === 'PC.C00'))
  if (!card) throw new Error(`手里没有 ${defId}`)
  let target: string | undefined
  let target2: string | undefined
  if (targetDef) {
    const t = boardByDef(agg, targetDef) ?? agg.state.discard.map((id) => agg.state.cards[id]).find((c) => c.defId === targetDef)
    if (!t) throw new Error(`场上没有 ${targetDef}`)
    target = t.id
  }
  if (target2Def) {
    const t = boardByDef(agg, target2Def)
    if (!t) throw new Error(`场上没有 ${target2Def}`)
    target2 = t.id
  }
  return agg.playerPlay(card.id, cell, target, target2)
}

export function avatar(agg: BattleAggregate) {
  return Object.values(agg.state.cards).find((c) => c.isAvatar)!
}

export async function startRun(deckId: DeckId = 'DK.A', seed = 1): Promise<GameService> {
  const game = new GameService()
  await game.dispatch({ type: 'run.start', seed, deckId })
  return game
}
