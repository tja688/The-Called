import { useEffect, useId, useState, type ReactNode } from 'react'
import { getAudioLevels, playGameStart, setEffectsLevel, setMusicLevel } from '../audio/gameAudio'
import { FallingCards } from '../scene/home/FallingCards'
import { HomeGlyph } from '../scene/home/HomeGlyph'
import type { GlyphId } from '../scene/home/glyphPose'
import { useNavigationStore } from '../stores/navigationStore'
import '../styles/home.css'

const MENU: Array<{ id: GlyphId; index: string; label: string; action: 'map' | 'deck' | 'settings' }> = [
  { id: 'play', index: '01', label: '地图', action: 'map' },
  { id: 'rules', index: '02', label: '构筑', action: 'deck' },
  { id: 'settings', index: '03', label: '设置', action: 'settings' },
]

function percent(level: number) {
  return Math.round(level * 100)
}

export function HomePage() {
  const openMap = useNavigationStore((state) => state.openMap)
  const openDeck = useNavigationStore((state) => state.openDeck)
  const [hovered, setHovered] = useState<GlyphId | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const titleId = useId()
  const motif: GlyphId = settingsOpen ? 'settings' : hovered ?? 'play'

  const choose = (action: 'map' | 'deck' | 'settings') => {
    if (action === 'map') {
      playGameStart()
      openMap()
      return
    }
    if (action === 'deck') {
      openDeck('home')
      return
    }
    setSettingsOpen(true)
  }

  return (
    <main className="home-page">
      <FallingCards />
      <div className="home-page__shade" />
      <HomeGlyph motif={motif} />

      <header className="home-page__brand">
        <h1 id="home-title">THE CALLED</h1>
      </header>

      <nav className="home-menu" aria-labelledby="home-title">
        {MENU.map((item) => (
          <button
            key={item.id}
            type="button"
            className={motif === item.id ? 'is-current' : undefined}
            onMouseEnter={() => setHovered(item.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(item.id)}
            onBlur={() => setHovered(null)}
            onClick={() => choose(item.action)}
          >
            <span>{item.index}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {settingsOpen && (
        <HomePanel title="设置" labelledBy={titleId} onClose={() => setSettingsOpen(false)}>
          <SettingsPanel />
        </HomePanel>
      )}
    </main>
  )
}

function HomePanel({
  title,
  labelledBy,
  onClose,
  children,
}: {
  title: string
  labelledBy: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="home-panel" role="presentation" onClick={onClose}>
      <div
        className="home-panel__frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id={labelledBy}>{title}</h2>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        {children}
      </div>
    </div>
  )
}

function SettingsPanel() {
  const initial = getAudioLevels()
  const [music, setMusic] = useState(percent(initial.music))
  const [effects, setEffects] = useState(percent(initial.effects))

  return (
    <div className="home-settings">
      <label>
        <span>音乐</span>
        <input
          type="range"
          min={0}
          max={100}
          value={music}
          aria-valuetext={`${music}%`}
          onChange={(event) => {
            const next = Number(event.target.value)
            setMusic(next)
            setMusicLevel(next / 100)
          }}
        />
        <b>{music}</b>
      </label>
      <label>
        <span>音效</span>
        <input
          type="range"
          min={0}
          max={100}
          value={effects}
          aria-valuetext={`${effects}%`}
          onChange={(event) => {
            const next = Number(event.target.value)
            setEffects(next)
            setEffectsLevel(next / 100)
          }}
        />
        <b>{effects}</b>
      </label>
    </div>
  )
}

