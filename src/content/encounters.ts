import type { EncounterId } from '../domain/types'
import type { Cell } from '../domain/geometry'
import { ANCHORS } from './anchors'

export interface EncounterSlot {
  defId: string
  cell: Cell
}

export interface EncounterDef {
  id: EncounterId
  name: string
  boss: boolean
  openingFinal: number
  setup: EncounterSlot[]
}

export const ENCOUNTERS: Record<EncounterId, EncounterDef> = {
  yuZhuang: {
    id: 'yuZhuang',
    name: '余桩',
    boss: false,
    openingFinal: ANCHORS.openingFinal.yuZhuang,
    setup: [
      { defId: 'E1A', cell: 1 },
      { defId: 'E1B', cell: 5 },
      { defId: 'E1A', cell: 9 },
    ],
  },
  boShou: {
    id: 'boShou',
    name: '剥手',
    boss: false,
    openingFinal: ANCHORS.openingFinal.boShou,
    setup: [
      { defId: 'E2A', cell: 1 },
      { defId: 'E1A', cell: 3 },
      { defId: 'E2B', cell: 8 },
    ],
  },
  shouMen: {
    id: 'shouMen',
    name: '守门',
    boss: true,
    openingFinal: ANCHORS.openingFinal.shouMen,
    setup: [
      { defId: 'E3A', cell: 1 },
      { defId: 'E3B', cell: 2 },
      { defId: 'E3A', cell: 3 },
      { defId: 'E3C', cell: 5 },
    ],
  },
}

export function encounterDef(id: EncounterId): EncounterDef {
  return ENCOUNTERS[id]
}
