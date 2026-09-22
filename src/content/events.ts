import type { FloorId } from '../domain/types'
import { isNegative } from './cards'

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

const ALL: FloorId[] = [1, 2, 3]

export const EVENTS: Record<string, EventDef> = {
  'EV.01': {
    id: 'EV.01', name: 'EV.01', floors: [1], weight: 'high',
    options: [
      { index: 0, label: 'EV.01.A', text: '获得 30 金币' },
      { index: 1, label: 'EV.01.B', text: '获得一件随机遗物，血量 -5' },
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
      { index: 0, label: 'EV.03.A', text: '获得 25 金币' },
      { index: 1, label: 'EV.03.B', text: '获得 1 张随机金卡，并获得 1 张随机负面卡' },
      { index: 2, label: 'EV.03.C', text: '无' },
    ],
  },
  'EV.04': {
    id: 'EV.04', name: 'EV.04', floors: ALL, weight: 'high',
    options: [
      { index: 0, label: 'EV.04.A', text: '移除卡盒中一张负面卡牌', needsCard: true },
      { index: 1, label: 'EV.04.B', text: '卡盒中一张卡牌基础点数 +1，并将其复制一份放入卡盒', needsCard: true },
      { index: 2, label: 'EV.04.C', text: '无' },
    ],
  },
  'EV.05': {
    id: 'EV.05', name: 'EV.05', floors: ALL, weight: 'mid',
    options: [
      { index: 0, label: 'EV.05.A', text: '获得一张随机金卡' },
      { index: 1, label: 'EV.05.B', text: '获得一张随机蓝卡' },
    ],
  },
  'EV.06': {
    id: 'EV.06', name: 'EV.06', floors: ALL, weight: 'mid',
    options: [
      { index: 0, label: 'EV.06.A', text: '移除卡盒中一张非负面卡牌，按其稀有度获得金币', needsCard: true },
      { index: 1, label: 'EV.06.B', text: '支付 40 金币，卡盒中一张卡牌基础点数 +3', needsCard: true },
    ],
  },
  'EV.09': {
    id: 'EV.09', name: 'EV.09', floors: ALL, weight: 'high',
    options: [
      { index: 0, label: 'EV.09.A', text: '从三张随机蓝卡中挑选一张' },
      { index: 1, label: 'EV.09.B', text: '从三张随机中立卡中挑选一张' },
    ],
  },
  'EV.10': {
    id: 'EV.10', name: 'EV.10', floors: ALL, weight: 'mid', needNegative: true,
    options: [
      { index: 0, label: 'EV.10.A', text: '移除卡盒中所有负面卡，每张血量 -3' },
      { index: 1, label: 'EV.10.B', text: '每张支付 25 金币，移除卡盒中所有负面卡' },
      { index: 2, label: 'EV.10.C', text: '获得一张随机负面卡，获得 20 金币' },
    ],
  },
  'EV.11': {
    id: 'EV.11', name: 'EV.11', floors: ALL, weight: 'low',
    options: [
      { index: 0, label: 'EV.11.A', text: '支付 30 金币：50% 获得一张随机金卡，50% 获得一张随机白卡' },
      { index: 1, label: 'EV.11.B', text: '无' },
    ],
  },
  'EV.13': {
    id: 'EV.13', name: 'EV.13', floors: ALL, weight: 'mid',
    options: [
      { index: 0, label: 'EV.13.A', text: '卡盒中所有非负面卡基础点数 +1' },
      { index: 1, label: 'EV.13.B', text: '获得一件随机遗物与 30 金币' },
      { index: 2, label: 'EV.13.C', text: '无' },
    ],
  },
  'EV.15': {
    id: 'EV.15', name: 'EV.15', floors: ALL, weight: 'mid',
    options: [
      { index: 0, label: 'EV.15.A', text: '获得 45 金币' },
      { index: 1, label: 'EV.15.B', text: '获得一件随机遗物和一张负面卡' },
      { index: 2, label: 'EV.15.C', text: '下一次进入商店时所有价格 -30%' },
    ],
  },
  'EV.16': {
    id: 'EV.16', name: 'EV.16', floors: ALL, weight: 'low',
    options: [
      { index: 0, label: 'EV.16.A', text: '立即进行一场本层普通战斗；胜利后额外获得一次三选一与 25 金币' },
      { index: 1, label: 'EV.16.B', text: '无' },
    ],
  },
  'EV.EMPTY': {
    id: 'EV.EMPTY', name: 'EV.EMPTY', floors: ALL, weight: 'low',
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

export function eventCardEligible(ev: EventDef, index: number, defId: string): boolean {
  if (ev.id === 'EV.04' && index === 0) return isNegative(defId)
  if (ev.id === 'EV.06' && index === 0) return !isNegative(defId)
  return true
}

export function eventOptionEnabled(
  ev: EventDef,
  index: number,
  ctx: { gold: number; box: Array<{ defId: string }> },
): boolean {
  const opt = ev.options[index]
  if (!opt) return false
  if (ev.id === 'EV.06' && index === 1) return ctx.gold >= 40
  if (ev.id === 'EV.10' && index === 1) {
    const n = ctx.box.filter((c) => isNegative(c.defId)).length
    return ctx.gold >= n * 25
  }
  if (ev.id === 'EV.11' && index === 0) return ctx.gold >= 30
  if (ev.id === 'EV.13' && index === 0) return ctx.box.length <= 12
  if (ev.id === 'EV.13' && index === 1) return ctx.box.length >= 18
  if (opt.needsCard) {
    const eligible = ctx.box.filter((c) => eventCardEligible(ev, index, c.defId))
    if (!eligible.length) return false
    if (opt.needsCard2 && eligible.length < 2) return false
  }
  return true
}
