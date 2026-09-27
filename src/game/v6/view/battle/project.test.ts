import { afterEach, describe, expect, it } from 'vitest'
import { clearPresentedCards, getCardDefinition } from '../../../../config/cardCatalog'
import { startRunawayEncounter } from '../../encounter'
import {
  boardArrivals,
  buriedUnder,
  openingLay,
  projectMatch,
  publishFaces,
  ruleCell,
  sceneCell,
} from './project'

afterEach(() => {
  clearPresentedCards()
})

describe('战斗画面投影', () => {
  it('九宫格与场景格子来回对应', () => {
    expect(sceneCell(1)).toBe('cell-0-0')
    expect(sceneCell(5)).toBe('cell-1-1')
    expect(sceneCell(9)).toBe('cell-2-2')
    expect(ruleCell('cell-1-1')).toBe(5)
    expect(ruleCell(sceneCell(8))).toBe(8)
  })

  it('开场预设先藏起来，铺上之后才出现在中心格', () => {
    const encounter = startRunawayEncounter(1)
    const lays = openingLay(encounter.match.battle)
    expect(lays.map((item) => item.cell)).toEqual([5])
    const hidden = new Set(lays.map((item) => item.instanceId))
    const waiting = projectMatch({
      battle: encounter.match.battle,
      monsterId: 'runaway-machine',
      hidden,
      turn: 'monster',
      over: false,
      winner: null,
    })
    expect(waiting.board.find((cell) => cell.id === 'cell-1-1')?.card).toBeNull()
    expect(waiting.player.hand.length).toBeGreaterThan(0)
    expect(waiting.player.deck.length).toBeGreaterThan(0)
    const shown = projectMatch({
      battle: encounter.match.battle,
      monsterId: 'runaway-machine',
      turn: 'player',
      over: false,
      winner: null,
    })
    expect(shown.board.find((cell) => cell.id === 'cell-1-1')?.card?.owner).toBe('monster')
  })

  it('新落到场上的牌算一次抵达，被盖住的旧牌还留在实例里', () => {
    const encounter = startRunawayEncounter(1)
    const battle = encounter.match.battle
    const before = { ...battle, cells: { ...battle.cells, 5: null } }
    const arrivals = boardArrivals(before, battle)
    expect(arrivals).toHaveLength(1)
    expect(arrivals[0]?.cell).toBe(5)
    const preset = battle.cells[5]
    expect(preset).toBeTruthy()
    const covered = {
      ...battle,
      cells: { ...battle.cells, 5: 'i-new' },
      instances: {
        ...battle.instances,
        'i-new': { ...battle.instances[preset!], instanceId: 'i-new' },
      },
    }
    expect(buriedUnder(battle, covered, 5)).toBe(preset)
    expect(buriedUnder(battle, battle, 5)).toBeNull()
  })

  it('场上的牌能画出名和点数', () => {
    const encounter = startRunawayEncounter(1)
    const lays = openingLay(encounter.match.battle)
    publishFaces([encounter.match.battle])
    const face = getCardDefinition(lays[0].instanceId)
    expect(face.name.length).toBeGreaterThan(0)
    expect(face.power).toBeGreaterThan(0)
  })
})
