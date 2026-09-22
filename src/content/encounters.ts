import type { Cell } from '../domain/geometry'
import type { FloorId } from '../domain/types'
import { cardDef } from './cards'

export type MonsterTier = 'normal' | 'elite' | 'boss'

export interface EncounterSlot {
  defId: string
  cell: Cell
}

export interface EncounterDef {
  id: string
  name: string
  tier: MonsterTier
  floors: FloorId[]
  openingBase: number
  setup: EncounterSlot[]
}

/** 第 1 层遭遇。后两层没有新数据，抽取池复用这一批。 */
const ALL_FLOORS: FloorId[] = [1, 2, 3]

export const ENCOUNTERS: Record<string, EncounterDef> = {
  'MON.N01': { id: 'MON.N01', name: 'MON.N01', tier: 'normal', floors: ALL_FLOORS, openingBase: 30, setup: [{ defId: 'EC.01', cell: 3 }] },
  'MON.N02': { id: 'MON.N02', name: 'MON.N02', tier: 'normal', floors: ALL_FLOORS, openingBase: 38, setup: [{ defId: 'EC.06', cell: 2 }, { defId: 'EC.07', cell: 9 }] },
  'MON.N04': { id: 'MON.N04', name: 'MON.N04', tier: 'normal', floors: ALL_FLOORS, openingBase: 44, setup: [{ defId: 'EC.10', cell: 5 }, { defId: 'EC.11', cell: 1 }, { defId: 'EC.11', cell: 9 }] },
  'MON.N05': { id: 'MON.N05', name: 'MON.N05', tier: 'normal', floors: ALL_FLOORS, openingBase: 36, setup: [{ defId: 'EC.16', cell: 1 }, { defId: 'EC.16', cell: 9 }] },
  'MON.N06': { id: 'MON.N06', name: 'MON.N06', tier: 'normal', floors: ALL_FLOORS, openingBase: 6, setup: [{ defId: 'EC.19', cell: 1 }, { defId: 'EC.19', cell: 2 }, { defId: 'EC.19', cell: 9 }] },
  'MON.E01': { id: 'MON.E01', name: 'MON.E01', tier: 'elite', floors: ALL_FLOORS, openingBase: 30, setup: [{ defId: 'EC.02', cell: 1 }, { defId: 'EC.02', cell: 2 }, { defId: 'EC.02', cell: 3 }] },
  'MON.B01': { id: 'MON.B01', name: 'MON.B01', tier: 'boss', floors: ALL_FLOORS, openingBase: 125, setup: [{ defId: 'EC.04', cell: 5 }, { defId: 'EC.05', cell: 4 }, { defId: 'EC.05', cell: 6 }] },
}

export function encounterDef(id: string): EncounterDef {
  const def = ENCOUNTERS[id]
  if (!def) throw new Error(`Unknown encounter: ${id}`)
  return def
}

export function poolFor(tier: MonsterTier, floor: FloorId): EncounterDef[] {
  return Object.values(ENCOUNTERS).filter((e) => e.tier === tier && e.floors.includes(floor))
}

export function openingBaseOf(setup: EncounterSlot[]): number {
  return setup.reduce((sum, slot) => sum + cardDef(slot.defId).basePoints, 0)
}
