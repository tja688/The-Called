import { ArrowLeft } from 'lucide-react'
import { playBrainClick } from '../audio/gameAudio'
import { MapBackdrop } from '../scene/map/MapBackdrop'
import { LevelPath } from '../scene/map/LevelPath'
import { useNavigationStore } from '../stores/navigationStore'

export function MapPage() {
  const startLevel = useNavigationStore((state) => state.startLevel)
  const exitToHome = useNavigationStore((state) => state.exitToHome)

  return (
    <main className="map-page">
      <div className="map-background" aria-hidden="true" />
      <MapBackdrop />

      <button className="map-back" type="button" onClick={exitToHome} aria-label="Back to home">
        <ArrowLeft aria-hidden="true" />
      </button>

      <div className="map-brain-layer">
        <LevelPath onStartLevel={(levelId) => {
          playBrainClick()
          startLevel(levelId)
        }} />
      </div>
    </main>
  )
}
