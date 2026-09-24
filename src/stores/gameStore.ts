import { create } from 'zustand'
import { beginnerMonsterDeck, beginnerPlayerDeck } from '../config/decks'
import { chooseMonsterAction } from '../game/ai/monsterAI'
import { createMatch, passTurn, playCard, resolveFinalBattleTurn as resolveFinalBattleTurnState } from '../game/core/matchEngine'
import type { CardInstance, MatchState, PlayCardAction, PlayResolution } from '../game/types'
import { usePresentationStore } from './presentationStore'

export type MonsterTelegraph = {
  action: PlayCardAction
  card: CardInstance
}

type GameStore = {
  match: MatchState | null
  activePlacement?: PlayCardAction
  telegraph?: MonsterTelegraph
  resolution?: PlayResolution
  placementSettled: boolean
  initialize: (levelId: string, monsterId: string) => void
  play: (action: PlayCardAction) => string | undefined
  prepareMonsterTurn: () => boolean
  playMonsterTurn: () => void
  resolveFinalBattleTurn: () => void
  settlePlacement: (cardInstanceId: string) => void
  finishResolution: () => void
}

function applyPlay(result: { state: MatchState; resolution?: PlayResolution }, action: PlayCardAction) {
  const busy = Boolean(result.resolution && (result.resolution.cover || result.resolution.removed.length > 0))
  if (busy) usePresentationStore.getState().setInputLocked(true)
  return {
    match: result.state,
    activePlacement: action,
    resolution: busy ? result.resolution : undefined,
    placementSettled: false,
    telegraph: undefined,
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  match: null,
  placementSettled: false,
  initialize: (levelId, monsterId) => {
    usePresentationStore.getState().setInputLocked(false)
    set({
      // All current encounters intentionally share one monster deck and ruleset.
      match: createMatch(levelId, monsterId, beginnerPlayerDeck, beginnerMonsterDeck),
      activePlacement: undefined,
      telegraph: undefined,
      resolution: undefined,
      placementSettled: false,
    })
  },
  play: (action) => {
    const match = get().match
    if (!match) return 'MATCH_NOT_READY'
    if (usePresentationStore.getState().inputLocked) return 'RESOLVING'
    const result = playCard(match, action)
    if (!result.error && result.resolution) set(applyPlay(result as { state: MatchState; resolution: PlayResolution }, action))
    return result.error
  },
  prepareMonsterTurn: () => {
    const match = get().match
    if (!match || match.status !== 'playing' || match.turn !== 'monster' || match.openingTurn) return false
    if (get().telegraph) return true
    const action = chooseMonsterAction(match)
    const card = action ? match.monster.hand.find((candidate) => candidate.instanceId === action.cardInstanceId) : undefined
    if (!action || !card) {
      set({ match: passTurn(match), telegraph: undefined })
      return false
    }
    set({ telegraph: { action, card: { ...card } } })
    return true
  },
  playMonsterTurn: () => {
    const match = get().match
    const telegraph = get().telegraph
    if (!match || match.openingTurn || !telegraph) return
    const result = playCard(match, telegraph.action)
    if (result.error || !result.resolution) {
      set({ telegraph: undefined })
      return
    }
    set(applyPlay(result as { state: MatchState; resolution: PlayResolution }, telegraph.action))
  },
  resolveFinalBattleTurn: () => {
    const match = get().match
    if (!match) return
    const next = resolveFinalBattleTurnState(match)
    if (next !== match) set({ match: next })
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
