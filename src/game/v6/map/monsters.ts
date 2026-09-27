/** 怪物 id 冻结。不要改这些字面量。 */

export const MONSTER_IDS = [
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

export type MonsterId = (typeof MONSTER_IDS)[number]

/** 第 6.5 节正式的三种精英。钟楼和呼唤者的开战条件用这份名单。 */
export const ELITE_MONSTER_IDS: readonly MonsterId[] = [
  'anatomist',
  'silent-order',
  'mirror-witch',
]

const MONSTER_NAMES: Record<MonsterId, string> = {
  'runaway-machine': '失控机械',
  'patrol-swarm': '巡检蜂群',
  'preaching-band': '布道团',
  'mirror-person': '镜中人',
  'rust-colossus': '锈蚀巨像',
  'carrion-crows': '食腐鸦群',
  'anatomist': '解剖学家',
  'silent-order': '缄默修会',
  'mirror-witch': '镜渊魔女',
  'bell-warden': '钟楼守望者',
  'the-caller': '呼唤者',
}

/** 第 6.5 节：档位按定位，不按 EL。 */
export const MONSTER_TIER: Record<MonsterId, number> = {
  'runaway-machine': 1,
  'patrol-swarm': 2,
  'preaching-band': 2,
  'mirror-person': 2,
  'rust-colossus': 3,
  'carrion-crows': 3,
  'anatomist': 4,
  'silent-order': 4,
  'mirror-witch': 4,
  'bell-warden': 5,
  'the-caller': 6,
}

/** TODO 文档未定：第 8.2 节建议默认的同档只数。 */
export const MONSTER_COUNT: Record<MonsterId, number> = {
  'runaway-machine': 1,
  'patrol-swarm': 2,
  'preaching-band': 2,
  'mirror-person': 2,
  'rust-colossus': 2,
  'carrion-crows': 2,
  'anatomist': 1,
  'silent-order': 1,
  'mirror-witch': 1,
  'bell-warden': 1,
  'the-caller': 1,
}

export function isMonsterId(value: string): value is MonsterId {
  return (MONSTER_IDS as readonly string[]).includes(value)
}

export function monsterName(monsterId: MonsterId): string {
  return MONSTER_NAMES[monsterId]
}
