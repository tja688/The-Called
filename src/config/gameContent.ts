export type MonsterConfig = {
  id: string
  name: string
  image: string
  visual: {
    /** Unscaled monster height in scene units. */
    height: number
    /** Distance behind the screen origin in the normal battle view. */
    distance: number
    /** Normal battle-view size multiplier. */
    scale: number
    /** Distance behind the screen origin in the tactical view. */
    tacticalDistance: number
    tacticalScale: number
  }
}

export type SceneConfig = {
  id: string
  background: string
  fog: {
    color: string
    near: number
    far: number
  }
  ambientLightIntensity: number
}

export type LevelConfig = {
  id: string
  label: string
  position: { x: number; y: number }
  monsterId: string | null
  sceneId: string
  /** Demo builds may expose later encounters before progression is implemented. */
  playableInDemo: boolean
}

export const monsters = {
  svarbhanu: {
    id: 'svarbhanu',
    name: 'SVARBHĀNU',
    image: '/monsters/svarbhanu.png',
    visual: {
      height: 11.3,
      distance: 6.6,
      scale: 1.08,
      tacticalDistance: 24,
      tacticalScale: 0.72,
    },
  },
  moon: {
    id: 'moon',
    name: 'Moon',
    image: '/monsters/Moon.png',
    visual: {
      height: 11.3,
      distance: 7.2,
      scale: 1,
      tacticalDistance: 24,
      tacticalScale: 0.72,
    },
  },
  rahuKetu: {
    id: 'rahu-ketu',
    name: 'Rahu & Ketu',
    image: '/monsters/20260830-054110.png',
    visual: {
      // This illustration is landscape-oriented, so a shorter source height keeps
      // both characters fully visible while matching the other encounters.
      height: 8.2,
      distance: 7.2,
      scale: 1,
      tacticalDistance: 24,
      tacticalScale: 0.72,
    },
  },
} as const satisfies Record<string, MonsterConfig>

export const scenes = {
  default: {
    id: 'default',
    background: '#020105',
    fog: { color: '#020105', near: 25, far: 43 },
    ambientLightIntensity: 1.5,
  },
} as const satisfies Record<string, SceneConfig>

export const levels = [
  {
    id: 'level-01',
    label: 'LEVEL 01',
    position: { x: 500, y: 900 },
    monsterId: 'svarbhanu',
    sceneId: 'default',
    playableInDemo: true,
  },
  {
    id: 'level-02',
    label: 'LEVEL 02',
    position: { x: 315, y: 720 },
    monsterId: 'rahu-ketu',
    sceneId: 'default',
    playableInDemo: true,
  },
  {
    id: 'level-03',
    label: 'LEVEL 03',
    position: { x: 690, y: 485 },
    monsterId: 'moon',
    sceneId: 'default',
    playableInDemo: true,
  },
] as const satisfies readonly LevelConfig[]

export function getNextLevelId(levelId: string | null): string | null {
  const index = levels.findIndex((level) => level.id === levelId)
  if (index < 0 || index >= levels.length - 1) return null
  return levels[index + 1].id
}

export function getLevelConfig(levelId: string | null): LevelConfig | null {
  if (!levelId) return null
  return levels.find((level) => level.id === levelId) ?? null
}

export function getMonsterConfig(monsterId: string | null): MonsterConfig | null {
  if (!monsterId) return null
  return Object.values(monsters).find((monster) => monster.id === monsterId) ?? null
}

export function getSceneConfig(sceneId: string): SceneConfig {
  return Object.values(scenes).find((scene) => scene.id === sceneId) ?? scenes.default
}
