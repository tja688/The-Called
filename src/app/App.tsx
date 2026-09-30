import { useEffect, useState } from 'react'
import { GlobalAudio } from '../audio/GlobalAudio'
import { LoadingScreen } from '../loading/LoadingScreen'
import { preloadGameAssets } from '../loading/preloadAssets'
import { warmKernel } from '../pcd/browserKernel'
import { DeckBuild } from '../pcd/DeckBuild'
import { ForkRun } from '../pcd/ForkRun'
import { HomePage } from '../pages/HomePage'
import { useNavigationStore } from '../stores/navigationStore'
import { SceneTransition } from '../ui/SceneTransition'

export function App() {
  const screen = useNavigationStore((state) => state.screen)
  const exitToHome = useNavigationStore((state) => state.exitToHome)
  const openDeck = useNavigationStore((state) => state.openDeck)
  const closeDeck = useNavigationStore((state) => state.closeDeck)
  const [progress, setProgress] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let active = true
    warmKernel()

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
            {displayedScreen === 'map' && <ForkRun onExit={exitToHome} onDeck={() => openDeck('map')} />}
            {displayedScreen === 'deck' && <DeckBuild onBack={closeDeck} />}
          </>
        )}
      </SceneTransition>
    </>
  )
}
