import { create } from 'zustand'
import type { CellId, PlayCardAction } from '../../../../game/types'

type Handlers = {
  allows: (instanceId: string, cell: CellId) => boolean
  picks: (cell: CellId) => boolean
  answers: (cell: CellId) => boolean
  play: (action: PlayCardAction) => string | undefined
  land: () => void
  answer: (cell: CellId) => void
}

const idle: Handlers = {
  allows: () => false,
  picks: () => false,
  answers: () => false,
  play: () => 'MATCH_NOT_READY',
  land: () => undefined,
  answer: () => undefined,
}

type CueState = Handlers & {
  bound: boolean
  tick: number
  picksIds: string[]
  stained: CellId[]
  bind: (handlers: Handlers) => void
  clear: () => void
  bump: (picksIds?: string[], stained?: CellId[]) => void
}

export const useBattleCue = create<CueState>((set, get) => ({
  ...idle,
  bound: false,
  tick: 0,
  picksIds: [],
  stained: [],
  bind: (handlers) => set({ ...handlers, bound: true, tick: get().tick + 1 }),
  clear: () => set({ ...idle, bound: false, picksIds: [], stained: [], tick: get().tick + 1 }),
  bump: (picksIds, stained) => set({
    tick: get().tick + 1,
    picksIds: picksIds ?? get().picksIds,
    stained: stained ?? get().stained,
  }),
}))
