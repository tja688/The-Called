export type OwnerKind = 'player' | 'enemyOnly' | 'token'

export type RuleKind = 'permanent' | 'spell'

export type NameKind = 'person' | 'object' | 'concept' | 'token'

export type School = 'science' | 'mystery' | 'religion' | 'neutral'

export type Rarity = 'white' | 'blue' | 'gold'

export type CardOrigin =
  | 'existing'
  | 'intent'
  | 'extra'
  | 'starterOrShop'
  | 'enemyOnly'
  | 'token'

export type CardPool = 'playable' | 'excluded'

export type PowerSource = 'generator'

export type BoardCell = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type MonsterTier = 'intro' | 'tier1' | 'tier2' | 'elite' | 'boss' | 'final'

export interface CardDefinition {
  id: string
  name: string
  ownerKind: OwnerKind
  ruleKind: RuleKind
  nameKind: NameKind
  basePower: number | null
  powerFrom?: PowerSource
  school: School | null
  rarity: Rarity | null
  effectText: string
  timing: string
  target: string
  origin: CardOrigin
  keywords: string[]
  pool: CardPool
  orphan: boolean
  notes?: string
}

export interface MonsterPreset {
  cell: BoardCell
  cardName: string
}

export interface MonsterDefinition {
  id: string
  name: string
  tier: MonsterTier
  elLabel: string
  skills: string[]
  presets: MonsterPreset[]
  pollutedCells: number[]
  intents: string[]
  placement: string
  rewardGold: number
  rewardCardNames: string[]
  rewardHugeCardBack: boolean
}
