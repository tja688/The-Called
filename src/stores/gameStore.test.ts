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

  it('ends the match when the player also has nothing left to play or draw', () => {
    const stuck = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.42)
    stuck.turn = 'player'
    stuck.player.hand = []
    stuck.player.deck = []
    stuck.monster.hand = []
    stuck.monster.deck = []
    stuck.player.turnsTaken = 2
    stuck.monster.turnsTaken = 2
    useGameStore.setState({ match: stuck, telegraph: undefined, resolution: undefined })
    useGameStore.getState().passIfNoMove()
    expect(useGameStore.getState().match?.status).toBe('finished')
    expect(useGameStore.getState().match?.result?.winner).toBe('draw')
  })

  it('passes a shown card that no longer has a cell, instead of playing a different one', () => {
    const trapped = createMatch('level-01', 'svarbhanu', beginnerPlayerDeck, svarbhanuBeginnerDeck, () => 0.2)
    trapped.turn = 'monster'
    trapped.finalBattle = true
    trapped.openingTurn = false
    trapped.board.forEach((cell, index) => {
      cell.card = {
        instanceId: `filled-${index}`,
        cardId: 'player_observation_record',
        owner: 'player',
        currentPower: 3,
      }
      cell.coveredCards = []
    })
    const shown = trapped.monster.hand.find((card) => card.cardId === 'sva_afterimage')
      ?? trapped.monster.deck.find((card) => card.cardId === 'sva_afterimage')
    const five = trapped.monster.hand.find((card) => card.cardId === 'sva_black_box_model')
      ?? trapped.monster.deck.find((card) => card.cardId === 'sva_black_box_model')
    if (!shown || !five) throw new Error('missing cards')
    trapped.monster.hand = [shown, five]
    trapped.monster.deck = trapped.monster.deck.filter((card) => card.instanceId !== shown.instanceId && card.instanceId !== five.instanceId)
    useGameStore.setState({ match: trapped, telegraph: { card: { ...shown } }, resolution: undefined, placementSettled: false })
    expect(useGameStore.getState().prepareMonsterTurn()).toBe(false)
    expect(useGameStore.getState().match?.turn).toBe('player')
    expect(useGameStore.getState().match?.board.every((cell) => cell.card?.owner === 'player')).toBe(true)
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

  it('deals the monster deck that belongs to the level', () => {
    useGameStore.getState().initialize('level-01', 'svarbhanu')
    const first = [...(useGameStore.getState().match?.monster.hand ?? []), ...(useGameStore.getState().match?.monster.deck ?? [])]
    expect(first.every((card) => card.cardId.startsWith('sva_'))).toBe(true)

    useGameStore.getState().initialize('level-02', 'rahu-ketu')
    const second = [...(useGameStore.getState().match?.monster.hand ?? []), ...(useGameStore.getState().match?.monster.deck ?? [])]
    expect(second.some((card) => card.cardId.startsWith('rk_'))).toBe(true)
    expect(second.every((card) => card.cardId.startsWith('rk_'))).toBe(true)

    useGameStore.getState().initialize('level-03', 'moon')
    const third = [...(useGameStore.getState().match?.monster.hand ?? []), ...(useGameStore.getState().match?.monster.deck ?? [])]
    expect(third.every((card) => card.cardId.startsWith('moon_'))).toBe(true)
    expect(useGameStore.getState().opponentDeck.id).toBe('player-loadout')
  })

  it('returns the camera to the board when a battle view is reset', () => {
    useInteractionStore.getState().beginCardPlacement('card-1')
    expect(useInteractionStore.getState().cameraMode).toBe('overview')
    useInteractionStore.getState().resetBattleView()
    expect(useInteractionStore.getState().cameraMode).toBe('board')
    expect(useInteractionStore.getState().selectedCardInstanceId).toBeUndefined()
  })
})
