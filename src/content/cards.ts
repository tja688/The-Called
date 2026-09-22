import type { CardEffect, AuraKind } from '../domain/effects'
import type { CardKind, Rarity, SchoolId } from '../domain/types'
import { isBodyKind } from '../domain/types'

export interface CardDef {
  id: string
  name: string
  kind: CardKind
  cost: number
  basePoints: number
  text: string
  school: SchoolId
  rarity: Rarity
  extra?: 'negative'
  timer?: number
  burn?: boolean
  overlayAlly?: boolean
  effects: CardEffect[]
  auras?: AuraKind[]
}

function d(def: CardDef): CardDef {
  return def
}

export const CARDS: Record<string, CardDef> = {
  'PC.A00': d({
    id: 'PC.A00', name: 'PC.A00', kind: 'avatar', cost: 0, basePoints: 10, school: 'SYS.A', rarity: 'basic',
    text: '主动触发：使一张拥有 MK.A 的敌方卡牌获得易伤。',
    effects: [{ timing: 'active', ops: [{ op: 'status', sel: 'chosen', status: 'vulnerable' }] }],
  }),
  'PC.A01': d({
    id: 'PC.A01', name: 'PC.A01', kind: 'occupy', cost: 1, basePoints: 4, school: 'SYS.A', rarity: 'basic',
    text: '驻场回合结束时，为一张相邻敌方卡牌添加 MK.A。',
    effects: [{ timing: 'turnEnd', ops: [{ op: 'mark', sel: 'adjacentEnemies', one: true }] }],
  }),
  'PC.A02': d({
    id: 'PC.A02', name: 'PC.A02', kind: 'spell', cost: 0, basePoints: 0, school: 'SYS.A', rarity: 'basic',
    text: '选择一张敌方卡牌使其点数-2；若拥有 MK.A，则改为移除 MK.A 并-4。',
    effects: [{ timing: 'play', ops: [{ op: 'damage', sel: 'chosen', n: 2, ifMarked: { n: 4, unmark: true } }] }],
  }),
  'PC.A03': d({
    id: 'PC.A03', name: 'PC.A03', kind: 'occupy', cost: 2, basePoints: 6, school: 'SYS.A', rarity: 'basic',
    text: '驻场回合结束时，使一张拥有 MK.A 的敌方卡牌点数-2。',
    effects: [{ timing: 'turnEnd', ops: [{ op: 'damage', sel: 'markedEnemies', n: 2, one: true }] }],
  }),
  'PC.A04': d({
    id: 'PC.A04', name: 'PC.A04', kind: 'occupy', cost: 1, basePoints: 4, school: 'SYS.A', rarity: 'white',
    text: '入场为所有相邻敌方卡牌添加 MK.A。',
    effects: [{ timing: 'enter', ops: [{ op: 'mark', sel: 'adjacentEnemies' }] }],
  }),
  'PC.A08': d({
    id: 'PC.A08', name: 'PC.A08', kind: 'occupy', cost: 1, basePoints: 4, school: 'SYS.A', rarity: 'white',
    text: '入场若相邻有拥有 MK.A 的敌方卡牌，本卡点数+2。',
    effects: [{ timing: 'enter', ops: [{ op: 'ifAdjacentMarked', then: [{ op: 'buff', sel: 'self', n: 2 }] }] }],
  }),
  'PC.A09': d({
    id: 'PC.A09', name: 'PC.A09', kind: 'occupy', cost: 3, basePoints: 7, school: 'SYS.A', rarity: 'gold',
    text: '驻场：拥有 MK.A 的敌方卡牌不能移动，且每回合开始时点数-1。',
    auras: [{ aura: 'blockMarkedMove' }],
    effects: [{ timing: 'turnStart', ops: [{ op: 'damage', sel: 'markedEnemies', n: 1 }] }],
  }),
  'PC.A13': d({
    id: 'PC.A13', name: 'PC.A13', kind: 'occupy', cost: 2, basePoints: 6, school: 'SYS.A', rarity: 'blue', timer: 2,
    text: '计时2：使镜像格上的敌方卡牌点数-4，并为其添加 MK.A。',
    effects: [{ timing: 'timer', ops: [{ op: 'damage', sel: 'mirrorOccupant', n: 4 }, { op: 'mark', sel: 'mirrorOccupant' }] }],
  }),
  'PC.A14': d({
    id: 'PC.A14', name: 'PC.A14', kind: 'spell', cost: 0, basePoints: 0, school: 'SYS.A', rarity: 'blue',
    text: '为一张敌方卡牌添加 MK.A，并抽一张牌。',
    effects: [{ timing: 'play', ops: [{ op: 'mark', sel: 'chosen' }, { op: 'draw', n: 1 }] }],
  }),

  'PC.B00': d({
    id: 'PC.B00', name: 'PC.B00', kind: 'avatar', cost: 0, basePoints: 10, school: 'SYS.B', rarity: 'basic',
    text: '主动触发：抽两张卡牌。',
    effects: [{ timing: 'active', ops: [{ op: 'draw', n: 2 }] }],
  }),
  'PC.B01': d({
    id: 'PC.B01', name: 'PC.B01', kind: 'occupy', cost: 1, basePoints: 4, school: 'SYS.B', rarity: 'basic',
    text: '献祭2，在镜像格生成一张本卡的复制；其中一张离场则移除另一张。',
    effects: [{ timing: 'play', sacrifice: 2, ops: [{ op: 'spawnCopyAtMirror', link: true }] }],
  }),
  'PC.B02': d({
    id: 'PC.B02', name: 'PC.B02', kind: 'occupy', cost: 1, basePoints: 3, school: 'SYS.B', rarity: 'basic',
    text: '入场将一张本卡的复制洗入牌组，离场也将一张本卡的复制洗入牌组。',
    effects: [
      { timing: 'enter', ops: [{ op: 'shuffleCopyToDeck' }] },
      { timing: 'leave', ops: [{ op: 'shuffleCopyToDeck' }] },
    ],
  }),
  'PC.B03': d({
    id: 'PC.B03', name: 'PC.B03', kind: 'spell', cost: 2, basePoints: 0, school: 'SYS.B', rarity: 'basic',
    text: '选择一张占场卡，己方弃牌堆里每有一张卡牌使其点数+2。',
    effects: [{ timing: 'play', ops: [{ op: 'buff', sel: 'chosen', n: 'discardCount*2' }] }],
  }),
  'PC.B04': d({
    id: 'PC.B04', name: 'PC.B04', kind: 'occupy', cost: 1, basePoints: 3, school: 'SYS.B', rarity: 'white',
    text: '入场献祭2，本卡点数+3。',
    effects: [{ timing: 'enter', sacrifice: 2, ops: [{ op: 'buff', sel: 'self', n: 3 }] }],
  }),
  'PC.B05': d({
    id: 'PC.B05', name: 'PC.B05', kind: 'spell', cost: 0, basePoints: 0, school: 'SYS.B', rarity: 'white',
    text: '从弃牌堆中选择一张卡牌放回手牌。',
    effects: [{ timing: 'play', ops: [{ op: 'discardToHand' }] }],
  }),
  'PC.B06': d({
    id: 'PC.B06', name: 'PC.B06', kind: 'occupy', cost: 1, basePoints: 4, school: 'SYS.B', rarity: 'white', overlayAlly: true,
    text: '可以打出到己方非化身格：获得该卡当前点数，然后移除该卡。',
    effects: [],
  }),
  'PC.B07': d({
    id: 'PC.B07', name: 'PC.B07', kind: 'occupy', cost: 2, basePoints: 5, school: 'SYS.B', rarity: 'blue',
    text: '驻场每当一张占场卡离场，本卡点数+2。',
    effects: [],
  }),
  'PC.B10': d({
    id: 'PC.B10', name: 'PC.B10', kind: 'occupy', cost: 0, basePoints: 2, school: 'SYS.B', rarity: 'white',
    text: '离场抽一张牌。',
    effects: [{ timing: 'leave', ops: [{ op: 'draw', n: 1 }] }],
  }),
  'PC.B11': d({
    id: 'PC.B11', name: 'PC.B11', kind: 'spell', cost: 2, basePoints: 0, school: 'SYS.B', rarity: 'blue',
    text: '选择一张己方非化身卡，在一个空格位生成它的复制，点数用该卡当前点数。',
    effects: [{ timing: 'play', ops: [{ op: 'spawnHalfCopy' }] }],
  }),
  'PC.B12': d({
    id: 'PC.B12', name: 'PC.B12', kind: 'occupy', cost: 2, basePoints: 4, school: 'SYS.B', rarity: 'blue',
    text: '入场己方弃牌堆每有一张占场卡本卡+1；离场将本卡洗入牌组。',
    effects: [
      { timing: 'enter', ops: [{ op: 'buff', sel: 'self', n: 'occupyDiscardCount' }] },
      { timing: 'leave', ops: [{ op: 'shuffleSelfToDeck' }] },
    ],
  }),
  'PC.B14': d({
    id: 'PC.B14', name: 'PC.B14', kind: 'occupy', cost: 1, basePoints: 4, school: 'SYS.B', rarity: 'blue',
    text: '入场若己方牌组 ≤ 5 张，抽一张并使本卡+2；否则将一张本卡复制洗入牌组。',
    effects: [{
      timing: 'enter',
      ops: [{ op: 'ifDeckAtMost', n: 5, then: [{ op: 'draw', n: 1 }, { op: 'buff', sel: 'self', n: 2 }], else: [{ op: 'shuffleCopyToDeck' }] }],
    }],
  }),

  'PC.C00': d({
    id: 'PC.C00', name: 'PC.C00', kind: 'avatar', cost: 0, basePoints: 10, school: 'SYS.C', rarity: 'basic',
    text: '主动触发：九宫格上所有己方卡牌点数+1。',
    effects: [{ timing: 'active', ops: [{ op: 'buff', sel: 'allAllies', n: 1 }] }],
  }),
  'PC.C01': d({
    id: 'PC.C01', name: 'PC.C01', kind: 'occupy', cost: 1, basePoints: 4, school: 'SYS.C', rarity: 'basic',
    text: '驻场每回合结束时，获得 1 点 RES.A。',
    effects: [{ timing: 'turnEnd', ops: [{ op: 'gainRes', n: 1 }] }],
  }),
  'PC.C02': d({
    id: 'PC.C02', name: 'PC.C02', kind: 'spell', cost: 0, basePoints: 0, school: 'SYS.C', rarity: 'basic',
    text: '消耗 1 点 RES.A，使一张卡牌获得保护。',
    effects: [{ timing: 'play', spendRes: 1, ops: [{ op: 'status', sel: 'chosen', status: 'protected' }] }],
  }),
  'PC.C03': d({
    id: 'PC.C03', name: 'PC.C03', kind: 'occupy', cost: 2, basePoints: 6, school: 'SYS.C', rarity: 'basic',
    text: '驻场每回合开始时消耗 1 点 RES.A，点数+2。',
    effects: [{ timing: 'turnStart', spendRes: 1, ops: [{ op: 'buff', sel: 'self', n: 2 }] }],
  }),
  'PC.C04': d({
    id: 'PC.C04', name: 'PC.C04', kind: 'occupy', cost: 1, basePoints: 4, school: 'SYS.C', rarity: 'white',
    text: '入场获得 2 点 RES.A。',
    effects: [{ timing: 'enter', ops: [{ op: 'gainRes', n: 2 }] }],
  }),
  'PC.C05': d({
    id: 'PC.C05', name: 'PC.C05', kind: 'spell', cost: 0, basePoints: 0, school: 'SYS.C', rarity: 'white',
    text: '消耗 2 点 RES.A，使一张己方卡牌点数+3。',
    effects: [{ timing: 'play', spendRes: 2, ops: [{ op: 'buff', sel: 'chosen', n: 3 }] }],
  }),
  'PC.C12': d({
    id: 'PC.C12', name: 'PC.C12', kind: 'occupy', cost: 2, basePoints: 5, school: 'SYS.C', rarity: 'blue',
    text: '入场若 RES.A ≥ 4，本卡获得保护且+3；否则获得 1 点 RES.A。',
    effects: [{
      timing: 'enter',
      ops: [{ op: 'ifResAtLeast', n: 4, then: [{ op: 'status', sel: 'self', status: 'protected' }, { op: 'buff', sel: 'self', n: 3 }], else: [{ op: 'gainRes', n: 1 }] }],
    }],
  }),
  'PC.C13': d({
    id: 'PC.C13', name: 'PC.C13', kind: 'spell', cost: 1, basePoints: 0, school: 'SYS.C', rarity: 'gold',
    text: '消耗 4 点 RES.A，使一张己方非化身卡获得返魂，并+2。',
    effects: [{ timing: 'play', spendRes: 4, ops: [{ op: 'status', sel: 'chosen', status: 'rebirth' }, { op: 'buff', sel: 'chosen', n: 2 }] }],
  }),
  'PC.C14': d({
    id: 'PC.C14', name: 'PC.C14', kind: 'occupy', cost: 2, basePoints: 6, school: 'SYS.C', rarity: 'white', timer: 2,
    text: '计时2：获得 3 点 RES.A。',
    effects: [{ timing: 'timer', ops: [{ op: 'gainRes', n: 3 }] }],
  }),

  'PC.N01': d({
    id: 'PC.N01', name: 'PC.N01', kind: 'occupy', cost: 1, basePoints: 5, school: 'neutral', rarity: 'white',
    text: '占场。', effects: [],
  }),
  'PC.N02': d({
    id: 'PC.N02', name: 'PC.N02', kind: 'spell', cost: 1, basePoints: 0, school: 'neutral', rarity: 'blue',
    text: '抽两张卡牌。',
    effects: [{ timing: 'play', ops: [{ op: 'draw', n: 2 }] }],
  }),
  'PC.N03': d({
    id: 'PC.N03', name: 'PC.N03', kind: 'spell', cost: 1, basePoints: 0, school: 'neutral', rarity: 'gold',
    text: '将一张卡牌的点数重置为初始点数。',
    effects: [{ timing: 'play', ops: [{ op: 'resetChosen' }] }],
  }),
  'PC.N04': d({
    id: 'PC.N04', name: 'PC.N04', kind: 'occupy', cost: 0, basePoints: 1, school: 'neutral', rarity: 'basic',
    text: '占场。牌组下限补足。', effects: [],
  }),
  'PC.N06': d({
    id: 'PC.N06', name: 'PC.N06', kind: 'occupy', cost: 2, basePoints: 8, school: 'neutral', rarity: 'white',
    text: '入场使一张相邻己方卡牌点数-2。',
    effects: [{ timing: 'enter', ops: [{ op: 'n06Tax' }] }],
  }),
  'PC.N07': d({
    id: 'PC.N07', name: 'PC.N07', kind: 'spell', cost: 1, basePoints: 0, school: 'neutral', rarity: 'blue',
    text: '使一张卡牌获得保护，并抽一张牌。',
    effects: [{ timing: 'play', ops: [{ op: 'status', sel: 'chosen', status: 'protected' }, { op: 'draw', n: 1 }] }],
  }),
  'PC.N11': d({
    id: 'PC.N11', name: 'PC.N11', kind: 'occupy', cost: 2, basePoints: 4, school: 'neutral', rarity: 'gold',
    text: '驻场每当己方打出一张其他卡牌，本卡点数+1。',
    effects: [],
  }),
  'PC.X01': d({
    id: 'PC.X01', name: 'PC.X01', kind: 'spell', cost: 0, basePoints: 0, school: 'neutral', rarity: 'white', extra: 'negative',
    text: '抽到时，己方化身卡点数-2，然后将本卡移入弃牌堆。',
    effects: [{ timing: 'play', ops: [{ op: 'damage', sel: 'playerAvatar', n: 2 }] }],
  }),
  'PC.X02': d({
    id: 'PC.X02', name: 'PC.X02', kind: 'occupy', cost: 1, basePoints: 0, school: 'neutral', rarity: 'white', extra: 'negative',
    text: '驻场相邻己方卡牌点数-1。',
    auras: [{ aura: 'adjacentAllies', n: -1 }],
    effects: [],
  }),

  'EC.01': d({
    id: 'EC.01', name: 'EC.01', kind: 'occupy', cost: 0, basePoints: 30, school: 'neutral', rarity: 'basic',
    text: '回合结束：相邻敌方-3，并向化身方向移动一格。',
    effects: [{ timing: 'turnEnd', ops: [{ op: 'damage', sel: 'adjacentEnemies', n: 3, one: true }, { op: 'moveTowardAvatar' }] }],
  }),
  'EC.02': d({
    id: 'EC.02', name: 'EC.02', kind: 'occupy', cost: 0, basePoints: 10, school: 'neutral', rarity: 'basic', timer: 2,
    text: '回合结束：本卡-4，相邻空格打出 EC.03。计时2：移除相邻 EC.03。',
    effects: [
      { timing: 'turnEnd', ops: [{ op: 'selfMinusThenSpawn', minus: 4, defId: 'EC.03' }] },
      { timing: 'timer', ops: [{ op: 'removeAdjacentDef', defId: 'EC.03' }] },
    ],
  }),
  'EC.03': d({
    id: 'EC.03', name: 'EC.03', kind: 'occupy', cost: 0, basePoints: 4, school: 'neutral', rarity: 'basic',
    text: '离场：相邻敌方-2，相邻己方+2。',
    effects: [{ timing: 'leave', ops: [{ op: 'leaveAdjSwing', enemy: -2, ally: 2 }] }],
  }),
  'EC.04': d({
    id: 'EC.04', name: 'EC.04', kind: 'occupy', cost: 0, basePoints: 75, school: 'neutral', rarity: 'basic', timer: 3,
    text: '计时3：所有敌方卡牌-1。',
    effects: [{ timing: 'timer', ops: [{ op: 'damage', sel: 'allEnemies', n: 1 }] }],
  }),
  'EC.05': d({
    id: 'EC.05', name: 'EC.05', kind: 'occupy', cost: 0, basePoints: 25, school: 'neutral', rarity: 'basic',
    text: '回合结束沿竖列移动（可覆盖）。覆盖时相邻敌方-1。',
    effects: [
      { timing: 'turnEnd', ops: [{ op: 'moveColumn' }] },
      { timing: 'onCover', ops: [{ op: 'damage', sel: 'adjacentEnemies', n: 1 }] },
    ],
  }),
  'EC.06': d({
    id: 'EC.06', name: 'EC.06', kind: 'occupy', cost: 0, basePoints: 18, school: 'neutral', rarity: 'basic',
    text: '驻场本排敌方-2。',
    auras: [{ aura: 'rowOpponents', n: -2 }],
    effects: [],
  }),
  'EC.07': d({
    id: 'EC.07', name: 'EC.07', kind: 'occupy', cost: 0, basePoints: 20, school: 'neutral', rarity: 'basic',
    text: '驻场本列敌方-2。回合结束随机左右移动。',
    auras: [{ aura: 'columnOpponents', n: -2 }],
    effects: [{ timing: 'turnEnd', ops: [{ op: 'moveRowRandom' }] }],
  }),
  'EC.10': d({
    id: 'EC.10', name: 'EC.10', kind: 'occupy', cost: 0, basePoints: 24, school: 'neutral', rarity: 'basic',
    text: '回合开始每有一张相邻敌方，本卡+2。',
    effects: [{ timing: 'turnStart', ops: [{ op: 'buff', sel: 'self', n: 'adjacentEnemiesToSelf' }] }],
  }),
  'EC.11': d({
    id: 'EC.11', name: 'EC.11', kind: 'occupy', cost: 0, basePoints: 10, school: 'neutral', rarity: 'basic',
    text: '回合结束将一张 PC.X01 洗入敌方牌组。',
    effects: [{ timing: 'turnEnd', ops: [{ op: 'pollute', defId: 'PC.X01' }] }],
  }),
  'EC.16': d({
    id: 'EC.16', name: 'EC.16', kind: 'occupy', cost: 0, basePoints: 18, school: 'neutral', rarity: 'basic',
    text: '回合结束使敌方手牌一张占场-2；降到 0 则弃牌，化身-2。',
    effects: [{ timing: 'turnEnd', ops: [{ op: 'nibbleHandOccupy', n: 2 }] }],
  }),
  'EC.17': d({
    id: 'EC.17', name: 'EC.17', kind: 'occupy', cost: 0, basePoints: 16, school: 'neutral', rarity: 'basic',
    text: '回合开始（解封后）封印相邻敌方中点数最高者。',
    effects: [{ timing: 'turnStart', ops: [{ op: 'sealHighestAdjacentOpponent' }] }],
  }),
  'EC.19': d({
    id: 'EC.19', name: 'EC.19', kind: 'occupy', cost: 0, basePoints: 2, school: 'neutral', rarity: 'basic',
    text: '驻场敌方不能打出到与本卡相邻的空格。离场化身-2。',
    auras: [{ aura: 'fence' }],
    effects: [{ timing: 'leave', ops: [{ op: 'damage', sel: 'playerAvatar', n: 2 }] }],
  }),
  'EC.21': d({
    id: 'EC.21', name: 'EC.21', kind: 'occupy', cost: 0, basePoints: 26, school: 'neutral', rarity: 'basic',
    text: '每当敌方打出一张法术，本卡+2，并随机一张敌方卡牌-1。',
    effects: [],
  }),
  'EC.22': d({
    id: 'EC.22', name: 'EC.22', kind: 'occupy', cost: 0, basePoints: 10, school: 'neutral', rarity: 'basic',
    text: '回合开始若敌方牌组 ≥ 6 则+3，否则-3。',
    effects: [{ timing: 'turnStart', ops: [{ op: 'deckThick', ge: 6, plus: 3, minus: 3 }] }],
  }),
  'EC.23': d({
    id: 'EC.23', name: 'EC.23', kind: 'occupy', cost: 0, basePoints: 36, school: 'neutral', rarity: 'basic',
    text: '驻场每有一张相邻敌方，本卡+4。',
    auras: [{ aura: 'perAdjacentOpponent', n: 4 }],
    effects: [],
  }),
}

export function cardDef(id: string): CardDef {
  const def = CARDS[id]
  if (!def) throw new Error(`Unknown card: ${id}`)
  return def
}

export function cardName(id: string): string {
  return CARDS[id]?.name ?? id
}

export function isNegative(id: string): boolean {
  return cardDef(id).extra === 'negative'
}

export function isRewardable(id: string): boolean {
  const def = CARDS[id]
  return def.rarity !== 'basic' && def.extra !== 'negative' && !id.startsWith('EC.')
}

export function playerCardIds(): string[] {
  return Object.keys(CARDS).filter((id) => id.startsWith('PC.'))
}

export function bodyCard(def: CardDef): boolean {
  return isBodyKind(def.kind)
}
