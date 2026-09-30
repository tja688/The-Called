import { describe, expect, it } from 'vitest'
import { getMonsterConfig, getSceneConfig, monsters, scenes } from './gameContent'

describe('scene content', () => {
  it('keeps a monster illustration and a default table', () => {
    expect(getMonsterConfig('svarbhanu')?.image).toMatch(/^\/monsters\//)
    expect(getSceneConfig('missing')).toBe(scenes.default)
  })

  it('uses URL-safe ASCII file names for monster assets', () => {
    for (const monster of Object.values(monsters)) {
      expect(monster.image).toMatch(/^\/monsters\/[a-z0-9-]+\.png$/i)
      expect(monster.visual.distance).toBeGreaterThan(0)
      expect(monster.visual.scale).toBeGreaterThan(0)
    }
  })
})
