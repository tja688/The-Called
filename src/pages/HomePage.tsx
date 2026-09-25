import { useEffect, useId, useState, type ReactNode } from 'react'
import { getAudioLevels, playGameStart, setEffectsLevel, setMusicLevel } from '../audio/gameAudio'
import { FallingCards } from '../scene/home/FallingCards'
import { HomeGlyph } from '../scene/home/HomeGlyph.tsx'
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
    body: '棋盘是 3×3 的九宫格。你和怪物轮流放牌，你先手。开局各拿 5 张手牌，手牌最多也是 5 张。轮到一方时，如果手牌没满且牌库还有牌，就抽 1 张；手牌已经满了，这一抽就跳过。',
  },
  {
    title: '放置与覆盖',
    body: '空格可以直接放入。不能盖住自己的牌。只有 Power 严格高于格子上的对手牌时才能覆盖，点数相同不行。被盖住的牌留在原格，不占分、也不再触发效果，只有最上面那张算数。',
  },
  {
    title: '结算顺序',
    body: '牌放下时先结算入场效果，再减去被盖住那张牌的 Power。没有另作说明的效果都在这一刻生效。Power 降到 0 的牌会离开场地，压在下面的牌不会因此翻出来。',
  },
  {
    title: '牌面效果',
    body: '有的牌没有额外效果，只提供点数。其余效果包括：让相邻的己方或对方改变 Power；放在棋盘边缘时自己 +1；旁边有指定阵营时自己 +1；盖住对方的牌时自己 +1。',
  },
  {
    title: '怪物',
    body: '怪物也从自己的牌组抽牌。它出牌之前，下一张牌会先亮出来。你知道它要出什么，但不知道落在哪一格。',
  },
  {
    title: '终局之战',
    body: '九格都被占满后进入终局，不会立刻分胜负。之后每个回合开始时，如果自己场上的 Power 高于对方，这一方获胜。若双方都没有能盖过对方的牌，则比较场上总点数；点数相同，占格更多的一方获胜；格数也相同，怪物获胜。',
  },
  {
    title: '操作',
    body: '对局中滚轮向前进入俯视，滚轮向后回到手牌。也可以用 Tab 在两种视角之间切换。',
  },
]

function percent(level: number) {
  return Math.round(level * 100)
}

export function HomePage() {
  const openMap = useNavigationStore((state) => state.openMap)
  const [hovered, setHovered] = useState<GlyphId | null>(null)
  const [panel, setPanel] = useState<'settings' | 'rules' | null>(null)
  const titleId = useId()
  const motif: GlyphId = panel === 'settings' ? 'settings' : panel === 'rules' ? 'rules' : hovered ?? 'play'

  const choose = (action: 'start' | 'settings' | 'rules') => {
    if (action === 'start') {
      playGameStart()
      openMap()
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
