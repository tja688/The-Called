import { create } from 'zustand'
import { levels } from '../config/gameContent'

type CampaignStore = {
  cleared: number
  complete: (levelId: string) => void
  reset: () => void
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  cleared: 0,
  complete: (levelId) => {
    const current = levels[get().cleared]
    if (!current || current.id !== levelId) return
    set({ cleared: get().cleared + 1 })
  },
  reset: () => set({ cleared: 0 }),
}))

export function currentLevelId() {
  return levels[useCampaignStore.getState().cleared]?.id ?? null
}
