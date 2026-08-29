import { useEffect } from 'react'
import { preloadGameAudio, startGlobalAudio, stopGlobalAudio } from './gameAudio'

export function GlobalAudio() {
  useEffect(() => {
    preloadGameAudio()
    startGlobalAudio()

    const unlockGlobalAudio = () => {
      startGlobalAudio()
      window.removeEventListener('pointerdown', unlockGlobalAudio)
      window.removeEventListener('keydown', unlockGlobalAudio)
      window.removeEventListener('touchstart', unlockGlobalAudio)
    }
    window.addEventListener('pointerdown', unlockGlobalAudio)
    window.addEventListener('keydown', unlockGlobalAudio)
    window.addEventListener('touchstart', unlockGlobalAudio)

    return () => {
      window.removeEventListener('pointerdown', unlockGlobalAudio)
      window.removeEventListener('keydown', unlockGlobalAudio)
      window.removeEventListener('touchstart', unlockGlobalAudio)
      stopGlobalAudio()
    }
  }, [])

  return null
}
