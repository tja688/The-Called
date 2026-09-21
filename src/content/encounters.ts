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

export const ENCOUNTERS: Record<string, EncounterDef> = {
  'MON.N01': { id: 'MON.N01', name: 'MON.N01', tier: 'normal', floors: [1], openingBase: 30, setup: [{ defId: 'EC.01', cell: 3 }] },
  'MON.N02': { id: 'MON.N02', name: 'MON.N02', tier: 'normal', floors: [1], openingBase: 26, setup: [{ defId: 'EC.07', cell: 2 }, { defId: 'EC.08', cell: 9 }] },
  'MON.N03': { id: 'MON.N03', name: 'MON.N03', tier: 'normal', floors: [1], openingBase: 28, setup: [{ defId: 'EC.09', cell: 4 }, { defId: 'EC.15', cell: 6 }, { defId: 'EC.13', cell: 8 }] },
  'MON.N04': { id: 'MON.N04', name: 'MON.N04', tier: 'normal', floors: [2], openingBase: 36, setup: [{ defId: 'EC.10', cell: 5 }, { defId: 'EC.08', cell: 1 }, { defId: 'EC.08', cell: 9 }] },
  'MON.N05': { id: 'MON.N05', name: 'MON.N05', tier: 'normal', floors: [2], openingBase: 40, setup: [{ defId: 'EC.06', cell: 4 }, { defId: 'EC.21', cell: 3 }, { defId: 'EC.22', cell: 8 }] },
  'MON.N06': { id: 'MON.N06', name: 'MON.N06', tier: 'normal', floors: [2], openingBase: 40, setup: [{ defId: 'EC.11', cell: 2 }, { defId: 'EC.20', cell: 5 }, { defId: 'EC.13', cell: 7 }] },
  'MON.N07': { id: 'MON.N07', name: 'MON.N07', tier: 'normal', floors: [3], openingBase: 50, setup: [{ defId: 'EC.17', cell: 5 }, { defId: 'EC.12', cell: 1 }, { defId: 'EC.16', cell: 9 }] },
  'MON.N08': { id: 'MON.N08', name: 'MON.N08', tier: 'normal', floors: [3], openingBase: 52, setup: [{ defId: 'EC.06', cell: 2 }, { defId: 'EC.07', cell: 4 }, { defId: 'EC.15', cell: 9 }, { defId: 'EC.08', cell: 7 }] },
  'MON.N09': { id: 'MON.N09', name: 'MON.N09', tier: 'normal', floors: [3], openingBase: 52, setup: [{ defId: 'EC.01', cell: 3 }, { defId: 'EC.13', cell: 7 }, { defId: 'EC.22', cell: 5 }] },
  'MON.E01': { id: 'MON.E01', name: 'MON.E01', tier: 'elite', floors: [1], openingBase: 30, setup: [{ defId: 'EC.02', cell: 1 }, { defId: 'EC.02', cell: 2 }, { defId: 'EC.02', cell: 3 }] },
  'MON.E04': { id: 'MON.E04', name: 'MON.E04', tier: 'elite', floors: [1], openingBase: 30, setup: [{ defId: 'EC.19', cell: 8 }, { defId: 'EC.12', cell: 1 }, { defId: 'EC.09', cell: 3 }] },
  'MON.E02': { id: 'MON.E02', name: 'MON.E02', tier: 'elite', floors: [2], openingBase: 54, setup: [{ defId: 'EC.06', cell: 4 }, { defId: 'EC.06', cell: 6 }, { defId: 'EC.16', cell: 8 }] },
  'MON.E03': { id: 'MON.E03', name: 'MON.E03', tier: 'elite', floors: [3], openingBase: 64, setup: [{ defId: 'EC.20', cell: 5 }, { defId: 'EC.12', cell: 1 }, { defId: 'EC.17', cell: 9 }, { defId: 'EC.16', cell: 8 }] },
  'MON.B02': { id: 'MON.B02', name: 'MON.B02', tier: 'boss', floors: [1], openingBase: 80, setup: [{ defId: 'EC.18', cell: 5 }, { defId: 'EC.07', cell: 2 }, { defId: 'EC.07', cell: 8 }] },
  'MON.B03': { id: 'MON.B03', name: 'MON.B03', tier: 'boss', floors: [2], openingBase: 80, setup: [{ defId: 'EC.23', cell: 5 }, { defId: 'EC.17', cell: 2 }, { defId: 'EC.17', cell: 8 }, { defId: 'EC.21', cell: 4 }] },
  'MON.B01': { id: 'MON.B01', name: 'MON.B01', tier: 'boss', floors: [3], openingBase: 125, setup: [{ defId: 'EC.04', cell: 5 }, { defId: 'EC.05', cell: 4 }, { defId: 'EC.05', cell: 6 }] },
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
