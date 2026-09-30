import { create } from 'zustand'
import { useGameStore } from './gameStore'

export type AppScreen = 'home' | 'map' | 'deck'

type NavigationStore = {
  screen: AppScreen
  deckReturn: 'home' | 'map'
  openMap: () => void
  openDeck: (from: 'home' | 'map') => void
  closeDeck: () => void
  exitToHome: () => void
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  screen: 'home',
  deckReturn: 'home',

  openMap: () => set({ screen: 'map' }),

  openDeck: (from) => set({ screen: 'deck', deckReturn: from }),

  closeDeck: () => set({ screen: get().deckReturn }),

  exitToHome: () => {
    useGameStore.getState().abandon()
    set({ screen: 'home', deckReturn: 'home' })
  },
}))
