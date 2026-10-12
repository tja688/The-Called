import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
    getAudioLevels,
    playGameStart,
    setEffectsLevel,
    setMusicLevel,
} from '../audio/gameAudio'
import { useNavigationStore } from '../stores/navigationStore'
import { Atmosphere } from '../visual/Atmosphere'
import { PixelTitle } from '../visual/PixelTitle'
import { Sigil } from '../visual/Sigil'
import '../styles/home.css'

const MENU = [
    {
        label: '开始冒险',
        detail: '踏入九格之间',
        action: 'map',
        color: '#ff3d5a',
    },
    {
        label: '牌组构筑',
        detail: '整理你的卡盒',
        action: 'deck',
        color: '#35f0ff',
    },
    {
        label: '游戏说明',
        detail: '读懂对手的意图',
        action: 'rules',
        color: '#ffcf3a',
    },
    {
        label: '设置',
        detail: '音乐与音效',
        action: 'settings',
        color: '#b56bff',
    },
] satisfies Array<{
    label: string
    detail: string
    action: 'map' | 'deck' | 'rules' | 'settings'
    color: string
}>

export function HomePage() {
    const openMap = useNavigationStore((state) => state.openMap)
    const openDeck = useNavigationStore((state) => state.openDeck)
    const [current, setCurrent] = useState(0)
    const [panel, setPanel] = useState<'rules' | 'settings' | null>(null)
    const titleId = useId()
    const choose = (action: (typeof MENU)[number]['action']) => {
        if (action === 'map') {
            playGameStart()
            openMap()
        } else if (action === 'deck') openDeck('home')
        else setPanel(action)
    }
    return (
        <main className="home-page">
            <Atmosphere variant="home" accent={MENU[current].color} />
            <div className="home-vignette" />
            <div className="home-topline">
                <span>
                    <i />
                    单人卡牌博弈
                </span>
                <span>THE NINEFOLD ARCHIVE</span>
            </div>
            <section className="home-hero" aria-label="THE CALLED">
                <p className="home-eyebrow">九格之间，万象回应。</p>
                <h1 id="home-title">
                    <PixelTitle word="THE" />
                    <PixelTitle word="CALLED" />
                </h1>
                <p className="home-subtitle">看见意图。布下你的回应。</p>
            </section>
            <nav className="home-menu" aria-labelledby="home-title">
                {MENU.map((item, index) => (
                    <button
                        key={item.action}
                        type="button"
                        className={current === index ? 'is-current' : ''}
                        onMouseEnter={() => setCurrent(index)}
                        onFocus={() => setCurrent(index)}
                        onClick={() => choose(item.action)}
                    >
                        <span className="home-menu__cursor" aria-hidden="true">
                            ◆
                        </span>
                        <span className="home-menu__label">{item.label}</span>
                        <small>{item.detail}</small>
                    </button>
                ))}
            </nav>
            <aside className="home-transmission">
                <div className="home-transmission__label">
                    <span>来自裂隙的讯息</span>
                    <i />
                </div>
                <div className="home-transmission__body">
                    <Sigil id="monster.001" />
                    <div>
                        <strong>它已经知道下一步。</strong>
                        <p>
                            每一个格位，都是一次选择。
                            <br />
                            用你的十五张牌，改写结局。
                        </p>
                    </div>
                </div>
                <div className="home-transmission__foot">
                    <span>3 × 3 / 非对称的博弈</span>
                    <span>
                        信号已接通 <b>▮▮▮</b>
                    </span>
                </div>
            </aside>
            <footer className="home-footer">
                <span>THE CALLED</span>
                <span>选择一条路，听见它的呼唤。</span>
                <span>01 / THE THRESHOLD</span>
            </footer>
            {panel && (
                <HomePanel
                    title={panel === 'rules' ? '九格之间' : '设置'}
                    labelledBy={titleId}
                    onClose={() => setPanel(null)}
                >
                    {panel === 'rules' ? (
                        <div className="home-rules">
                            <p>
                                你的牌组由 15 张卡牌组成，总负荷不超过
                                90。地图中的每一间房，都藏着一位怪物。
                            </p>
                            <ol>
                                <li>
                                    <b>预判</b>
                                    <span>
                                        怪物的意图会提前亮出。先读卡面，再决定落点。
                                    </span>
                                </li>
                                <li>
                                    <b>占格</b>
                                    <span>
                                        选择一张手牌，点亮的格位就是它能到达的位置。也可以拖动落牌。
                                    </span>
                                </li>
                                <li>
                                    <b>覆盖</b>
                                    <span>
                                        用更高点数覆盖对方卡牌；相同点数时，两张牌都离场。
                                    </span>
                                </li>
                                <li>
                                    <b>回应</b>
                                    <span>
                                        触发能力后，点选提示中的目标。结束回合，把行动交给怪物。
                                    </span>
                                </li>
                            </ol>
                            <p className="home-rules__last">
                                对局结束时，总点数更高的一方获胜。平点时比较占格。
                            </p>
                        </div>
                    ) : (
                        <SettingsPanel />
                    )}
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
    const ref = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        ref.current?.showModal()
        return () => ref.current?.close()
    }, [])
    return (
        <dialog
            ref={ref}
            className="home-panel"
            aria-labelledby={labelledBy}
            onCancel={onClose}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <header>
                <div>
                    <span>THE CALLED / ARCHIVE</span>
                    <h2 id={labelledBy}>{title}</h2>
                </div>
                <button type="button" onClick={onClose} aria-label="关闭">
                    ✕
                </button>
            </header>
            {children}
            <footer>
                <span>ESC 返回</span>
                <button
                    type="button"
                    className="pixel-button"
                    onClick={onClose}
                >
                    返回
                </button>
            </footer>
        </dialog>
    )
}

function SettingsPanel() {
    const initial = getAudioLevels()
    const [music, setMusic] = useState(Math.round(initial.music * 100))
    const [effects, setEffects] = useState(Math.round(initial.effects * 100))
    return (
        <div className="home-settings">
            <p>为下一次回应，调好频率。</p>
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
