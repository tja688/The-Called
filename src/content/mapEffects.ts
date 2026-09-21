import type { FloorId } from '../domain/types'

export interface MapEffectDef {
  id: string
  text: string
  floors: FloorId[]
  kind: 'adjacentAlly' | 'onCoverMinus' | 'corner' | 'centerMinus' | 'mirrorPlay' | 'fullRow' | 'isolated' | 'diagEnemy' | 'coveredAdj'
}

export const MAP_EFFECTS: Record<string, MapEffectDef> = {
  'ME.01': { id: 'ME.01', text: '每张卡每有一张相邻己方，点数+1。', floors: [1], kind: 'adjacentAlly' },
  'ME.02': { id: 'ME.02', text: '覆盖者点数-1。', floors: [1], kind: 'onCoverMinus' },
  'ME.03': { id: 'ME.03', text: '角落格上的卡牌点数+1。', floors: [1], kind: 'corner' },
  'ME.04': { id: 'ME.04', text: '中心格上的卡牌点数-2。', floors: [2], kind: 'centerMinus' },
  'ME.05': { id: 'ME.05', text: '打出时若镜像格有己方，该卡+2。', floors: [2], kind: 'mirrorPlay' },
  'ME.06': { id: 'ME.06', text: '一排三张己方时该排己方+3。', floors: [2], kind: 'fullRow' },
  'ME.07': { id: 'ME.07', text: '上下左右均无相邻卡的卡牌+3。', floors: [3], kind: 'isolated' },
  'ME.08': { id: 'ME.08', text: '斜交相邻有敌方的卡牌-2。', floors: [3], kind: 'diagEnemy' },
  'ME.09': { id: 'ME.09', text: '被覆盖进弃牌堆时相邻己方-1。', floors: [3], kind: 'coveredAdj' },
}

export function mapEffectsFor(floor: FloorId): MapEffectDef[] {
  return Object.values(MAP_EFFECTS).filter((m) => m.floors.includes(floor))
}

export function mapEffectDef(id: string): MapEffectDef {
  const def = MAP_EFFECTS[id]
  if (!def) throw new Error(`Unknown map effect: ${id}`)
  return def
}
