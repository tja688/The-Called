import { describe, expect, it } from 'vitest'
import { allCards, allMonsters, getCardByName, getMonster, scienceStarter } from './index'

const MONSTER_IDS = [
  'runaway-machine',
  'patrol-swarm',
  'preaching-band',
  'mirror-person',
  'rust-colossus',
  'carrion-crows',
  'anatomist',
  'silent-order',
  'mirror-witch',
  'bell-warden',
  'the-caller',
] as const

const ORPHANS = ['大力打击', '逼近', '偷袭'] as const

describe('v6 content', () => {
  const playerCards = allCards.filter((card) => card.ownerKind === 'player')

  it('has 104 player cards with the documented school counts', () => {
    expect(playerCards).toHaveLength(104)
    expect(playerCards.filter((card) => card.school === 'science')).toHaveLength(29)
    expect(playerCards.filter((card) => card.school === 'mystery')).toHaveLength(34)
    expect(playerCards.filter((card) => card.school === 'religion')).toHaveLength(31)
    expect(playerCards.filter((card) => card.school === 'neutral')).toHaveLength(10)
    expect(playerCards.filter((card) => card.origin === 'existing')).toHaveLength(44)
    expect(playerCards.filter((card) => card.origin !== 'existing')).toHaveLength(60)
  })

  it('keeps ids unique and Chinese names resolvable without player/enemy collisions', () => {
    expect(new Set(allCards.map((card) => card.id)).size).toBe(allCards.length)
    expect(new Set(allCards.map((card) => card.name)).size).toBe(allCards.length)

    const playerNames = new Set(playerCards.map((card) => card.name))
    const enemyNames = allCards.filter((card) => card.ownerKind === 'enemyOnly').map((card) => card.name)
    for (const name of enemyNames) {
      expect(playerNames.has(name)).toBe(false)
      expect(getCardByName(name)?.name).toBe(name)
    }
    for (const card of playerCards) {
      expect(getCardByName(card.name)).toBe(card)
    }

    expect(getCardByName('失控机械')?.id).toBe('card.enemy.runaway-machine')
    expect(getMonster('runaway-machine')?.id).not.toBe(getCardByName('失控机械')?.id)
  })

  it('lists the eleven frozen monster ids', () => {
    expect(allMonsters.map((monster) => monster.id)).toEqual([...MONSTER_IDS])
    expect(allMonsters).toHaveLength(11)
  })

  it('resolves every intent, preset, and reward card name', () => {
    for (const monster of allMonsters) {
      for (const name of [...monster.intents, ...monster.presets.map((preset) => preset.cardName), ...monster.rewardCardNames]) {
        expect(getCardByName(name), `${monster.id} → ${name}`).toBeDefined()
      }
    }
  })

  it('excludes the sage and keeps the three orphan cards out of encounters and the starter', () => {
    expect(getCardByName('智者')?.pool).toBe('excluded')

    const referenced = new Set<string>(scienceStarter)
    for (const monster of allMonsters) {
      for (const name of monster.intents) referenced.add(name)
      for (const preset of monster.presets) referenced.add(preset.cardName)
      for (const name of monster.rewardCardNames) referenced.add(name)
    }

    for (const name of ORPHANS) {
      const card = getCardByName(name)
      expect(card?.orphan).toBe(true)
      expect(referenced.has(name)).toBe(false)
    }
    expect(allCards.filter((card) => card.orphan).map((card) => card.name).sort()).toEqual([...ORPHANS].sort())
  })

  it('expands the science starter to 15 white player cards', () => {
    expect(scienceStarter).toHaveLength(15)
    for (const name of scienceStarter) {
      const card = getCardByName(name)
      expect(card?.ownerKind).toBe('player')
      expect(card?.rarity).toBe('white')
    }
  })

  it('pollutes only cells 4 and 6 for the silent order', () => {
    expect(getMonster('silent-order')?.pollutedCells).toEqual([4, 6])
  })

  it('keeps twin mirror base power at 3', () => {
    expect(getCardByName('双生镜')?.basePower).toBe(3)
    expect(getCardByName('双生镜')?.basePower).not.toBe(5)
  })

  it('rewards the runaway machine with microscope, turret, and sampler for 50 gold', () => {
    const monster = getMonster('runaway-machine')
    expect(monster?.rewardCardNames).toEqual(['显微镜', '攻击炮台', '弱点采样机'])
    expect(monster?.rewardCardNames).not.toContain('弱点攻击器')
    expect(monster?.rewardGold).toBe(50)
  })
})
