import { create } from 'zustand'
import type { CellId, PlayCardAction } from '../../../../game/types'

type Handlers = {
  allows: (instanceId: string, cell: CellId) => boolean
  picks: (cell: CellId) => boolean
  answers: (cell: CellId) => boolean
  play: (action: PlayCardAction) => string | undefined
  land: () => void
  answer: (cell: CellId) => void
  /** A hand click that needs no further pick. Field cards and targeted spells ignore it. */
  commit: (instanceId: string) => void
}

const idle: Handlers = {
  allows: () => false,
  picks: () => false,
  answers: () => false,
  play: () => 'MATCH_NOT_READY',
  land: () => undefined,
  answer: () => undefined,
  commit: () => undefined,
}

type CueState = Handlers & {
  bound: boolean
  tick: number
  picksIds: string[]
  /** Board cards still waiting to be chosen. Empty once the pick is cancelled or filled. */
  offerIds: string[]
  stained: CellId[]
  bind: (handlers: Handlers) => void
  clear: () => void
  bump: (picksIds?: string[], stained?: CellId[]) => void
  setOffers: (offerIds: string[]) => void
}

export const useBattleCue = create<CueState>((set, get) => ({
  ...idle,
  bound: false,
  tick: 0,
  picksIds: [],
  offerIds: [],
  stained: [],
  bind: (handlers) => set({ ...handlers, bound: true, tick: get().tick + 1 }),
  clear: () => set({ ...idle, bound: false, picksIds: [], offerIds: [], stained: [], tick: get().tick + 1 }),
  bump: (picksIds, stained) => set({
    tick: get().tick + 1,
    picksIds: picksIds ?? get().picksIds,
    stained: stained ?? get().stained,
  }),
  setOffers: (offerIds) => {
    const current = get().offerIds
    if (current.length === offerIds.length && current.every((id, index) => id === offerIds[index])) return
    set({ offerIds: [...offerIds] })
  },
}))
