import { useEffect, useState } from 'react'
import { GlobalAudio } from '../audio/GlobalAudio'
import { LoadingScreen } from '../loading/LoadingScreen'
import { preloadGameAssets } from '../loading/preloadAssets'
import { HomePage } from '../pages/HomePage'
import { LevelPage } from '../pages/LevelPage'
import { MapPage } from '../pages/MapPage'
import { PausePage } from '../pages/PausePage'
import { useNavigationStore } from '../stores/navigationStore'
import { SceneTransition } from '../ui/SceneTransition'

export function App() {
  const screen = useNavigationStore((state) => state.screen)
  const [progress, setProgress] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true

    void preloadGameAssets((nextProgress) => {
      if (active) setProgress(nextProgress)
    }).then(() => {
      if (active) setIsReady(true)
    })

    return () => {
      active = false
    }
  }, [])

  if (!isReady) return <LoadingScreen progress={progress} />

  return (
    <>
      <GlobalAudio />
      <SceneTransition scene={screen}>
        {(displayedScreen) => (
          <>
            {displayedScreen === 'home' && <HomePage />}
            {displayedScreen === 'map' && <MapPage />}
            {(displayedScreen === 'level' || displayedScreen === 'pause') && <LevelPage />}
            {displayedScreen === 'pause' && <PausePage />}
          </>
        )}
      </SceneTransition>
    </>
  )
}
