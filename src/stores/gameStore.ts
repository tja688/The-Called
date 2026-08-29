import { create } from 'zustand'
import { beginnerMonsterDeck, beginnerPlayerDeck } from '../config/decks'
import { chooseMonsterAction } from '../game/ai/monsterAI'
import { createMatch, playCard } from '../game/core/matchEngine'
import type { MatchState, PlayCardAction } from '../game/types'

type GameStore = {
  match: MatchState | null
  activePlacement?: PlayCardAction
  initialize: (levelId: string, monsterId: string) => void
  play: (action: PlayCardAction) => string | undefined
  playMonsterTurn: () => void
  settlePlacement: (cardInstanceId: string) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  match: null,
  initialize: (levelId, monsterId) => set({
    // All current encounters intentionally share one monster deck and ruleset.
    match: createMatch(levelId, monsterId, beginnerPlayerDeck, beginnerMonsterDeck),
    activePlacement: undefined,
  }),
  play: (action) => {
    const match = get().match
    if (!match) return 'MATCH_NOT_READY'
    const result = playCard(match, action)
    if (!result.error) set({ match: result.state, activePlacement: action })
    return result.error
  },
  playMonsterTurn: () => {
    const match = get().match
    if (!match) return
    const action = chooseMonsterAction(match)
    if (!action) return
    const result = playCard(match, action)
    if (!result.error) set({ match: result.state, activePlacement: action })
  },
  settlePlacement: (cardInstanceId) => set((state) =>
    state.activePlacement?.cardInstanceId === cardInstanceId
      ? { activePlacement: undefined }
      : state,
  ),
}))
