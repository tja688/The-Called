import { describe, expect, it } from 'vitest'
import { createBattle, type CardDefinition } from '../../rules'
import { scriptedRust } from '../../scripts/rust'
import { scriptedBell } from '../../scripts/bell'
import { scriptedWitch } from '../../scripts/witch'
import { actOnCell, actOnConfirm, readPlayChoice, togglePlayTargets } from './playChoice'

const foe: CardDefinition = { id: 'foe', name: 'foe', ruleType: 'field', basePoints: 3 }

describe('打出前的目标', () => {
  it('穿甲钻头可以选出两张不同的敌方牌，点满后第三张加不进去', () => {
    const drill = scriptedBell('穿甲钻头').definition
    const state = createBattle({
      cards: [
        { definition: drill, owner: 'player', zone: 'hand', instanceId: 'drill' },
        { definition: foe, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'left' },
        { definition: foe, owner: 'enemy', zone: 'board', cell: 3, instanceId: 'mid' },
        { definition: foe, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'right' },
      ],
    })
    const choice = readPlayChoice(state, 'drill')
    expect(choice.limit).toBe(2)
    expect(choice.from).toBe('board')
    expect(choice.targets.map((target) => target.instanceId)).toEqual(['left', 'mid', 'right'])

    const first = actOnCell({ instanceId: 'drill', choice, selected: [], cell: 1, occupantId: 'left' })
    expect(first).toEqual({ kind: 'choose', targetIds: ['left'] })
    const second = actOnCell({ instanceId: 'drill', choice, selected: ['left'], cell: 8, occupantId: 'right' })
    expect(second).toEqual({ kind: 'choose', targetIds: ['left', 'right'] })
    expect(togglePlayTargets(['left', 'right'], 'mid', choice.limit)).toEqual(['left', 'right'])
    expect(togglePlayTargets(['left', 'right'], 'right', choice.limit)).toEqual(['left'])

    const played = actOnCell({
      instanceId: 'drill',
      choice,
      selected: ['left', 'right'],
      cell: 5,
      occupantId: null,
    })
    expect(played).toEqual({
      kind: 'play',
      request: { instanceId: 'drill', cell: 5, choice: { targets: ['left', 'right'] } },
    })
  })

  it('场上没有敌方牌时穿甲钻头仍然可以占格', () => {
    const drill = scriptedBell('穿甲钻头').definition
    const state = createBattle({
      cards: [{ definition: drill, owner: 'player', zone: 'hand', instanceId: 'drill' }],
    })
    const choice = readPlayChoice(state, 'drill')
    expect(choice.blocked).toBe(false)
    expect(choice.skipped).toBe(true)
    expect(choice.targets).toEqual([])
    expect(actOnCell({ instanceId: 'drill', choice, selected: [], cell: 4, occupantId: null })).toEqual({
      kind: 'play',
      request: { instanceId: 'drill', cell: 4 },
    })
  })

  it('调取图纸可以从牌组选出一张基础点数至少 8 的占场卡', () => {
    const fetch = scriptedRust('调取图纸').definition
    const heavy: CardDefinition = { id: 'heavy', name: 'heavy', ruleType: 'field', basePoints: 8 }
    const light: CardDefinition = { id: 'light', name: 'light', ruleType: 'field', basePoints: 7 }
    const state = createBattle({
      cards: [
        { definition: fetch, owner: 'player', zone: 'hand', instanceId: 'spell' },
        { definition: light, owner: 'player', zone: 'deck', instanceId: 'puffed', permanentMod: 9 },
        { definition: heavy, owner: 'player', zone: 'deck', instanceId: 'first' },
        { definition: fetch, owner: 'player', zone: 'deck', instanceId: 'another-spell' },
        { definition: heavy, owner: 'player', zone: 'deck', instanceId: 'second', permanentMod: -3 },
      ],
    })
    const choice = readPlayChoice(state, 'spell')
    expect(choice.from).toBe('deck')
    expect(choice.limit).toBe(1)
    expect(choice.targets.map((target) => target.instanceId)).toEqual(['first', 'second'])
    expect(choice.targets.every((target) => (target.basePoints ?? 0) >= 8)).toBe(true)

    const picked = togglePlayTargets([], 'second', choice.limit)
    expect(picked).toEqual(['second'])
    expect(actOnConfirm({ instanceId: 'spell', choice, selected: picked })).toEqual({
      kind: 'play',
      request: { instanceId: 'spell', choice: { targets: ['second'] } },
    })
    expect(actOnConfirm({ instanceId: 'spell', choice, selected: [] })).toEqual({ kind: 'wait', message: '先选择目标' })
  })

  it('调取图纸在牌组没有合格牌时仍然可以打出，亡者低语没有敌方牌时不发出', () => {
    const fetch = scriptedRust('调取图纸').definition
    const light: CardDefinition = { id: 'light', name: 'light', ruleType: 'field', basePoints: 7 }
    const emptyDeck = createBattle({
      cards: [
        { definition: fetch, owner: 'player', zone: 'hand', instanceId: 'spell' },
        { definition: light, owner: 'player', zone: 'deck', instanceId: 'puffed', permanentMod: 9 },
      ],
    })
    const skipped = readPlayChoice(emptyDeck, 'spell')
    expect(skipped.skipped).toBe(true)
    expect(skipped.blocked).toBe(false)
    expect(actOnConfirm({ instanceId: 'spell', choice: skipped, selected: [] })).toEqual({
      kind: 'play',
      request: { instanceId: 'spell' },
    })

    const whisper = scriptedWitch('亡者低语').definition
    const quiet = createBattle({
      cards: [{ definition: whisper, owner: 'player', zone: 'hand', instanceId: 'whisper' }],
    })
    const blocked = readPlayChoice(quiet, 'whisper')
    expect(blocked.blocked).toBe(true)
    expect(actOnConfirm({ instanceId: 'whisper', choice: blocked, selected: [] })).toEqual({
      kind: 'wait',
      message: '这张法术现在不能打出',
    })
  })
})
