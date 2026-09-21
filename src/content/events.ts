import type { FloorId } from '../domain/types'

export type EventWeight = 'high' | 'mid' | 'low'

export interface EventOptionDef {
  index: 0 | 1 | 2
  label: string
  text: string
  needsCard?: boolean
  needsCard2?: boolean
}

export interface EventDef {
  id: string
  name: string
  floors: FloorId[]
  weight: EventWeight
  needNegative?: boolean
  options: EventOptionDef[]
}

export const EVENT_WEIGHT: Record<EventWeight, number> = { high: 65, mid: 30, low: 5 }

export const EVENTS: Record<string, EventDef> = {
  'EV.01': {
    id: 'EV.01', name: 'EV.01', floors: [1], weight: 'mid',
    options: [
      { index: 0, label: 'EV.01.A', text: '获得 30 金币' },
      { index: 1, label: 'EV.01.B', text: '获得一件随机遗物，血量 -4' },
    ],
  },
  'EV.02': {
    id: 'EV.02', name: 'EV.02', floors: [1], weight: 'mid',
    options: [
      { index: 0, label: 'EV.02.A', text: '回复血条上限 30% 的血量' },
      { index: 1, label: 'EV.02.B', text: '50% 获得 80 金币，50% 血量 -6' },
    ],
  },
  'EV.03': {
    id: 'EV.03', name: 'EV.03', floors: [1], weight: 'mid',
    options: [
      { index: 0, label: 'EV.03.A', text: '血量 -2，获得 1 张随机卡牌' },
      { index: 1, label: 'EV.03.B', text: '获得 1 张随机卡牌和 1 张随机负面卡' },
      { index: 2, label: 'EV.03.C', text: '无' },
    ],
  },
  'EV.04': {
    id: 'EV.04', name: 'EV.04', floors: [1, 2, 3], weight: 'high',
    options: [
      { index: 0, label: 'EV.04.A', text: '移除卡盒中一张非负面卡', needsCard: true },
      { index: 1, label: 'EV.04.B', text: '一张卡基础点 +1 并复制一份', needsCard: true },
    ],
  },
  'EV.05': {
    id: 'EV.05', name: 'EV.05', floors: [1, 2], weight: 'mid',
    options: [
      { index: 0, label: 'EV.05.A', text: '获得一张本体系金卡和一张 PC.X02' },
      { index: 1, label: 'EV.05.B', text: '获得一张本体系蓝卡' },
    ],
  },
  'EV.06': {
    id: 'EV.06', name: 'EV.06', floors: [1, 2, 3], weight: 'mid',
    options: [
      { index: 0, label: 'EV.06.A', text: '移除一张非负面卡，按稀有度得金', needsCard: true },
      { index: 1, label: 'EV.06.B', text: '支付 40 金币，一张卡基础点 +3', needsCard: true },
    ],
  },
  'EV.07': {
    id: 'EV.07', name: 'EV.07', floors: [1, 2, 3], weight: 'mid',
    options: [
      { index: 0, label: 'EV.07.A', text: '将一张白卡复制两份', needsCard: true },
      { index: 1, label: 'EV.07.B', text: '将一张蓝卡复制一份', needsCard: true },
      { index: 2, label: 'EV.07.C', text: '血量 -5，将一张金卡复制一份', needsCard: true },
    ],
  },
  'EV.09': {
    id: 'EV.09', name: 'EV.09', floors: [1, 2, 3], weight: 'high',
    options: [
      { index: 0, label: 'EV.09.A', text: '从三张本体系蓝卡中挑选一张' },
      { index: 1, label: 'EV.09.B', text: '获得一张随机中立卡和 15 金币' },
    ],
  },
  'EV.10': {
    id: 'EV.10', name: 'EV.10', floors: [1, 2, 3], weight: 'mid', needNegative: true,
    options: [
      { index: 0, label: 'EV.10.A', text: '移除所有负面卡，每张血量 -3' },
      { index: 1, label: 'EV.10.B', text: '每张支付 25 金币移除所有负面卡' },
      { index: 2, label: 'EV.10.C', text: '保留负面卡，每张获得 20 金币' },
    ],
  },
  'EV.11': {
    id: 'EV.11', name: 'EV.11', floors: [1, 2, 3], weight: 'low',
    options: [
      { index: 0, label: 'EV.11.A', text: '支付 30 金币：50% 本体系金卡，50% PC.X01' },
    ],
  },
  'EV.14': {
    id: 'EV.14', name: 'EV.14', floors: [1, 2, 3], weight: 'high',
    options: [
      { index: 0, label: 'EV.14.A', text: '回复 8 血量' },
      { index: 1, label: 'EV.14.B', text: '血量 -4，一张卡基础点 +2', needsCard: true },
      { index: 2, label: 'EV.14.C', text: '血量 -8，两张不同卡基础点各 +2', needsCard: true, needsCard2: true },
    ],
  },
  'EV.15': {
    id: 'EV.15', name: 'EV.15', floors: [1, 2], weight: 'mid',
    options: [
      { index: 0, label: 'EV.15.A', text: '获得 45 金币' },
      { index: 1, label: 'EV.15.B', text: '获得一件随机遗物' },
      { index: 2, label: 'EV.15.C', text: '下一次进商店所有价格 -30%' },
    ],
  },
  'EV.17': {
    id: 'EV.17', name: 'EV.17', floors: [1, 2, 3], weight: 'mid',
    options: [
      { index: 0, label: 'EV.17.A', text: '移除一张蓝或金卡，获得两张白卡和 20 金', needsCard: true },
      { index: 1, label: 'EV.17.B', text: '移除两张白卡，获得一张本体系蓝卡', needsCard: true, needsCard2: true },
    ],
  },
  'EV.EMPTY': {
    id: 'EV.EMPTY', name: 'EV.EMPTY', floors: [1, 2, 3], weight: 'low',
    options: [{ index: 0, label: 'EV.EMPTY.A', text: '获得 15 金币' }],
  },
}

export function eventDef(id: string): EventDef {
  const def = EVENTS[id]
  if (!def) throw new Error(`Unknown event: ${id}`)
  return def
}

export function eventsForFloor(floor: FloorId): EventDef[] {
  return Object.values(EVENTS).filter((e) => e.id !== 'EV.EMPTY' && e.floors.includes(floor))
}
