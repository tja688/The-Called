import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { playBrainClick, playCardSelect } from '../audio/gameAudio'
import { BATTLE_DECK_LIMIT } from '../config/deckLoadout'
import { MapBackdrop } from '../scene/map/MapBackdrop'
import { LevelPath } from '../scene/map/LevelPath'
import { levels } from '../config/gameContent'
import { useCampaignStore } from '../stores/campaignStore'
import { canEnterBattle, useDeckStore } from '../stores/deckStore'
import { useNavigationStore } from '../stores/navigationStore'
import { DeckBuilder } from '../ui/DeckBuilder'

export function MapPage() {
  const startLevel = useNavigationStore((state) => state.startLevel)
  const exitToHome = useNavigationStore((state) => state.exitToHome)
  const filled = useDeckStore((state) => state.slots.filter((cardId) => cardId !== null).length)
  const finished = useCampaignStore((state) => state.cleared >= levels.length)
  const [deckOpen, setDeckOpen] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const ready = filled === BATTLE_DECK_LIMIT

  return (
    <main className="map-page">
      <div className="map-background" aria-hidden="true" />
      <MapBackdrop />

      <button className="map-back" type="button" onClick={() => {
        if (finished) useCampaignStore.getState().reset()
        exitToHome()
      }} aria-label="Back to home">
        <ArrowLeft aria-hidden="true" />
      </button>

      <button
        className={ready ? 'map-deck is-ready' : 'map-deck'}
        type="button"
        onClick={() => {
          playCardSelect()
          setBlocked(false)
          setDeckOpen(true)
        }}
      >
        <span>牌组</span>
        <b>{filled}/{BATTLE_DECK_LIMIT}</b>
      </button>

      {finished && <p className="map-complete">通路已尽。回到主菜单后可以重新开始。</p>}
      {blocked && !deckOpen && (
        <p className="map-deck-block" role="status">出战牌组未满 {BATTLE_DECK_LIMIT} 张，无法进入战斗。</p>
      )}

      <div className="map-brain-layer">
        <LevelPath onStartLevel={(levelId) => {
          if (!canEnterBattle()) {
            setBlocked(true)
            return
          }
          playBrainClick()
          startLevel(levelId)
        }} />
      </div>

      {deckOpen && <DeckBuilder onClose={() => setDeckOpen(false)} />}
    </main>
  )
}
