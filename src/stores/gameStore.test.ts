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
    expect(useGameStore.getState().telegraph?.action.side).toBe('monster')
    expect(useGameStore.getState().telegraph?.card.instanceId).toBe(useGameStore.getState().telegraph?.action.cardInstanceId)

    const stuck = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    stuck.turn = 'monster'
    stuck.monster.hand = []
    useGameStore.setState({ match: stuck, telegraph: undefined })
    expect(useGameStore.getState().prepareMonsterTurn()).toBe(false)
    expect(useGameStore.getState().match?.turn).toBe('player')
    expect(useGameStore.getState().telegraph).toBeUndefined()
  })

  it('returns the camera to the board when a battle view is reset', () => {
    useInteractionStore.getState().beginCardPlacement('card-1')
    expect(useInteractionStore.getState().cameraMode).toBe('overview')
    useInteractionStore.getState().resetBattleView()
    expect(useInteractionStore.getState().cameraMode).toBe('board')
    expect(useInteractionStore.getState().selectedCardInstanceId).toBeUndefined()
  })
})
