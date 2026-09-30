import { create } from 'zustand'
import type { CardInstance, CellId, MatchState, PlayCardAction, PlayResolution } from '../game/types'
import { useBattleCue } from '../game/v6/view/battle/cue'
import { useInteractionStore } from './interactionStore'
import { usePresentationStore } from './presentationStore'

export type MonsterTelegraph = {
  card: CardInstance
  /** Cell chosen before the card flies. The render loop only animates this. */
  cellId?: CellId
}

type GameStore = {
  match: MatchState | null
  battleKey: number
  activePlacement?: PlayCardAction
  telegraph?: MonsterTelegraph
  resolution?: PlayResolution
  placementSettled: boolean
  abandon: () => void
  play: (action: PlayCardAction) => string | undefined
  playMonsterTurn: () => void
  settlePlacement: (cardInstanceId: string) => void
  finishResolution: () => void
}

function releaseBattleView() {
  usePresentationStore.getState().setInputLocked(false)
  useInteractionStore.getState().resetBattleView()
}

export const useGameStore = create<GameStore>((set) => ({
  match: null,
  battleKey: 0,
  placementSettled: false,
  abandon: () => {
    releaseBattleView()
    set({
      match: null,
      activePlacement: undefined,
      telegraph: undefined,
      resolution: undefined,
      placementSettled: false,
    })
  },
  play: (action) => {
    if (useBattleCue.getState().bound) return useBattleCue.getState().play(action)
    return 'MATCH_NOT_READY'
  },
  playMonsterTurn: () => {
    if (useBattleCue.getState().bound) useBattleCue.getState().land()
  },
  settlePlacement: (cardInstanceId) => set((state) =>
    state.activePlacement?.cardInstanceId === cardInstanceId
      ? { activePlacement: undefined, placementSettled: Boolean(state.resolution) }
      : state,
  ),
  finishResolution: () => {
    usePresentationStore.getState().setInputLocked(false)
    set({ resolution: undefined, placementSettled: false })
  },
}))
