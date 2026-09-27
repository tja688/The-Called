import { create } from 'zustand'
import type { EffectCue } from '../../game/v6/rules'
import type { LiveBadge, Suppress } from '../../game/v6/view/battle/reel'

type Picture = {
  fx: EffectCue | null
  spawn: EffectCue | null
  badges: LiveBadge[]
  suppress: Suppress[]
  hidden: string[]
  publish: (picture: Omit<Picture, 'publish'>) => void
}

export const useEffectReel = create<Picture>((set) => ({
  fx: null,
  spawn: null,
  badges: [],
  suppress: [],
  hidden: [],
  publish: (picture) => set(picture),
}))
