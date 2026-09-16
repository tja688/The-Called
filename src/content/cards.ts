import type { CardKind } from '../domain/types'
import type { AuraDo, EnterDo, PressureDo, RemovedDo, SpellDo } from '../domain/effects'

export interface CardDef {
  id: string
  name: string
  kind: CardKind
  cost: number
  basePoints: number
  text: string
  enter?: EnterDo
  removed?: RemovedDo
  aura?: AuraDo
  spell?: SpellDo
  pressure?: PressureDo
}

export const AVATAR_ID = 'AVATAR'

export const CARDS: Record<string, CardDef> = {
  AVATAR: { id: 'AVATAR', name: '化身', kind: 'occupy', cost: 0, basePoints: 10, text: '每场生成。未入场不能打其他牌，也不能结束回合。' },

  P01: { id: 'P01', name: '钉子', kind: 'occupy', cost: 0, basePoints: 3, text: '占场。' },
  P02: { id: 'P02', name: '楔子', kind: 'occupy', cost: 0, basePoints: 4, text: '占场。' },
  P03: {
    id: 'P03', name: '灯芯', kind: 'occupy', cost: 0, basePoints: 2, text: '入场：相邻己方占场各 +1。可以加到化身上。',
    enter: { do: 'buffAdjacentAllies', amount: 1 },
  },
  P04: { id: 'P04', name: '镇纸', kind: 'occupy', cost: 1, basePoints: 6, text: '占场。' },
  P05: {
    id: 'P05', name: '余温', kind: 'spell', cost: 1, basePoints: 0, text: '指定一张敌方占场 -2。',
    spell: { do: 'damageEnemy', amount: 2 },
  },
  P06: {
    id: 'P06', name: '撑住', kind: 'spell', cost: 1, basePoints: 0, text: '化身 +2。',
    spell: { do: 'buffAvatar', amount: 2 },
  },
  P07: {
    id: 'P07', name: '封口', kind: 'spell', cost: 2, basePoints: 0, text: '封印一张敌方占场。',
    spell: { do: 'sealEnemy' },
  },

  EV01: { id: 'EV01', name: '冷钉子', kind: 'occupy', cost: 0, basePoints: 6, text: '事件牌。占场。' },

  R01: {
    id: 'R01', name: '倒刺', kind: 'occupy', cost: 0, basePoints: 2, text: '入场：若本卡是覆盖入场，抽 1。',
    enter: { do: 'drawIfCovered', count: 1 },
  },
  R02: { id: 'R02', name: '重锤', kind: 'occupy', cost: 2, basePoints: 8, text: '占场。' },
  R03: {
    id: 'R03', name: '抽薪', kind: 'spell', cost: 1, basePoints: 0, text: '指定一张敌方占场 -3。',
    spell: { do: 'damageEnemy', amount: 3 },
  },
  R04: {
    id: 'R04', name: '旧锁', kind: 'occupy', cost: 0, basePoints: 3, text: '驻场：化身每次受到点数减少时，该次减少的数值 -1（至少减 0）。',
    aura: { do: 'reduceAvatarIncoming', amount: 1 },
  },
  R05: {
    id: 'R05', name: '回声', kind: 'occupy', cost: 0, basePoints: 1, text: '被移除时：化身 +2。',
    removed: { do: 'buffAvatar', amount: 2 },
  },
  R06: {
    id: 'R06', name: '清场', kind: 'spell', cost: 3, basePoints: 0, text: '移除所有当前点数 ≤ 3 的敌方占场。',
    spell: { do: 'removeEnemiesAtMost', atMost: 3 },
  },
  R07: {
    id: 'R07', name: '锚', kind: 'occupy', cost: 1, basePoints: 4, text: '驻场：化身当前点数不会低于 4。已被驱离仍离场。',
    aura: { do: 'avatarFloor', floor: 4 },
  },
  R08: {
    id: 'R08', name: '点名', kind: 'spell', cost: 2, basePoints: 0, text: '封印所有与化身相邻的敌方占场。',
    spell: { do: 'sealEnemiesAdjacentToAvatar' },
  },

  E1A: { id: 'E1A', name: '余桩', kind: 'occupy', cost: 0, basePoints: 4, text: '敌方占场。' },
  E1B: {
    id: 'E1B', name: '重心', kind: 'occupy', cost: 0, basePoints: 7, text: '压迫：相邻的玩家占场各 -1。',
    pressure: { do: 'damageAdjacentPlayers', amount: 1 },
  },
  E2A: {
    id: 'E2A', name: '盯人', kind: 'occupy', cost: 0, basePoints: 5, text: '压迫：若化身与本卡相邻，且化身当前点数 ≤ 5，驱离化身。',
    pressure: { do: 'banishAvatarIfAdjacentAndAtMost', atMost: 5 },
  },
  E2B: {
    id: 'E2B', name: '剥手', kind: 'occupy', cost: 0, basePoints: 6, text: '压迫：点数最低的一张非化身己方占场 -2。若因此变为 0，移除该牌。',
    pressure: { do: 'damageLowestAlly', amount: 2 },
  },
  E3A: { id: 'E3A', name: '门柱', kind: 'occupy', cost: 0, basePoints: 3, text: '敌方占场。' },
  E3B: {
    id: 'E3B', name: '横梁', kind: 'occupy', cost: 0, basePoints: 5, text: '驻场：上排其他敌方占场各 +1。',
    aura: { do: 'buffRowEnemies', row: 0, amount: 1 },
  },
  E3C: {
    id: 'E3C', name: '守门人', kind: 'occupy', cost: 0, basePoints: 7, text: '压迫：化身 -1。若结算前化身当前点数 ≤ 3，改为驱离。',
    pressure: { do: 'damageAvatarOrBanish', amount: 1, banishAtMost: 3 },
  },
}

export const ECHO_DECK: string[] = ['P01', 'P01', 'P02', 'P02', 'P03', 'P04', 'P05', 'P05', 'P06', 'P07']

export function cardDef(id: string): CardDef {
  const def = CARDS[id]
  if (!def) throw new Error(`Unknown card: ${id}`)
  return def
}

export function cardName(id: string): string {
  return CARDS[id]?.name ?? id
}
