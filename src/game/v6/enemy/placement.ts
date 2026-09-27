import {
  CELL_INDEXES,
  adjacentPlayerCount,
  cellAt,
  isEmpty,
  isSide,
  minIndex,
  mirrorOf,
  orthogonal,
  readBoard,
} from './grid'
import type { CellIndex, IntentBoard, IntentCell, IntentPlay } from './types'

/**
 * 锈蚀巨像的三张，以及穿甲钻头。先覆盖，覆盖不了再空格。
 * 见设计规范 6.2、6.4。
 */
const COVER_FIRST = new Set(['钻心器', '霸占者', '过载电池', '穿甲钻头'])

/**
 * 选择这张意图落在哪一格。
 * 返回 null 表示没有合法格，调用方跳过这张牌。
 * 落在玩家牌上表示合法覆盖（点数大于或等于，且过了覆盖门槛）。
 * 落在己方「镜影」上只来自夺舍者，不是覆盖。
 */
export function choosePlacement(board: IntentBoard, play: IntentPlay): CellIndex | null {
  if (!play.occupies) return null
  const map = readBoard(board)
  const preferred = preferredCell(map, play)
  if (preferred !== undefined) return preferred
  if (COVER_FIRST.has(play.cardName)) return placeCoverFirst(map, play.currentPower)
  return placeGeneral(map, play.currentPower)
}

function placeGeneral(map: Map<CellIndex, IntentCell>, attackPower: number): CellIndex | null {
  return emptyByNeighbors(map, 'most') ?? legalCover(map, attackPower)
}

function placeCoverFirst(map: Map<CellIndex, IntentCell>, attackPower: number): CellIndex | null {
  return legalCover(map, attackPower) ?? emptyByNeighbors(map, 'most')
}

/**
 * 专属落位。返回 undefined 表示这条优先不满足，交给通用或覆盖优先。
 * 攻击炮台只有解剖学家走「相邻最少」；失控机械仍走通用。
 */
function preferredCell(map: Map<CellIndex, IntentCell>, play: IntentPlay): CellIndex | undefined {
  switch (play.cardName) {
    case '镜匠':
      return play.monsterId === 'mirror-person' ? mirrorOfHighest(map, 'player') : undefined
    case '银镜':
      return play.monsterId === 'mirror-person' ? mirrorOfHighest(map, 'enemy') : undefined
    case '双生子':
      return play.monsterId === 'mirror-person' ? anyAllyMirror(map) : undefined
    case '告解神父':
      return besideHighestPlayer(map)
    case '黑镜':
      return play.monsterId === 'mirror-witch' ? blackMirrorCell(map) : undefined
    case '夺舍者':
      return highestShade(map)
    case '星盘':
      return play.monsterId === 'mirror-witch' ? anyAllyMirror(map) : undefined
    case '圣殿守卫':
      return play.monsterId === 'bell-warden' ? besideBell(map) : undefined
    case '计时器':
      return play.monsterId === 'bell-warden' ? mirrorOfHighest(map, 'player') : undefined
    case '攻击炮台':
      return play.monsterId === 'anatomist' ? fewestEmpty(map) : undefined
    case '激光扫描仪':
      return play.monsterId === 'anatomist' ? fewestEmpty(map) : undefined
    case '大审判长':
      return play.monsterId === 'silent-order' ? fewestEmpty(map) : undefined
    case '彼岸花':
    case '圣女':
      return play.monsterId === 'the-caller' ? fewestEmpty(map) : undefined
    default:
      return undefined
  }
}

function fewestEmpty(map: Map<CellIndex, IntentCell>): CellIndex | undefined {
  return emptyByNeighbors(map, 'least') ?? undefined
}

function emptyByNeighbors(map: Map<CellIndex, IntentCell>, mode: 'most' | 'least'): CellIndex | null {
  let best: CellIndex | null = null
  let bestScore = 0
  for (const index of CELL_INDEXES) {
    if (!isEmpty(cellAt(map, index))) continue
    const score = adjacentPlayerCount(map, index)
    if (best === null || (mode === 'most' ? score > bestScore : score < bestScore)) {
      best = index
      bestScore = score
    }
  }
  return best
}

/**
 * 当前能被合法覆盖的玩家牌里，当前点数最高，并列取格号最小。
 * 点数大于和点数相等都合法。攻击方当前点数小于覆盖门槛则整次不合法。
 */
function legalCover(map: Map<CellIndex, IntentCell>, attackPower: number): CellIndex | null {
  let best: IntentCell | null = null
  for (const index of CELL_INDEXES) {
    const cell = cellAt(map, index)
    if (!canCover(cell, attackPower)) continue
    if (!best || cell.currentPower > best.currentPower) best = cell
  }
  return best?.index ?? null
}

function canCover(cell: IntentCell, attackPower: number): boolean {
  if (!isSide(cell, 'player')) return false
  if (cell.coverThreshold !== null && attackPower < cell.coverThreshold) return false
  return attackPower >= cell.currentPower
}

/** 点数最高的那一组牌（并列都算）的镜像空格。格 5 没有镜像。 */
function mirrorOfHighest(map: Map<CellIndex, IntentCell>, side: 'player' | 'enemy'): CellIndex | undefined {
  const tops = highestCells(occupied(map, side))
  const mirrors: CellIndex[] = []
  for (const cell of tops) {
    const mirror = mirrorOf(cell.index)
    if (mirror !== undefined && isEmpty(cellAt(map, mirror))) mirrors.push(mirror)
  }
  return minIndex(mirrors)
}

/** 任意己方牌的镜像空格，并列取格号最小。 */
function anyAllyMirror(map: Map<CellIndex, IntentCell>): CellIndex | undefined {
  const mirrors: CellIndex[] = []
  for (const cell of occupied(map, 'enemy')) {
    const mirror = mirrorOf(cell.index)
    if (mirror !== undefined && isEmpty(cellAt(map, mirror))) mirrors.push(mirror)
  }
  return minIndex(mirrors)
}

/** 点数最高的玩家牌的正交相邻空格，并列取格号最小。 */
function besideHighestPlayer(map: Map<CellIndex, IntentCell>): CellIndex | undefined {
  const empties: CellIndex[] = []
  for (const cell of highestCells(occupied(map, 'player'))) {
    for (const neighbor of orthogonal(cell.index)) {
      if (isEmpty(cellAt(map, neighbor))) empties.push(neighbor)
    }
  }
  return minIndex(empties)
}

function besideBell(map: Map<CellIndex, IntentCell>): CellIndex | undefined {
  const empties: CellIndex[] = []
  for (const index of CELL_INDEXES) {
    const bell = cellAt(map, index)
    if (bell.cardName !== '大钟' || isEmpty(bell)) continue
    for (const neighbor of orthogonal(index)) {
      if (isEmpty(cellAt(map, neighbor))) empties.push(neighbor)
    }
  }
  return minIndex(empties)
}

/**
 * 自身是空格，且镜像格也是空格。在这些格子里取与玩家牌相邻最多的，并列取格号最小。
 * 格 5 没有镜像，不参与。
 */
function blackMirrorCell(map: Map<CellIndex, IntentCell>): CellIndex | undefined {
  let best: CellIndex | undefined
  let bestScore = 0
  for (const index of CELL_INDEXES) {
    if (!isEmpty(cellAt(map, index))) continue
    const mirror = mirrorOf(index)
    if (mirror === undefined || !isEmpty(cellAt(map, mirror))) continue
    const score = adjacentPlayerCount(map, index)
    if (best === undefined || score > bestScore) {
      best = index
      bestScore = score
    }
  }
  return best
}

/** 己方镜影里当前点数最高的，并列取格号最小。 */
function highestShade(map: Map<CellIndex, IntentCell>): CellIndex | undefined {
  const shades = occupied(map, 'enemy').filter((cell) => cell.cardName === '镜影')
  return highestCells(shades)[0]?.index
}

function occupied(map: Map<CellIndex, IntentCell>, side: 'player' | 'enemy'): IntentCell[] {
  const cells: IntentCell[] = []
  for (const index of CELL_INDEXES) {
    const cell = cellAt(map, index)
    if (isSide(cell, side)) cells.push(cell)
  }
  return cells
}

/** 当前点数最高的全部格子，格号升序。没有牌则空数组。 */
function highestCells(cells: readonly IntentCell[]): IntentCell[] {
  let maxPower = Number.NEGATIVE_INFINITY
  for (const cell of cells) {
    if (cell.currentPower > maxPower) maxPower = cell.currentPower
  }
  return cells.filter((cell) => cell.currentPower === maxPower)
}
