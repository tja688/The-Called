import { create } from 'zustand'
import { beginnerPlayerDeck, monsterDeckForLevel, type DeckConfig } from '../config/decks'
import { chooseMonsterAction, chooseShownCard } from '../game/ai/monsterAI'
import { THINK_SLICE_MS, searchMonsterAction, searchMonsterIntent } from '../game/ai/search'
import { driveThink, thinkCanYield } from '../game/ai/thinkLane'
import { createMatch, passTurn, playCard, resolveFinalBattleTurn as resolveFinalBattleTurnState, resolveIdleTurn } from '../game/core/matchEngine'
import type { CardInstance, CellId, MatchState, PlayCardAction, PlayResolution } from '../game/types'
import { getBattleDeck } from './deckStore'
import { useInteractionStore } from './interactionStore'
import { usePresentationStore } from './presentationStore'

export type MonsterTelegraph = {
  card: CardInstance
  /** Cell chosen before the card flies. The render loop only animates this. */
  cellId?: CellId
}

function monsterProfile(deck: DeckConfig) {
  return { opponentDeck: deck }
}

function matchStamp(state: MatchState) {
  const board = state.board.map((cell) => cell.card?.instanceId ?? '.').join(',')
  const monster = state.monster.hand.map((card) => card.instanceId).join(',')
  const player = state.player.hand.map((card) => card.instanceId).join(',')
  return `${state.round}|${state.turn}|${state.status}|${state.openingTurn ? 1 : 0}|${board}|${monster}|${player}`
}

let cancelThink = () => {}
let thinkToken = 0

function beginThink() {
  cancelThink()
  thinkToken += 1
  return thinkToken
}

function stopThink() {
  beginThink()
}

function liveMatches(token: number, stamp: string) {
  if (token !== thinkToken) return false
  const live = useGameStore.getState().match
  return Boolean(live && matchStamp(live) === stamp)
}

function queueShownCard(state: MatchState, deck: DeckConfig) {
  const token = beginThink()
  const stamp = matchStamp(state)
  cancelThink = driveThink(searchMonsterIntent(state, monsterProfile(deck), THINK_SLICE_MS), (card) => {
    if (!liveMatches(token, stamp)) return
    useGameStore.setState({ telegraph: card ? { card: { ...card } } : undefined })
  })
}

function queueMonsterAction(
  state: MatchState,
  deck: DeckConfig,
  lockedInstanceId: string | undefined,
  after: (action: PlayCardAction | null) => void,
) {
  const token = beginThink()
  const stamp = matchStamp(state)
  cancelThink = driveThink(
    searchMonsterAction(state, monsterProfile(deck), lockedInstanceId, THINK_SLICE_MS),
    (action) => {
      if (!liveMatches(token, stamp)) return
      after(action)
    },
  )
}

function commitMonsterIntent(state: MatchState, deck: DeckConfig): MonsterTelegraph | undefined {
  if (state.status !== 'playing' || state.openingTurn) return undefined
  const profile = monsterProfile(deck)
  if (state.turn === 'player') {
    if (thinkCanYield()) {
      queueShownCard(state, deck)
      return undefined
    }
    const card = chooseShownCard(state, profile)
    return card ? { card: { ...card } } : undefined
  }
  if (thinkCanYield()) {
    queueMonsterAction(state, deck, undefined, (action) => {
      const live = useGameStore.getState().match
      const card = action && live ? live.monster.hand.find((candidate) => candidate.instanceId === action.cardInstanceId) : undefined
      useGameStore.setState({
        telegraph: card && action ? { card: { ...card }, cellId: action.cellId } : undefined,
      })
    })
    return undefined
  }
  const action = chooseMonsterAction(state, profile)
  const card = action ? state.monster.hand.find((candidate) => candidate.instanceId === action.cardInstanceId) : undefined
  return card && action ? { card: { ...card }, cellId: action.cellId } : undefined
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
  passIfNoMove: () => void
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
  else usePresentationStore.getState().setInputLocked(false)
  const kept = action.side === 'player'
    && previous
    && result.state.monster.hand.some((card) => card.instanceId === previous.card.instanceId)
    && !result.state.openingTurn
  return {
    match: result.state,
    activePlacement: action,
    resolution: busy ? result.resolution : undefined,
    // Monster cards are already on the cell when the play commits. Waiting on
    // the mesh to report that left the input lock up for the rest of the match.
    placementSettled: !busy || action.side === 'monster',
    telegraph: kept ? { card: previous.card } : commitMonsterIntent(result.state, deck),
  }
}

function concedeTurn(match: MatchState) {
  const passed = passTurn(match)
  if (passed.status !== 'playing' || passed.openingTurn) return passed
  return resolveIdleTurn(passed)
}

let openingTimer = 0

function scheduleOpening(match: MatchState | null) {
  const clear = globalThis.clearTimeout
  const later = globalThis.setTimeout
  if (typeof clear !== 'function' || typeof later !== 'function') return
  clear(openingTimer)
  if (!match || match.status !== 'playing' || !match.finalBattle || !match.openingTurn) return
  const round = match.round
  const turn = match.turn
  openingTimer = later(() => {
    const live = useGameStore.getState().match
    if (!live || !live.openingTurn || live.round !== round || live.turn !== turn || !live.finalBattle) return
    useGameStore.getState().resolveFinalBattleTurn()
  }, 1000)
}

function publishPlay(
  result: { state: MatchState; resolution?: PlayResolution },
  action: PlayCardAction,
  deck: DeckConfig,
  previous: MonsterTelegraph | undefined,
  set: (partial: Partial<GameStore>) => void,
) {
  const patch = applyPlay(result, action, deck, previous)
  set(patch)
  scheduleOpening(patch.match)
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
    stopThink()
    releaseBattleView()
    const match = createMatch(levelId, monsterId, playerDeck, monsterDeckForLevel(levelId))
    set({
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
    stopThink()
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
    if (usePresentationStore.getState().inputLocked) {
      if (get().resolution) return 'RESOLVING'
      usePresentationStore.getState().setInputLocked(false)
    }
    const result = playCard(match, action)
    if (!result.error && result.resolution) {
      publishPlay(result as { state: MatchState; resolution: PlayResolution }, action, get().opponentDeck, get().telegraph, set)
    }
    return result.error
  },
  prepareMonsterTurn: () => {
    const match = get().match
    if (!match || match.status !== 'playing' || match.turn !== 'monster' || match.openingTurn) return false
    if (get().resolution) return false
    const locked = get().telegraph?.card
    if (locked && get().telegraph?.cellId && match.monster.hand.some((card) => card.instanceId === locked.instanceId)) return true
    const profile = monsterProfile(get().opponentDeck)
    if (thinkCanYield()) {
      const deck = get().opponentDeck
      queueMonsterAction(match, deck, locked?.instanceId, (action) => {
        const live = useGameStore.getState().match
        const card = action && live ? live.monster.hand.find((candidate) => candidate.instanceId === action.cardInstanceId) : undefined
        if (!live || !action || !card) {
          if (!live) return
          const passed = concedeTurn(live)
          set({
            match: passed,
            telegraph: passed.status === 'playing' ? commitMonsterIntent(passed, deck) : undefined,
          })
          scheduleOpening(passed)
          return
        }
        set({ telegraph: { card: { ...card }, cellId: action.cellId } })
      })
      return true
    }
    const action = locked
      ? chooseMonsterAction(match, profile, locked.instanceId)
      : chooseMonsterAction(match, profile)
    const card = action ? match.monster.hand.find((candidate) => candidate.instanceId === action.cardInstanceId) : undefined
    if (!action || !card) {
      const passed = concedeTurn(match)
      set({
        match: passed,
        telegraph: passed.status === 'playing' ? commitMonsterIntent(passed, get().opponentDeck) : undefined,
      })
      scheduleOpening(passed)
      return false
    }
    set({ telegraph: { card: { ...card }, cellId: action.cellId } })
    return true
  },
  passIfNoMove: () => {
    const match = get().match
    const telegraph = get().telegraph
    if (!match || match.status !== 'playing' || match.turn !== 'player' || match.openingTurn) return
    if (get().resolution) return
    const passed = resolveIdleTurn(match)
    if (passed === match) return
    const kept = telegraph && passed.monster.hand.some((card) => card.instanceId === telegraph.card.instanceId)
    set({
      match: passed,
      telegraph: passed.status !== 'playing' ? undefined : kept ? telegraph : commitMonsterIntent(passed, get().opponentDeck),
    })
  },
  playMonsterTurn: () => {
    const match = get().match
    const telegraph = get().telegraph
    if (!match || match.openingTurn || !telegraph) return
    const profile = monsterProfile(get().opponentDeck)
    if (!telegraph.cellId && thinkCanYield()) {
      const deck = get().opponentDeck
      const shown = telegraph.card.instanceId
      queueMonsterAction(match, deck, shown, (action) => {
        const live = useGameStore.getState()
        if (!live.match || live.telegraph?.card.instanceId !== shown) return
        if (!action) {
          const passed = concedeTurn(live.match)
          set({
            match: passed,
            telegraph: passed.status === 'playing' ? commitMonsterIntent(passed, deck) : undefined,
          })
          scheduleOpening(passed)
          return
        }
        useGameStore.setState({ telegraph: { card: live.telegraph.card, cellId: action.cellId } })
        useGameStore.getState().playMonsterTurn()
      })
      return
    }
    const action = telegraph.cellId
      ? { side: 'monster' as const, cardInstanceId: telegraph.card.instanceId, cellId: telegraph.cellId }
      : chooseMonsterAction(match, profile, telegraph.card.instanceId)
    if (!action) {
      const passed = concedeTurn(match)
      set({
        match: passed,
        telegraph: passed.status === 'playing' ? commitMonsterIntent(passed, get().opponentDeck) : undefined,
      })
      scheduleOpening(passed)
      return
    }
    const result = playCard(match, action)
    if (result.error || !result.resolution) {
      const passed = concedeTurn(match)
      set({
        match: passed,
        telegraph: passed.status === 'playing' ? commitMonsterIntent(passed, get().opponentDeck) : undefined,
      })
      scheduleOpening(passed)
      return
    }
    publishPlay(result as { state: MatchState; resolution: PlayResolution }, action, get().opponentDeck, telegraph, set)
  },
  resolveFinalBattleTurn: () => {
    const match = get().match
    if (!match) return
    const next = resolveFinalBattleTurnState(match)
    if (next === match) return
    const previous = get().telegraph
    const stillHeld = Boolean(
      previous
      && next.status === 'playing'
      && next.monster.hand.some((card) => card.instanceId === previous.card.instanceId),
    )
    const telegraph = stillHeld ? (next.openingTurn ? { card: previous!.card } : previous) : undefined
    set({ match: next, telegraph })
    scheduleOpening(next)
    if (next.status === 'playing' && next.turn === 'monster' && !next.openingTurn && !get().resolution) {
      get().prepareMonsterTurn()
    }
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
