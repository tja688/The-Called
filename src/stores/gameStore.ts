import { create } from 'zustand'
import { beginnerMonsterDeck, beginnerPlayerDeck, type DeckConfig } from '../config/decks'
import { chooseMonsterAction } from '../game/ai/monsterAI'
import { createMatch, passTurn, playCard, resolveFinalBattleTurn as resolveFinalBattleTurnState } from '../game/core/matchEngine'
import type { CardInstance, MatchState, PlayCardAction, PlayResolution } from '../game/types'
import { getBattleDeck } from './deckStore'
import { useInteractionStore } from './interactionStore'
import { usePresentationStore } from './presentationStore'

export type MonsterTelegraph = {
  card: CardInstance
}

function monsterProfile(deck: DeckConfig) {
  return { opponentDeck: deck }
}

function commitMonsterIntent(state: MatchState, deck: DeckConfig): MonsterTelegraph | undefined {
  if (state.status !== 'playing') return undefined
  const sandbox = structuredClone(state)
  sandbox.turn = 'monster'
  sandbox.openingTurn = false
  const action = chooseMonsterAction(sandbox, monsterProfile(deck))
  const card = action ? state.monster.hand.find((candidate) => candidate.instanceId === action.cardInstanceId) : undefined
  return card ? { card: { ...card } } : undefined
}

type GameStore = {
  match: MatchState | null
  /** Deck list the encounter is allowed to know for this match. */
  opponentDeck: DeckConfig
  battleKey: number
  activePlacement?: PlayCardAction
  telegraph?: MonsterTelegraph
  resolution?: PlayResolution
  placementSettled: boolean
  initialize: (levelId: string, monsterId: string) => void
  abandon: () => void
  play: (action: PlayCardAction) => string | undefined
  prepareMonsterTurn: () => boolean
  playMonsterTurn: () => void
  resolveFinalBattleTurn: () => void
  settlePlacement: (cardInstanceId: string) => void
  finishResolution: () => void
}

function applyPlay(
  result: { state: MatchState; resolution?: PlayResolution },
  action: PlayCardAction,
  deck: DeckConfig,
  previous?: MonsterTelegraph,
) {
  const busy = Boolean(result.resolution && (result.resolution.cover || result.resolution.removed.length > 0))
  if (busy) usePresentationStore.getState().setInputLocked(true)
  const kept = action.side === 'player'
    && previous
    && result.state.monster.hand.some((card) => card.instanceId === previous.card.instanceId)
  return {
    match: result.state,
    activePlacement: action,
    resolution: busy ? result.resolution : undefined,
    placementSettled: false,
    telegraph: kept ? previous : commitMonsterIntent(result.state, deck),
  }
}

function releaseBattleView() {
  usePresentationStore.getState().setInputLocked(false)
  useInteractionStore.getState().resetBattleView()
}

export const useGameStore = create<GameStore>((set, get) => ({
  match: null,
  opponentDeck: beginnerPlayerDeck,
  battleKey: 0,
  placementSettled: false,
  initialize: (levelId, monsterId) => {
    const playerDeck = getBattleDeck()
    if (!playerDeck) return
    releaseBattleView()
    const match = createMatch(levelId, monsterId, playerDeck, beginnerMonsterDeck)
    set({
      // All current encounters intentionally share one monster deck and ruleset.
      match,
      opponentDeck: playerDeck,
      battleKey: get().battleKey + 1,
      activePlacement: undefined,
      telegraph: commitMonsterIntent(match, playerDeck),
      resolution: undefined,
      placementSettled: false,
    })
  },
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
    const match = get().match
    if (!match) return 'MATCH_NOT_READY'
    if (usePresentationStore.getState().inputLocked) return 'RESOLVING'
    const result = playCard(match, action)
    if (!result.error && result.resolution) {
      set(applyPlay(result as { state: MatchState; resolution: PlayResolution }, action, get().opponentDeck, get().telegraph))
    }
    return result.error
  },
  prepareMonsterTurn: () => {
    const match = get().match
    if (!match || match.status !== 'playing' || match.turn !== 'monster' || match.openingTurn) return false
    const locked = get().telegraph?.card
    const profile = monsterProfile(get().opponentDeck)
    const lockedPlay = locked ? chooseMonsterAction(match, profile, locked.instanceId) : null
    const action = lockedPlay ?? chooseMonsterAction(match, profile)
    const card = action ? match.monster.hand.find((candidate) => candidate.instanceId === action.cardInstanceId) : undefined
    if (!action || !card) {
      const passed = passTurn(match)
      set({ match: passed, telegraph: commitMonsterIntent(passed, get().opponentDeck) })
      return false
    }
    if (!locked || locked.instanceId !== card.instanceId) set({ telegraph: { card: { ...card } } })
    return true
  },
  playMonsterTurn: () => {
    const match = get().match
    const telegraph = get().telegraph
    if (!match || match.openingTurn || !telegraph) return
    const profile = monsterProfile(get().opponentDeck)
    const action = chooseMonsterAction(match, profile, telegraph.card.instanceId) ?? chooseMonsterAction(match, profile)
    if (!action) {
      const passed = passTurn(match)
      set({ match: passed, telegraph: commitMonsterIntent(passed, get().opponentDeck) })
      return
    }
    const result = playCard(match, action)
    if (result.error || !result.resolution) {
      set({ telegraph: commitMonsterIntent(match, get().opponentDeck) })
      return
    }
    set(applyPlay(result as { state: MatchState; resolution: PlayResolution }, action, get().opponentDeck, telegraph))
  },
  resolveFinalBattleTurn: () => {
    const match = get().match
    if (!match) return
    const next = resolveFinalBattleTurnState(match)
    if (next === match) return
    set({ match: next, telegraph: next.status === 'playing' ? get().telegraph : undefined })
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
