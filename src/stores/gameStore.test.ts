import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck, svarbhanuBeginnerDeck } from '../config/decks'
import { createMatch } from '../game/core/matchEngine'
import { useGameStore } from './gameStore'
import { useInteractionStore } from './interactionStore'

describe('monster telegraph and battle restart', () => {
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

  it('returns the camera to the board when a battle view is reset', () => {
    useInteractionStore.getState().beginCardPlacement('card-1')
    expect(useInteractionStore.getState().cameraMode).toBe('overview')
    useInteractionStore.getState().resetBattleView()
    expect(useInteractionStore.getState().cameraMode).toBe('board')
    expect(useInteractionStore.getState().selectedCardInstanceId).toBeUndefined()
  })
})
