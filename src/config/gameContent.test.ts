import { describe, expect, it } from 'vitest'
import { getLevelConfig, getMonsterConfig, levels, monsters } from './gameContent'

describe('game content configuration', () => {
  it('assigns one configured monster to every level', () => {
    expect(levels.map((level) => level.monsterId)).toEqual([
      'svarbhanu',
      'rahu-ketu',
      'moon',
    ])
  })

  it('resolves every playable level to a monster', () => {
    const playableLevels = levels.filter((level) => level.playableInDemo)

    for (const level of playableLevels) {
      expect(getLevelConfig(level.id)).toBe(level)
      expect(getMonsterConfig(level.monsterId)?.image).toMatch(/^\/monsters\//)
    }
  })

  it('uses URL-safe ASCII file names for monster assets', () => {
    for (const level of levels) {
      const image = getMonsterConfig(level.monsterId)?.image
      if (image) expect(image).toMatch(/^\/monsters\/[a-z0-9-]+\.png$/i)
    }
  })

  it('provides distance and scale controls for every monster visual', () => {
    for (const monster of Object.values(monsters)) {
      expect(monster.visual.distance).toBeGreaterThan(0)
      expect(monster.visual.scale).toBeGreaterThan(0)
    }
  })

  it('exposes every configured level as playable', () => {
    expect(levels.every((level) => level.playableInDemo && getMonsterConfig(level.monsterId))).toBe(true)
  })
})
