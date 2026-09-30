import { monsters, scenes, type MonsterConfig, type SceneConfig } from '../config/gameContent'
import { cellId, getCell } from '../game/core/spatial'
import type { CellId } from '../game/types'

export type RuleCell = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export function sceneCell(cell: RuleCell): CellId {
  const index = cell - 1
  return cellId(Math.floor(index / 3), index % 3)
}

export function ruleCell(id: CellId): RuleCell {
  const { row, col } = getCell(id)
  const value = row * 3 + col + 1
  if (value < 1 || value > 9) throw new Error(`Bad cell ${id}`)
  return value as RuleCell
}

export function monsterScene(monsterId: string, name: string): { monster: MonsterConfig; scene: SceneConfig } {
  return {
    monster: {
      id: monsterId,
      name,
      image: monsters.svarbhanu.image,
      visual: monsters.svarbhanu.visual,
    },
    scene: scenes.default,
  }
}
