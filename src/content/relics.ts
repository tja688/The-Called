import type { Rarity } from '../domain/types'

export interface RelicDef {
  id: string
  name: string
  text: string
  rarity: Rarity
  price: number
}

export const RELICS: Record<string, RelicDef> = {
  'RL.01': {
    id: 'RL.01',
    name: 'RL.01',
    text: '每场战斗玩家打出的第一张占场卡点数+2。化身不是占场。',
    rarity: 'white',
    price: 90,
  },
}

export function relicDef(id: string): RelicDef {
  const def = RELICS[id]
  if (!def) throw new Error(`Unknown relic: ${id}`)
  return def
}

export function relicPool(): RelicDef[] {
  return Object.values(RELICS)
}
