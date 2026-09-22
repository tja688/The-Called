import { CELLS } from '../domain/geometry'
import { CARDS, cardDef, isRewardable, playerCardIds } from './cards'
import { ENCOUNTERS, openingBaseOf, poolFor } from './encounters'
import { STARTING_DECKS } from './decks'
import { EVENTS } from './events'
import { MAP_EFFECTS } from './mapEffects'
import { RELICS } from './relics'

export function validateContent(): void {
  const ids = Object.keys(CARDS)
  if (new Set(ids).size !== ids.length) throw new Error('Card ID 不唯一')

  const players = playerCardIds()
  if (players.length !== 39) throw new Error(`玩家卡应为 39 张，实际 ${players.length}`)

  for (const deck of Object.values(STARTING_DECKS)) {
    if (deck.cards.length !== 10) throw new Error(`${deck.id} 不是 10 张`)
    for (const id of deck.cards) cardDef(id)
    const av = cardDef(deck.avatar)
    if (av.kind !== 'avatar') throw new Error(`${deck.id} 化身不是化身卡`)
    if (deck.cards.includes(deck.avatar)) throw new Error(`${deck.id} 化身进了牌组`)
  }

  for (const enc of Object.values(ENCOUNTERS)) {
    const used = new Set<number>()
    for (const slot of enc.setup) {
      cardDef(slot.defId)
      if (!CELLS.includes(slot.cell)) throw new Error(`${enc.id} 非法格 ${slot.cell}`)
      if (used.has(slot.cell)) throw new Error(`${enc.id} 格 ${slot.cell} 重复`)
      used.add(slot.cell)
    }
    const got = openingBaseOf(enc.setup)
    if (got !== enc.openingBase) throw new Error(`${enc.id} 开局基础点 ${got} ≠ ${enc.openingBase}`)
  }

  const layer1 = {
    normal: ['MON.N01', 'MON.N02', 'MON.N04', 'MON.N05', 'MON.N06'],
    elite: ['MON.E01'],
    boss: ['MON.B01'],
  }
  for (const floor of [1, 2, 3] as const) {
    for (const tier of ['normal', 'elite', 'boss'] as const) {
      const got = poolFor(tier, floor).map((e) => e.id).sort().join()
      const want = [...layer1[tier]].sort().join()
      if (got !== want) throw new Error(`第 ${floor} 层${tier}池应为 ${want}，实际 ${got}`)
    }
  }

  for (const ev of Object.values(EVENTS)) {
    if (!ev.options.length) throw new Error(`${ev.id} 没有选项`)
  }
  for (const me of Object.values(MAP_EFFECTS)) {
    if (!me.floors.length) throw new Error(`${me.id} 没有层`)
  }
  if (!RELICS['RL.01']) throw new Error('缺少 RL.01')

  for (const id of rewardableIdsCheck()) {
    const def = cardDef(id)
    if (def.rarity === 'basic' || def.extra === 'negative') throw new Error(`${id} 不应进奖励池`)
  }
}

function rewardableIdsCheck(): string[] {
  return Object.values(CARDS).filter((c) => isRewardable(c.id)).map((c) => c.id)
}
