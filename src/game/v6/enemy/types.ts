/** 敌方意图看到的纯数据盘面。不引用战斗内核。 */

export type CellIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type CellOwner = 'player' | 'enemy' | 'empty'

export interface IntentCell {
  index: CellIndex
  /** 空格为 null。 */
  cardName: string | null
  owner: CellOwner
  currentPower: number
  basePower: number
  sealed: boolean
  /** 解析标记。 */
  marked: boolean
  /** 保护。 */
  protected: boolean
  /**
   * 覆盖门槛。null 表示没有。
   * 有门槛时，攻击方当前点数必须大于等于这个数，这次覆盖才合法。
   */
  coverThreshold: number | null
}

export interface IntentBoard {
  cells: readonly IntentCell[]
}

/** 本回合要打出的那一张意图牌。点数用调用方算好的当前点数。 */
export interface IntentPlay {
  cardName: string
  monsterId: string
  currentPower: number
  /** 占场卡才会落格。法术为 false，直接跳过落位。 */
  occupies: boolean
}

/** 返回 [0, 1) 的可复现随机数。本模块不调用 Math.random。 */
export type IntentRng = () => number

export interface TargetQuery {
  side: 'player' | 'enemy'
  /** 设了就要求解析标记等于该值。 */
  marked?: boolean
  /** 当前点数上限，包含等于。 */
  maxPower?: number
  /** false 排除有保护的牌；true 只留有保护的；省略则不看保护。 */
  protected?: boolean
  /** 只在这个格子的正交相邻里选。 */
  adjacentTo?: CellIndex
  /** 在合法目标里均匀随机。必须同时传入 rng。 */
  random?: boolean
}

export function emptyCell(index: CellIndex): IntentCell {
  return {
    index,
    cardName: null,
    owner: 'empty',
    currentPower: 0,
    basePower: 0,
    sealed: false,
    marked: false,
    protected: false,
    coverThreshold: null,
  }
}
