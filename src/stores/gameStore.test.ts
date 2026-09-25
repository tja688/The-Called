import { beforeEach, describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../config/decks'
import { createMatch } from '../game/core/matchEngine'
import { useDeckStore } from './deckStore'
import { useGameStore } from './gameStore'
import { useInteractionStore } from './interactionStore'
import { usePresentationStore } from './presentationStore'

describe('monster telegraph and battle restart', () => {
  beforeEach(() => {
    useDeckStore.getState().reset()
  })

  it('deals the constructed battle deck', () => {
    useDeckStore.getState().removeSlot(0)
    useDeckStore.getState().placeCard('player_falsification', 0)
    useGameStore.getState().initialize('level-01', 'svarbhanu')
    const match = useGameStore.getState().match
    const dealt = [...(match?.player.hand ?? []), ...(match?.player.deck ?? [])]
    expect(dealt.filter((card) => card.cardId === 'player_falsification')).toHaveLength(2)
    expect(dealt.filter((card) => card.cardId === 'player_reference_point')).toHaveLength(2)
    expect(useGameStore.getState().opponentDeck.cards).toEqual(
      expect.arrayContaining([{ cardId: 'player_falsification', count: 2 }]),
    )
  })
  it('locks the card the monster will play, and passes when none can be played', () => {
    const ready = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    ready.turn = 'monster'
    useGameStore.setState({ match: ready, telegraph: undefined, resolution: undefined, placementSettled: false })
    expect(useGameStore.getState().prepareMonsterTurn()).toBe(true)
    const shown = useGameStore.getState().telegraph?.card.instanceId
    expect(ready.monster.hand.some((card) => card.instanceId === shown)).toBe(true)

    const stuck = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    stuck.turn = 'monster'
    stuck.monster.hand = []
    useGameStore.setState({ match: stuck, telegraph: undefined })
    expect(useGameStore.getState().prepareMonsterTurn()).toBe(false)
    expect(useGameStore.getState().match?.turn).toBe('player')
    expect(useGameStore.getState().telegraph).toBeUndefined()
  })

  it('shows the monster’s next card through the player turn, then replaces it after that card is played', () => {
    useGameStore.getState().initialize('level-01', 'svarbhanu')
    const shown = useGameStore.getState().telegraph?.card.instanceId
    const match = useGameStore.getState().match
    expect(shown).toBeTruthy()
    expect(match?.monster.hand.some((card) => card.instanceId === shown)).toBe(true)

    const playerCard = match!.player.hand[0]
    expect(useGameStore.getState().play({ side: 'player', cardInstanceId: playerCard.instanceId, cellId: 'cell-1-1' })).toBeUndefined()
    expect(useGameStore.getState().telegraph?.card.instanceId).toBe(shown)

    useGameStore.getState().playMonsterTurn()
    const after = useGameStore.getState()
    expect(after.match?.board.some((cell) => cell.card?.instanceId === shown)).toBe(true)
    expect(after.telegraph?.card.instanceId).not.toBe(shown)
    expect(after.match?.monster.hand.some((card) => card.instanceId === after.telegraph?.card.instanceId)).toBe(true)
  })

  it('clears a stuck tactical view when another match starts', () => {
    useInteractionStore.getState().beginCardPlacement('card-1')
    usePresentationStore.getState().setInputLocked(true)
    useGameStore.getState().initialize('level-01', 'svarbhanu')
    expect(useInteractionStore.getState().cameraMode).toBe('board')
    expect(useInteractionStore.getState().selectedCardInstanceId).toBeUndefined()
    expect(usePresentationStore.getState().inputLocked).toBe(false)
    expect(useGameStore.getState().battleKey).toBeGreaterThan(0)
  })

  it('returns the camera to the board when a battle view is reset', () => {
    useInteractionStore.getState().beginCardPlacement('card-1')
    expect(useInteractionStore.getState().cameraMode).toBe('overview')
    useInteractionStore.getState().resetBattleView()
    expect(useInteractionStore.getState().cameraMode).toBe('board')
    expect(useInteractionStore.getState().selectedCardInstanceId).toBeUndefined()
  })
})
