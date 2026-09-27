import { getCardByName } from '../../content'
import type { Rarity } from '../../content'

const RARITY_LABEL: Record<Rarity, string> = {
  white: '白',
  blue: '蓝',
  gold: '金',
}

/** 牌面只给名称、点数、稀有度和效果。不包含负荷。 */
export interface CardLine {
  index: number
  name: string
  power: number | null
  rarity: Rarity | null
  rarityLabel: string
  effectText: string
}

export function cardLine(name: string, index: number): CardLine {
  const card = getCardByName(name)
  const rarity = card?.rarity ?? null
  return {
    index,
    name,
    power: card?.basePower ?? null,
    rarity,
    rarityLabel: rarity ? RARITY_LABEL[rarity] : '',
    effectText: card?.effectText ?? '',
  }
}
