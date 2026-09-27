import { enemyCards } from './enemy'
import { mysteryCards } from './mystery'
import { monsters } from './monsters'
import { neutralCards } from './neutral'
import { religionCards } from './religion'
import { scienceCards } from './science'
import { scienceStarter } from './starter'
import type { CardDefinition, MonsterDefinition } from './types'

export type {
  BoardCell,
  CardDefinition,
  CardOrigin,
  CardPool,
  MonsterDefinition,
  MonsterPreset,
  MonsterTier,
  NameKind,
  OwnerKind,
  PowerSource,
  Rarity,
  RuleKind,
  School,
} from './types'

export const allCards: CardDefinition[] = [
  ...scienceCards,
  ...mysteryCards,
  ...religionCards,
  ...neutralCards,
  ...enemyCards,
]

export const allMonsters: MonsterDefinition[] = monsters

export { scienceStarter }

const cardsByName = new Map<string, CardDefinition>(allCards.map((card) => [card.name, card]))
const monstersById = new Map<string, MonsterDefinition>(allMonsters.map((monster) => [monster.id, monster]))

export function getCardByName(name: string): CardDefinition | undefined {
  return cardsByName.get(name)
}

export function getMonster(id: string): MonsterDefinition | undefined {
  return monstersById.get(id)
}
