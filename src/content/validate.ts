import { CELLS, cellRow, isCorner } from '../domain/geometry'
import { ANCHORS } from './anchors'
import { CARDS, ECHO_DECK, cardDef } from './cards'
import { ENCOUNTERS } from './encounters'
import { YU_ZHUANG_POOL, BO_SHOU_POOL } from './rewards'

function openingFinal(setup: { defId: string; cell: number }[]): number {
  let sum = 0
  for (const slot of setup) {
    const def = cardDef(slot.defId)
    let p = def.basePoints
    if (isCorner(slot.cell)) p += ANCHORS.shadowCorner
    for (const other of setup) {
      if (other.cell === slot.cell) continue
      const aura = cardDef(other.defId).aura
      if (aura?.do === 'buffRowEnemies' && cellRow(slot.cell) === aura.row) p += aura.amount
    }
    sum += Math.max(0, p)
  }
  return sum
}

/** 启动校验：ID 唯一、引用存在、开局点数对得上锚点、残响不是 0 张。 */
export function validateContent(): void {
  const ids = Object.keys(CARDS)
  if (new Set(ids).size !== ids.length) throw new Error('Card ID 不唯一')
  if (ECHO_DECK.length < 1) throw new Error('牌组不能编成 0')
  for (const id of ECHO_DECK) cardDef(id)

  for (const enc of Object.values(ENCOUNTERS)) {
    const used = new Set<number>()
    for (const slot of enc.setup) {
      cardDef(slot.defId)
      if (!CELLS.includes(slot.cell)) throw new Error(`${enc.id} 非法格 ${slot.cell}`)
      if (used.has(slot.cell)) throw new Error(`${enc.id} 格 ${slot.cell} 重复`)
      used.add(slot.cell)
    }
    const got = openingFinal(enc.setup)
    if (got !== enc.openingFinal) {
      throw new Error(`${enc.id} 开局点数 ${got} ≠ 锚点 ${enc.openingFinal}`)
    }
  }

  for (const id of [...YU_ZHUANG_POOL, ...BO_SHOU_POOL, 'EV01']) cardDef(id)
}
