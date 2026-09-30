import { useEffect, useId, useState, type ReactNode } from 'react'
import { getAudioLevels, playGameStart, setEffectsLevel, setMusicLevel } from '../audio/gameAudio'
import { FallingCards } from '../scene/home/FallingCards'
import { HomeGlyph } from '../scene/home/HomeGlyph'
import type { GlyphId } from '../scene/home/glyphPose'
import { useNavigationStore } from '../stores/navigationStore'
import '../styles/home.css'

const MENU: Array<{ id: GlyphId; index: string; label: string; action: 'start' | 'settings' | 'rules' }> = [
  { id: 'play', index: '01', label: '开始游戏', action: 'start' },
  { id: 'settings', index: '02', label: '设置', action: 'settings' },
  { id: 'rules', index: '03', label: '规则', action: 'rules' },
]

const RULES = [
  {
    title: '场地',
    body: '棋盘是 3×3 的九宫格。你先手。空格可以直接放牌，不能盖住自己的牌。点数高于格上的对手牌时可以覆盖，盖住的那张离开格子。点数相同，则两张一起离开。',
  },
  {
    title: '意图',
    body: '怪物靠意图出牌。它行动前会先亮出下一张牌的名字。你知道是哪一张，不知道落在哪一格。轮到它时，打出的就是这张已经亮出的牌。',
  },
  {
    title: '满格',
    body: '九格都占满以后对局继续。此后每一方在自己的回合开始、回合开始的效果结算完时，只有自己的总点数严格大于对方才获胜。不大于，包括点数相同，就照常出牌。满格时不比占格。',
  },
  {
    title: '没有牌可出',
    body: '只在你的回合开始、并且牌库和手牌都空了的时候结算。对方总点数更高，你输；你更高，你赢。点数相同且对方也无牌可出，占格多的一方赢。点数相同但对方还能出牌，对局继续。满格和没牌同时成立时，按没牌这一条判定。',
  },
  {
    title: '信仰',
    body: '有的牌会积起信仰之类的资源。战斗里只显示当前读数，增减以这一步内核给出的结果为准。',
  },
  {
    title: '操作',
    body: '只有内核给出的操作可以点。点手牌再点格子放入；法术点一下就会打出；要选目标时，点棋盘上那一格。结束回合也只有在可选时才能按。滚轮向前进入俯视，向后回到手牌，Tab 可以切换。',
  },
]

function percent(level: number) {
  return Math.round(level * 100)
}

export function HomePage() {
  const openKernel = useNavigationStore((state) => state.openKernel)
  const [hovered, setHovered] = useState<GlyphId | null>(null)
  const [panel, setPanel] = useState<'settings' | 'rules' | null>(null)
  const titleId = useId()
  const motif: GlyphId = panel === 'settings' ? 'settings' : panel === 'rules' ? 'rules' : hovered ?? 'play'

  const choose = (action: 'start' | 'settings' | 'rules') => {
    if (action === 'start') {
      playGameStart()
      openKernel()
      return
    }
    setPanel(action)
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

      {panel && (
        <HomePanel title={panel === 'settings' ? '设置' : '规则'} labelledBy={titleId} onClose={() => setPanel(null)}>
          {panel === 'settings' ? <SettingsPanel /> : <RulesPanel />}
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

function RulesPanel() {
  return (
    <div className="home-rules">
      {RULES.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <p>{section.body}</p>
        </section>
      ))}
    </div>
  )
}
