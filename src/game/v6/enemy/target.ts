import { CELL_INDEXES, cellAt, isSide, orthogonal, readBoard } from './grid'
import type { CellIndex, IntentBoard, IntentCell, IntentRng, TargetQuery } from './types'

/**
 * 卡面写了更窄条件的目标。
 * 审判官不选有保护的。收容钳只要有标记且当前点数不超过 3。
 * 驱魔人只要当前点数不超过 3。其余牌由调用方用 chooseTarget 传入合法条件。
 */
const NAMED_TARGET: Record<string, TargetQuery> = {
  审判官: { side: 'player', protected: false },
  收容钳: { side: 'player', marked: true, maxPower: 3 },
  驱魔人: { side: 'player', maxPower: 3 },
  /** 敌方打出：当前点数最高的玩家牌。并列由 chooseTarget 取最小格号。 */
  弱点采样机: { side: 'player' },
  /** 敌方打出，或敌方的攻击炮台回合结束：只在有标记的玩家牌里取最高点数。没有则空。 */
  弱点攻击器: { side: 'player', marked: true },
  攻击炮台: { side: 'player', marked: true },
}

/**
 * 在合法目标里选一格。
 * 默认取当前点数最高，并列取格号最小。
 * query.random 为真时，用 rng 在合法目标里均匀随机。
 * 没有合法目标返回 null。
 */
export function chooseTarget(board: IntentBoard, query: TargetQuery, rng?: IntentRng): CellIndex | null {
  const legal = legalTargets(readBoard(board), query)
  if (legal.length === 0) return null
  if (query.random) {
    if (!rng) throw new Error('chooseTarget: random selection requires an rng')
    const offset = Math.min(legal.length - 1, Math.floor(rng() * legal.length))
    return legal[offset]?.index ?? null
  }
  let best = legal[0]
  if (!best) return null
  for (const cell of legal) {
    if (cell.currentPower > best.currentPower) best = cell
  }
  return best.index
}

/** 按卡名套用更窄的目标条件。没有这条规则的卡返回 null，不另选。 */
export function chooseCardTarget(board: IntentBoard, cardName: string, rng?: IntentRng): CellIndex | null {
  const query = NAMED_TARGET[cardName]
  if (!query) return null
  return chooseTarget(board, query, rng)
}

function legalTargets(map: Map<CellIndex, IntentCell>, query: TargetQuery): IntentCell[] {
  const adjacent = query.adjacentTo === undefined ? null : new Set(orthogonal(query.adjacentTo))
  const legal: IntentCell[] = []
  for (const index of CELL_INDEXES) {
    const cell = cellAt(map, index)
    if (!isSide(cell, query.side)) continue
    if (query.marked !== undefined && cell.marked !== query.marked) continue
    if (query.maxPower !== undefined && cell.currentPower > query.maxPower) continue
    if (query.protected === false && cell.protected) continue
    if (query.protected === true && !cell.protected) continue
    if (adjacent && !adjacent.has(index)) continue
    legal.push(cell)
  }
  return legal
}
