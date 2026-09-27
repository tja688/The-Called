import { describe, expect, it } from 'vitest'
import { chooseCardTarget, choosePlacement, chooseTarget, emptyCell } from './index'
import type { CellIndex, IntentBoard, IntentCell, IntentPlay } from './types'

function board(patches: Array<Partial<IntentCell> & { index: CellIndex }>): IntentBoard {
  const cells = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((index) => emptyCell(index))
  for (const patch of patches) {
    cells[patch.index - 1] = { ...emptyCell(patch.index), ...patch, index: patch.index }
  }
  return { cells }
}

function play(patch: Partial<IntentPlay> & Pick<IntentPlay, 'cardName' | 'monsterId'>): IntentPlay {
  return { currentPower: 4, occupies: true, ...patch }
}

function player(index: CellIndex, currentPower: number, extra: Partial<IntentCell> = {}): Partial<IntentCell> & { index: CellIndex } {
  return { index, cardName: '斥候', owner: 'player', currentPower, basePower: currentPower, ...extra }
}

function enemy(index: CellIndex, cardName: string, currentPower: number): Partial<IntentCell> & { index: CellIndex } {
  return { index, cardName, owner: 'enemy', currentPower, basePower: currentPower }
}

describe('通用落位', () => {
  it('空格里选与玩家牌相邻最多的，并列取格号最小', () => {
    const cells = board([player(2, 3), player(4, 3)])
    expect(choosePlacement(cells, play({ cardName: '弱点采样机', monsterId: 'runaway-machine' }))).toBe(1)
  })

  it('封印的玩家牌仍然算相邻', () => {
    const cells = board([player(5, 4, { sealed: true })])
    expect(choosePlacement(cells, play({ cardName: '弱点采样机', monsterId: 'runaway-machine' }))).toBe(2)
  })

  it('满盘时覆盖点数最高的合法目标，点数相等也合法，并列取格号最小', () => {
    const cells = board([
      player(1, 2),
      enemy(2, '古镜', 4),
      player(3, 5),
      enemy(4, '古镜', 4),
      enemy(5, '古镜', 4),
      player(6, 5),
      enemy(7, '古镜', 4),
      enemy(8, '古镜', 4),
      player(9, 8),
    ])
    expect(choosePlacement(cells, play({ cardName: '弱点采样机', monsterId: 'runaway-machine', currentPower: 5 }))).toBe(3)
  })

  it('覆盖门槛挡住低于门槛的覆盖，等于门槛且点数够则可以覆盖', () => {
    const blocked = board([
      enemy(1, '古镜', 1),
      player(2, 3, { coverThreshold: 8 }),
      enemy(3, '古镜', 1),
      enemy(4, '古镜', 1),
      player(5, 9),
      enemy(6, '古镜', 1),
      enemy(7, '古镜', 1),
      enemy(8, '古镜', 1),
      enemy(9, '古镜', 1),
    ])
    expect(choosePlacement(blocked, play({ cardName: '钻心器', monsterId: 'rust-colossus', currentPower: 4 }))).toBeNull()
    expect(choosePlacement(blocked, play({ cardName: '钻心器', monsterId: 'rust-colossus', currentPower: 8 }))).toBe(2)

    const equalButBelow = board([
      ...([1, 2, 3, 4, 6, 7, 8, 9] as const).map((index) => enemy(index, '古镜', 1)),
      player(5, 4, { coverThreshold: 4 }),
    ])
    expect(choosePlacement(equalButBelow, play({ cardName: '弱点采样机', monsterId: 'runaway-machine', currentPower: 4 }))).toBe(5)
    expect(choosePlacement(equalButBelow, play({ cardName: '弱点采样机', monsterId: 'runaway-machine', currentPower: 3 }))).toBeNull()
  })

  it('没有空格也没有合法覆盖时跳过', () => {
    const full = board(([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((index) => player(index, 9)))
    expect(choosePlacement(full, play({ cardName: '弱点采样机', monsterId: 'runaway-machine', currentPower: 4 }))).toBeNull()
    const alliesOnly = board(([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((index) => enemy(index, '古镜', 1)))
    expect(choosePlacement(alliesOnly, play({ cardName: '弱点采样机', monsterId: 'runaway-machine', currentPower: 9 }))).toBeNull()
  })

  it('法术不占格，直接跳过', () => {
    expect(choosePlacement(board([]), play({ cardName: '思考', monsterId: 'runaway-machine', occupies: false }))).toBeNull()
  })
})

describe('覆盖优先', () => {
  const mixed = board([enemy(4, '古镜', 3), player(8, 6)])

  it('锈蚀巨像三张和穿甲钻头先覆盖点数最高的合法目标', () => {
    for (const cardName of ['钻心器', '霸占者', '过载电池'] as const) {
      expect(choosePlacement(mixed, play({ cardName, monsterId: 'rust-colossus', currentPower: 6 }))).toBe(8)
    }
    expect(choosePlacement(mixed, play({ cardName: '穿甲钻头', monsterId: 'bell-warden', currentPower: 6 }))).toBe(8)
    expect(choosePlacement(mixed, play({ cardName: '弱点采样机', monsterId: 'runaway-machine', currentPower: 6 }))).toBe(5)
  })

  it('覆盖不合法时改走空格', () => {
    expect(choosePlacement(mixed, play({ cardName: '钻心器', monsterId: 'rust-colossus', currentPower: 1 }))).toBe(5)
    const gated = board([player(8, 2, { coverThreshold: 10 })])
    expect(choosePlacement(gated, play({ cardName: '过载电池', monsterId: 'rust-colossus', currentPower: 9 }))).toBe(5)
  })
})

describe('专属落位', () => {
  it('镜匠落在最高点数玩家牌的镜像空格，不满足则通用落位', () => {
    const open = board([player(1, 10)])
    expect(choosePlacement(open, play({ cardName: '镜匠', monsterId: 'mirror-person', currentPower: 4 }))).toBe(9)
    expect(choosePlacement(open, play({ cardName: '弱点采样机', monsterId: 'runaway-machine', currentPower: 4 }))).toBe(2)

    const tied = board([player(1, 6), player(3, 6)])
    expect(choosePlacement(tied, play({ cardName: '镜匠', monsterId: 'mirror-person' }))).toBe(7)

    const blocked = board([player(1, 10), enemy(9, '古镜', 4)])
    expect(choosePlacement(blocked, play({ cardName: '镜匠', monsterId: 'mirror-person' }))).toBe(2)
  })

  it('计时器沿用最高点数玩家牌的镜像空格', () => {
    const open = board([player(1, 10)])
    expect(choosePlacement(open, play({ cardName: '计时器', monsterId: 'bell-warden' }))).toBe(9)
  })

  it('银镜只看最高己方牌的镜像，星盘和双生子可以用任意己方镜像空格', () => {
    const cells = board([enemy(2, '古镜', 9), enemy(1, '镜影', 2), player(8, 3)])
    expect(choosePlacement(cells, play({ cardName: '银镜', monsterId: 'mirror-person' }))).toBe(5)
    expect(choosePlacement(cells, play({ cardName: '星盘', monsterId: 'mirror-witch' }))).toBe(9)
    expect(choosePlacement(cells, play({ cardName: '双生子', monsterId: 'mirror-person' }))).toBe(9)
  })

  it('告解神父落在最高点数玩家牌的正交相邻空格，没有则通用落位', () => {
    const cells = board([player(1, 10), player(6, 1), player(8, 1), player(9, 1)])
    expect(choosePlacement(cells, play({ cardName: '告解神父', monsterId: 'silent-order' }))).toBe(2)
    expect(choosePlacement(cells, play({ cardName: '驱魔人', monsterId: 'silent-order' }))).toBe(5)

    const crowded = board([
      player(1, 10),
      enemy(2, '缄默刑柱', 5),
      enemy(4, '缄默刑柱', 5),
      player(6, 1),
      player(8, 1),
      player(9, 1),
    ])
    expect(choosePlacement(crowded, play({ cardName: '告解神父', monsterId: 'silent-order' }))).toBe(5)
  })

  it('夺舍者优先打在点数最高的己方镜影上，没有镜影则通用落位', () => {
    const shades = board([enemy(4, '镜影', 3), enemy(8, '镜影', 7)])
    expect(choosePlacement(shades, play({ cardName: '夺舍者', monsterId: 'mirror-witch', currentPower: 4 }))).toBe(8)
    const tied = board([enemy(6, '镜影', 4), enemy(2, '镜影', 4)])
    expect(choosePlacement(tied, play({ cardName: '夺舍者', monsterId: 'mirror-witch' }))).toBe(2)
    const noShade = board([enemy(2, '双生镜', 5)])
    expect(choosePlacement(noShade, play({ cardName: '夺舍者', monsterId: 'mirror-witch' }))).toBe(1)
  })

  it('黑镜只落在自身和镜像都空的格子里，取相邻玩家最多的', () => {
    const cells = board([player(5, 4), enemy(6, '双生镜', 3), enemy(8, '双生镜', 3)])
    expect(choosePlacement(cells, play({ cardName: '黑镜', monsterId: 'mirror-witch' }))).toBe(1)
    expect(choosePlacement(cells, play({ cardName: '弱点采样机', monsterId: 'runaway-machine' }))).toBe(2)

    const noPair = board([player(2, 4), enemy(9, '双生镜', 3), ...([3, 4, 6, 7, 8] as const).map((index) => enemy(index, '双生镜', 1))])
    expect(choosePlacement(noPair, play({ cardName: '黑镜', monsterId: 'mirror-witch' }))).toBe(1)
  })

  it('圣殿守卫优先落在大钟的正交相邻空格', () => {
    const cells = board([enemy(2, '大钟', 6), player(7, 1), player(8, 1), player(9, 1)])
    expect(choosePlacement(cells, play({ cardName: '圣殿守卫', monsterId: 'bell-warden' }))).toBe(1)
    expect(choosePlacement(cells, play({ cardName: '弱点采样机', monsterId: 'runaway-machine' }))).toBe(4)
  })

  it('攻击炮台只有解剖学家走相邻最少，呼唤者的圣女同样走相邻最少', () => {
    const cells = board([player(5, 4)])
    expect(choosePlacement(cells, play({ cardName: '攻击炮台', monsterId: 'anatomist', currentPower: 6 }))).toBe(1)
    expect(choosePlacement(cells, play({ cardName: '攻击炮台', monsterId: 'runaway-machine', currentPower: 6 }))).toBe(2)
    expect(choosePlacement(cells, play({ cardName: '激光扫描仪', monsterId: 'anatomist' }))).toBe(1)
    expect(choosePlacement(cells, play({ cardName: '大审判长', monsterId: 'silent-order' }))).toBe(1)
    expect(choosePlacement(cells, play({ cardName: '圣女', monsterId: 'the-caller' }))).toBe(1)
    expect(choosePlacement(cells, play({ cardName: '彼岸花', monsterId: 'the-caller' }))).toBe(1)

    const full = board(([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((index) => (index === 3 ? player(3, 2) : enemy(index, '解剖台', 5))))
    expect(choosePlacement(full, play({ cardName: '攻击炮台', monsterId: 'anatomist', currentPower: 6 }))).toBe(3)
  })
})

describe('目标选择', () => {
  it('作用于玩家牌时取当前点数最高，并列取格号最小', () => {
    const cells = board([player(6, 4), player(2, 4), player(9, 1)])
    expect(chooseTarget(cells, { side: 'player' })).toBe(2)
    expect(chooseTarget(cells, { side: 'enemy' })).toBeNull()
  })

  it('作用于己方增益时取己方当前点数最高，并列取格号最小', () => {
    const cells = board([enemy(6, '古镜', 4), enemy(2, '古镜', 4), enemy(9, '古镜', 1)])
    expect(chooseTarget(cells, { side: 'enemy' })).toBe(2)
  })

  it('审判官不选有保护的牌，全部受保护则返回空', () => {
    const cells = board([
      player(2, 8, { protected: true }),
      player(4, 5),
      player(7, 5),
      player(9, 3),
    ])
    expect(chooseCardTarget(cells, '审判官')).toBe(4)
    expect(chooseCardTarget(board([player(2, 9, { protected: true })]), '审判官')).toBeNull()
  })

  it('收容钳只选有标记且当前点数不超过 3 的，驱魔人只看点数', () => {
    const cells = board([
      player(1, 2, { marked: true }),
      player(3, 4, { marked: true }),
      player(5, 1),
      player(6, 3, { marked: true }),
      player(8, 3, { marked: true, protected: true }),
    ])
    expect(chooseCardTarget(cells, '收容钳')).toBe(6)
    expect(chooseCardTarget(board([player(3, 4, { marked: true }), player(5, 1)]), '收容钳')).toBeNull()
    expect(chooseCardTarget(board([player(1, 4), player(2, 3), player(9, 1)]), '驱魔人')).toBe(2)
    expect(chooseCardTarget(cells, '斥候')).toBeNull()
  })

  it('卡面写随机时用传入的随机函数，在合法目标中均匀选择', () => {
    const cells = board([player(4, 2), player(9, 8)])
    expect(chooseTarget(cells, { side: 'player', random: true }, () => 0)).toBe(4)
    expect(chooseTarget(cells, { side: 'player', random: true }, () => 0.99)).toBe(9)
    expect(chooseTarget(cells, { side: 'player', random: true }, () => 1)).toBe(9)
    expect(chooseTarget(board([]), { side: 'player', random: true }, () => 0)).toBeNull()
    expect(() => chooseTarget(cells, { side: 'player', random: true })).toThrow(/rng/)
  })
})
