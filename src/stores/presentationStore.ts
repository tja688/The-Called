import { create } from 'zustand'

export type AnimationSpeed = 'normal' | 'fast' | 'instant'
type PresentationStore = {
  speed: AnimationSpeed
  inputLocked: boolean
  setSpeed: (speed: AnimationSpeed) => void
  setInputLocked: (inputLocked: boolean) => void
}

export const usePresentationStore = create<PresentationStore>((set) => ({
  speed: 'normal',
  inputLocked: false,
  setSpeed: (speed) => set({ speed }),
  setInputLocked: (inputLocked) => set({ inputLocked }),
}))
