import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'
import { useNavigationStore } from './navigationStore'

describe('navigation', () => {
  beforeEach(() => {
    useGameStore.getState().abandon()
    useNavigationStore.setState({ screen: 'home', deckReturn: 'home' })
  })

  it('opens the map, the deck, and returns to where the deck was opened', () => {
    useNavigationStore.getState().openMap()
    useNavigationStore.getState().openDeck('map')
    expect(useNavigationStore.getState().screen).toBe('deck')
    useNavigationStore.getState().closeDeck()
    expect(useNavigationStore.getState().screen).toBe('map')

    useNavigationStore.getState().openDeck('home')
    useNavigationStore.getState().closeDeck()
    expect(useNavigationStore.getState().screen).toBe('home')
  })

  it('clears the table when leaving for home', () => {
    useGameStore.setState({ battleKey: 2, match: null })
    useNavigationStore.getState().openMap()
    useNavigationStore.getState().exitToHome()
    expect(useNavigationStore.getState().screen).toBe('home')
    expect(useGameStore.getState().match).toBeNull()
  })
})
