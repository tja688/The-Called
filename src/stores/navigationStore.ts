import { create } from 'zustand'
import { currentLevelId } from './campaignStore'
import { canEnterBattle } from './deckStore'
import { useGameStore } from './gameStore'

export type AppScreen = 'home' | 'map' | 'level' | 'pause'
export type SessionStatus = 'idle' | 'playing' | 'suspended'

type NavigationStore = {
  screen: AppScreen
  levelId: string | null
  sessionStatus: SessionStatus
  openMap: () => void
  startLevel: (levelId: string) => void
  pauseLevel: () => void
  resumeLevel: () => void
  exitToMap: () => void
  exitToHome: () => void
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  screen: 'home',
  levelId: null,
  sessionStatus: 'idle',

  openMap: () => set({ screen: 'map' }),

  startLevel: (levelId) => {
    if (currentLevelId() !== levelId || !canEnterBattle()) return
    set({
      screen: 'level',
      levelId,
      sessionStatus: 'playing',
    })
  },

  pauseLevel: () => {
    if (get().screen !== 'level') return
    set({ screen: 'pause', sessionStatus: 'suspended' })
  },

  resumeLevel: () => {
    if (get().screen !== 'pause' || get().levelId === null) return
    set({ screen: 'level', sessionStatus: 'playing' })
  },

  exitToMap: () => {
    useGameStore.getState().abandon()
    set({
      screen: 'map',
      levelId: null,
      sessionStatus: 'idle',
    })
  },

  exitToHome: () => {
    useGameStore.getState().abandon()
    set({
      screen: 'home',
      levelId: null,
      sessionStatus: 'idle',
    })
  },
}))
