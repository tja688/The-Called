import { playPauseConfirm, resumeBgmAfterPause } from '../audio/gameAudio'
import { useNavigationStore } from '../stores/navigationStore'

export function PausePage() {
  const resumeLevel = useNavigationStore((state) => state.resumeLevel)
  const exitToMap = useNavigationStore((state) => state.exitToMap)
  const exitToHome = useNavigationStore((state) => state.exitToHome)

  const confirm = (action: () => void) => () => {
    playPauseConfirm()
    resumeBgmAfterPause()
    action()
  }

  return (
    <main className="pause-page pause-page--quiet" aria-label="Game paused">
      <nav className="pause-quiet" aria-label="Pause menu">
        <button type="button" onClick={confirm(resumeLevel)}>继续</button>
        <button type="button" onClick={confirm(exitToMap)}>地图</button>
        <button type="button" onClick={confirm(exitToHome)}>离开</button>
      </nav>
    </main>
  )
}
