import { Pause } from 'lucide-react'
import { pauseBgmForPauseScreen, playPauseEnter } from '../audio/gameAudio'
import { useNavigationStore } from '../stores/navigationStore'

export function PlaybackControls() {
  const pauseLevel = useNavigationStore((state) => state.pauseLevel)

  return (
    <div className="playback-controls">
      <button
        className="playback-control"
        type="button"
        aria-label="打开暂停菜单"
        onClick={() => {
          playPauseEnter()
          pauseBgmForPauseScreen()
          pauseLevel()
        }}
      >
        <Pause aria-hidden="true" fill="currentColor" strokeWidth={1.6} />
      </button>
    </div>
  )
}
