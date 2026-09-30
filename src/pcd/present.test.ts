import { afterEach, describe, expect, it } from 'vitest'
import { clearPresentedCards, getCardDefinition } from '../config/cardCatalog'
import { beatsFor } from './playback'
import { looseCardOptions, optionForAnswer, optionForCast, optionForEndTurn, optionForPlay } from './options'
import { projectBattle, publishProjection } from './project'
import { sceneCell } from './cells'
import choice from './fixtures/choice.json'
import opening from './fixtures/opening.json'
import type { PcdCatalog, PcdOption, PcdView } from './types'

const catalog: PcdCatalog = {
  contentHash: 'fixture',
  cards: [
    { id: 'card.c002', name: '巨型机械', isSpell: false, points: 6, load: 6, rarity: 'white', school: 'science', text: '没有额外效果。' },
    { id: 'card.c016', name: '科学研究器', isSpell: false, points: 3, load: 4, rarity: 'white', school: 'science', text: '意图牌。' },
    { id: 'card.m001', name: '失控机械', isSpell: false, points: 8, load: 0, rarity: '', school: '', text: '占据中央。' },
    { id: 'card.c001', name: '弱点采样机', isSpell: false, points: 4, load: 4, rarity: 'white', school: 'science', text: '标记一名对手。' },
  ],
  backs: [],
  monsters: [{ id: 'monster.001', name: '失控机械', starting: [], intents: [], skills: [] }],
  decks: [],
  statuses: [],
  resources: [{ id: 'resource.faith', name: '信仰' }],
}

const recorded = choice as { view: PcdView; options: PcdOption[] }

afterEach(() => {
  clearPresentedCards()
})

describe('内核视图投影', () => {
  it('把格子、手牌、牌库张数、意图和信仰投到棋盘上', () => {
    const projected = projectBattle({
      view: recorded.view,
      catalog,
      monsterId: 'monster.001',
      turn: 'player',
    })
    publishProjection(projected)
    expect(projected.match.board.find((cell) => cell.id === 'cell-1-1')?.card).toMatchObject({
      instanceId: 'pcd-1',
      owner: 'monster',
      currentPower: 8,
    })
    expect(projected.match.board.find((cell) => cell.id === 'cell-0-0')?.card).toBeNull()
    expect(projected.polluted).toEqual(['cell-0-0'])
    expect(projected.match.player.hand.map((card) => card.instanceId)).toEqual(['pcd-4'])
    expect(projected.match.player.deck).toHaveLength(4)
    expect(projected.playerDiscard).toBe(0)
    expect(projected.monsterDiscard).toBe(0)
    expect(projected.pools).toEqual([{ owner: 'player', id: 'resource.faith', name: '信仰', amount: 2 }])
    expect(projected.telegraph?.card.instanceId).toBe('intent:0:card.c016')
    expect(projected.telegraph?.cellId).toBeUndefined()
    expect(getCardDefinition('pcd-4')).toMatchObject({ name: '巨型机械', power: 6, description: '没有额外效果。' })
    expect(getCardDefinition('intent:0:card.c016').name).toBe('科学研究器')
    expect(getCardDefinition('pcd-1').name).toBe('失控机械')
  })

  it('把手牌卡背的名字写到牌面上', () => {
    const view = structuredClone(recorded.view)
    const hand = view.hand[0]
    if (!hand) throw new Error('fixture has no hand card')
    view.hand = [{ ...hand, cardBackId: 'back.002' }]
    const projected = projectBattle({
      view,
      catalog: {
        ...catalog,
        backs: [{ id: 'back.002', name: '厚实', load: 1, isBack: true, text: '点数 +1。' }],
      },
      monsterId: 'monster.001',
      turn: 'player',
    })
    publishProjection(projected)
    expect(getCardDefinition(`pcd-${hand.instance}`).backLabel).toBe('厚实')
  })

  it('开局直接采用最终视图，之后的步骤按事件往前走', () => {
    expect(beatsFor(null, { view: recorded.view, steps: [] })).toEqual([{ view: recorded.view, fly: null }])
    const after = structuredClone(recorded.view)
    after.cells[8] = {
      cell: 9,
      polluted: false,
      card: { ...recorded.view.hand[0], zone: 'board', cell: 9, currentPoints: 5 },
    }
    after.hand = [{
      instance: 8,
      cardId: 'card.c001',
      owner: 'player',
      zone: 'hand',
      cell: 0,
      basePoints: 4,
      currentPoints: 4,
      modifierCount: 0,
      isSpell: false,
      timer: 0,
      statuses: [],
    }]
    after.handCount = 1
    after.matchDeckCount = 3
    after.revealedIntent = 'card.c003'
    after.intentIndex = 1
    after.playerPoints = 5
    const beats = beatsFor(recorded.view, {
      view: after,
      steps: [{
        view: after,
        pending: null,
        result: null,
        events: [
          { type: 'card-played', instance: 4, cell: 9, owner: 'player', card: 'card.c002', points: 6 },
          { type: 'card-entered', instance: 4, cell: 9, owner: 'player', card: 'card.c002' },
          { type: 'points-changed', instance: 4, before: 6, after: 5 },
          { type: 'card-removed', instance: 99 },
          { type: 'intent-revealed', card: 'card.c003', index: 1 },
          { type: 'card-drawn', instance: 8, card: 'card.c001', owner: 'player' },
        ],
      }],
    })
    expect(beats[0]?.fly).toMatchObject({ side: 'player', instanceId: 'pcd-4', cell: 9 })
    expect(beats[0]?.view.cells[8]?.card?.currentPoints).toBe(6)
    expect(beats.map((beat) => beat.view.cells[8]?.card?.currentPoints)).toContain(5)
    expect(beats.some((beat) => beat.view.revealedIntent === 'card.c003')).toBe(true)
    expect(beats.some((beat) => beat.view.hand.some((card) => card.instance === 8))).toBe(true)
    expect(beats.at(-1)?.view.cells[8]?.card?.instance).toBe(4)
    expect(beats.at(-1)?.view.revealedIntent).toBe('card.c003')
  })

  it('投影内核录下的开局，并且不接受没给出的格子', () => {
    const view = opening.view as PcdView
    const options = opening.options as PcdOption[]
    const projected = projectBattle({
      view,
      catalog,
      monsterId: 'monster.001',
      turn: 'player',
    })
    expect(view.cells.find((cell) => cell.cell === 5)?.card?.cardId).toBe('card.m001')
    expect(projected.match.board.find((cell) => cell.id === 'cell-1-1')?.card?.owner).toBe('monster')
    expect(projected.match.player.hand).toHaveLength(view.hand.length)
    expect(projected.match.player.deck).toHaveLength(view.matchDeckCount)
    expect(projected.telegraph?.card.instanceId).toBe(`intent:${view.intentIndex}:${view.revealedIntent}`)
    expect(optionForEndTurn(options)).toBe('end-turn')
    const sample = options.find((option) => option.kind === 'play')
    expect(sample).toBeTruthy()
    expect(optionForPlay(options, `pcd-${sample!.instance}`, sceneCell(sample!.cell as 1))).toBe(sample!.id)
    const illegal = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((cell) => (
      !options.some((option) => option.kind === 'play' && option.instance === sample!.instance && option.cell === cell)
    ))
    expect(illegal).toBeTruthy()
    expect(optionForPlay(options, `pcd-${sample!.instance}`, sceneCell(illegal as 1))).toBeNull()
  })
})

describe('合法选项匹配', () => {
  const options = recorded.options

  it('只接受内核给出的出牌、法术、结束和目标', () => {
    expect(optionForPlay(options, 'pcd-4', 'cell-2-2')).toBe('play:4:9')
    expect(optionForPlay(options, 'pcd-4', 'cell-0-0')).toBe('play:4:1')
    expect(optionForPlay(options, 'pcd-4', 'cell-1-1')).toBeNull()
    expect(optionForPlay(options, 'pcd-7', 'cell-2-2')).toBeNull()
    expect(optionForCast(options, 'pcd-7')).toBe('cast:7')
    expect(optionForCast(options, 'pcd-4')).toBeNull()
    expect(optionForEndTurn(options)).toBe('end-turn')
    expect(optionForAnswer(options, 'cell-0-2', null)).toBe('cell:3')
    expect(optionForAnswer(options, 'cell-1-1', 'pcd-12')).toBe('card:12')
    expect(optionForAnswer(options, 'cell-1-0', 'pcd-1')).toBeNull()
    expect(looseCardOptions(options, new Set([12]))).toEqual([])
    expect(looseCardOptions(options, new Set()).map((option) => option.id)).toEqual(['card:12'])
  })
})
