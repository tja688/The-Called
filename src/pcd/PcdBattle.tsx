import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { playCardFlip, playCardSelect } from '../audio/gameAudio'
import { Atmosphere } from '../visual/Atmosphere'
import { CardFace, SCHOOL_NAMES } from '../visual/CardFace'
import { InkBurst } from '../visual/InkBurst'
import { Sigil } from '../visual/Sigil'
import { answerMatch } from './client'
import {
    cellChoice,
    cellEffects,
    otherChoices,
    type CellEffect,
} from './flatChoices'
import { beatsFor } from './playback'
import type {
    PcdAdvance,
    PcdCatalog,
    PcdOption,
    PcdView,
    PcdViewCard,
} from './types'
import './battle2d.css'

type Drag = { card: PcdViewCard; x: number; y: number }
type Pile = 'matchDeck' | 'playerDiscard' | 'monsterDiscard' | 'playerVoid'
type EffectFrame = { id: number; effects: CellEffect[] }

export function PcdBattle({
    catalog,
    advance: opening,
    monsterId,
    onDone,
}: {
    catalog: PcdCatalog
    advance: PcdAdvance
    monsterId: string
    onDone: () => void
}) {
    const [advance, setAdvance] = useState(opening)
    const [view, setView] = useState(opening.view)
    const [ready, setReady] = useState(false)
    const [selected, setSelected] = useState<number | null>(null)
    const [inspection, setInspection] = useState<PcdViewCard | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [effects, setEffects] = useState<EffectFrame>({ id: 0, effects: [] })
    const [beatLabel, setBeatLabel] = useState('你的回合')
    const [fast, setFast] = useState(false)
    const [drag, setDrag] = useState<Drag | null>(null)
    const [pile, setPile] = useState<Pile | null>(null)
    const [confirmExit, setConfirmExit] = useState(false)
    const dragRef = useRef<{
        card: PcdViewCard
        x: number
        y: number
        active: boolean
    } | null>(null)
    const skipClick = useRef(false)
    const cancelledDrag = useRef(false)
    const busy = useRef(true)
    const live = useRef(true)
    const previous = useRef<PcdView | null>(null)
    const speed = useRef(false)
    speed.current = fast
    const result = view.winner ? { winner: view.winner } : null
    const options = ready && !result ? (advance.pending?.options ?? []) : []
    const monster = catalog.monsters.find((item) => item.id === monsterId)
    const intent = catalog.cards.find((card) => card.id === view.revealedIntent)
    const selectedCard = view.hand.find((card) => card.instance === selected)
    const inspectCard = inspection ?? selectedCard ?? null
    const inspectInfo = catalog.cards.find(
        (card) => card.id === inspectCard?.cardId,
    )
    const endTurn = options.find((option) => option.kind === 'end-turn')
    const cast = options.find(
        (option) => option.kind === 'cast' && option.instance === selected,
    )
    const loose = otherChoices(options, view)
    const pendingTarget = ready && options.some(option => option.kind === 'card' || option.kind === 'cell')
    const pileLabels: Record<Pile, string> = {
        matchDeck: '牌组',
        playerDiscard: '玩家弃牌堆',
        monsterDiscard: '怪物弃牌堆',
        playerVoid: '消散区',
    }

    useEffect(() => {
        live.current = true
        return () => {
            live.current = false
        }
    }, [])

    useEffect(() => {
        let active = true
        busy.current = true
        setReady(false)
        setSelected(null)
        setInspection(null)
        setDrag(null)
        dragRef.current = null
        cancelledDrag.current = false
        const reduced = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches
        const frames = beatsFor(previous.current, advance)
        void (async () => {
            let before = previous.current
            for (const beat of frames) {
                if (!active || !live.current) return
                const changes = before ? cellEffects(before, beat.view) : []
                setView(beat.view)
                setEffects((current) => ({
                    id: current.id + 1,
                    effects: changes,
                }))
                if (beat.fly) {
                    setBeatLabel(
                        beat.fly.side === 'monster'
                            ? '怪物正在回应'
                            : '卡牌入场',
                    )
                    playCardFlip()
                } else if (changes.some((change) => change.kind === 'points'))
                    setBeatLabel('点数变化')
                else if (changes.some((change) => change.kind === 'leave'))
                    setBeatLabel('卡牌离场')
                else if (beat.view.revealedIntent !== before?.revealedIntent)
                    setBeatLabel('意图揭示')
                before = beat.view
                if (frames.length > 1)
                    await pause(
                        reduced
                            ? 12
                            : speed.current
                              ? 65
                              : beat.fly
                                ? 440
                                : changes.length
                                  ? 280
                                  : 110,
                    )
            }
            if (!active || !live.current) return
            previous.current = advance.view
            setView(advance.view)
            setEffects((current) => ({ id: current.id + 1, effects: [] }))
            busy.current = false
            setReady(advance.pending?.actor === 'player')
            setBeatLabel(
                advance.result || advance.view.winner ? '对局结束' : '你的回合',
            )
        })()
        return () => {
            active = false
        }
    }, [advance])

    useEffect(() => {
        if (!notice) return
        const timer = window.setTimeout(() => setNotice(null), 2600)
        return () => window.clearTimeout(timer)
    }, [notice])

    const submit = (option: PcdOption) => {
        if (
            busy.current ||
            !ready ||
            !options.some((offered) => offered.id === option.id)
        )
            return
        busy.current = true
        setReady(false)
        setNotice(null)
        setDrag(null)
        dragRef.current = null
        cancelledDrag.current = false
        setSelected(null)
        setPile(null)
        void answerMatch(advance.snapshot, option.id).then(
            (next) => {
                if (live.current) setAdvance(next)
            },
            (reason: unknown) => {
                if (!live.current) return
                busy.current = false
                setReady(true)
                setNotice(
                    reason instanceof Error
                        ? reason.message
                        : '这次回应没有送达，请重试。',
                )
            },
        )
    }

    const selectHand = (card: PcdViewCard) => {
        const answer = options.find(
            (option) =>
                option.kind === 'card' && option.instance === card.instance,
        )
        if (answer) {
            submit(answer)
            return
        }
        setInspection(null)
        if (!options.some(option => ['play', 'cast'].includes(option.kind) && option.instance === card.instance)) {
            setSelected(null)
            setInspection(card)
            return
        }
        setSelected((current) =>
            current === card.instance ? null : card.instance,
        )
        playCardSelect()
    }

    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (
                event.target instanceof Element &&
                event.target.closest(
                    'input,select,textarea,dialog,[role="dialog"]',
                )
            )
                return
            if (event.key === 'Escape') {
                cancelledDrag.current = dragRef.current !== null
                dragRef.current = null
                setDrag(null)
                setSelected(null)
                setInspection(null)
                setPile(null)
                setConfirmExit(false)
                return
            }
            if (event.repeat || !ready || pile || confirmExit || result) return
            const index = Number(event.key) - 1
            if (/^[1-9]$/.test(event.key) && view.hand[index]) {
                event.preventDefault()
                selectHand(view.hand[index])
            }
            if (event.key.toLowerCase() === 'e' && endTurn) {
                event.preventDefault()
                submit(endTurn)
            }
            if (event.key === 'Enter' && cast) {
                event.preventDefault()
                submit(cast)
            }
        }
        window.addEventListener('keydown', key)
        return () => window.removeEventListener('keydown', key)
    })

    const pointerDown = (
        event: PointerEvent<HTMLButtonElement>,
        card: PcdViewCard,
    ) => {
        if (
            event.button !== 0 ||
            !options.some(
                (option) =>
                    option.kind === 'play' && option.instance === card.instance,
            )
        )
            return
        dragRef.current = {
            card,
            x: event.clientX,
            y: event.clientY,
            active: false,
        }
        cancelledDrag.current = false
        event.currentTarget.setPointerCapture(event.pointerId)
    }
    const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
        const gesture = dragRef.current
        if (!gesture) return
        if (
            !gesture.active &&
            Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 7
        )
            return
        gesture.active = true
        setSelected(gesture.card.instance)
        setInspection(null)
        setDrag({ card: gesture.card, x: event.clientX, y: event.clientY })
    }
    const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
        const gesture = dragRef.current
        dragRef.current = null
        setDrag(null)
        const cancelled = cancelledDrag.current
        cancelledDrag.current = false
        if (gesture?.active || cancelled) {
            skipClick.current = true
            window.setTimeout(() => {
                skipClick.current = false
            }, 0)
        }
        if (!gesture?.active || cancelled) return
        const target = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest('[data-cell]')
        const cell = Number(target?.getAttribute('data-cell'))
        const option = options.find(
            (item) =>
                item.kind === 'play' &&
                item.instance === gesture.card.instance &&
                item.cell === cell,
        )
        if (option) submit(option)
        else setNotice('将卡牌放到点亮的格位上。')
    }

    const instruction = !ready
        ? beatLabel
        : pendingTarget
          ? options.some(option => option.kind === 'card' && option.cell === 0)
            ? '选择卡牌目标，完成能力结算。'
            : '选择点亮的目标，完成能力结算。'
          : cast
            ? '法术已就绪。点击「施放法术」或按 Enter。'
            : selectedCard
              ? options.some(
                    (option) =>
                        option.kind === 'play' && option.instance === selected,
                )
                  ? '选择一个点亮的格位。'
                  : '这张牌本回合暂时无法打出。'
              : endTurn &&
                  !options.some(
                      (option) =>
                          option.kind === 'play' || option.kind === 'cast',
                  )
                ? '你的回应已完成，结束回合。'
                : advance.pending?.type === 'play-card'
                  ? '能力允许再打出一张牌。选择手牌，再选择格位或施放法术。'
                  : '选择手牌，回应它的意图。'

    const pileCards =
        pile === 'matchDeck'
            ? view.matchDeck
                  .slice()
                  .sort((a, b) => a.cardId.localeCompare(b.cardId))
            : pile
              ? view[pile]
              : []

    return (
        <main
            className={`battle-2d${drag ? ' battle-2d--dragging' : ''}`}
            data-ready={ready}
            data-round={view.round}
            data-decision={ready ? advance.pending?.type : 'animating'}
        >
            <Atmosphere variant="battle" />
            <header className="battle-header">
                <button
                    type="button"
                    className="battle-back"
                    onClick={() => setConfirmExit(true)}
                >
                    ‹ <span>返回地图</span>
                </button>
                <div className="battle-header__title">
                    <span>THE CALLED / 对局</span>
                    <strong>{monster?.name ?? monsterId}</strong>
                </div>
                <button
                    className="battle-speed"
                    type="button"
                    aria-pressed={fast}
                    onClick={() => setFast((current) => !current)}
                >
                    {fast ? '▸▸ 加速' : '▸ 常速'}
                </button>
            </header>
            <div className="battle-round">
                <span className={ready ? 'is-player' : 'is-busy'} />
                <b>回合 {String(view.round).padStart(2, '0')}</b>
                <small aria-live="polite">{beatLabel}</small>
            </div>
            <section className="battle-layout">
                <aside className="battle-player-panel">
                    <div
                        className="battle-score"
                        aria-label={`玩家总点数 ${view.playerPoints}`}
                    >
                        <span className="battle-kicker">玩家 / YOU</span>
                        <strong key={view.playerPoints}>
                            {String(view.playerPoints).padStart(2, '0')}
                        </strong>
                        <span className="battle-score__caption">
                            总点数<span>占格 {view.playerOccupancy} / 9</span>
                        </span>
                        <div className="battle-score__pips">
                            {Array.from({ length: 9 }, (_, index) => (
                                <i
                                    key={index}
                                    className={
                                        index < view.playerOccupancy
                                            ? 'is-filled'
                                            : ''
                                    }
                                />
                            ))}
                        </div>
                    </div>
                    <div className="battle-piles">
                        <button
                            type="button"
                            onClick={() => setPile('matchDeck')}
                        >
                            牌组<span>{view.matchDeckCount}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPile('playerDiscard')}
                        >
                            弃牌堆<span>{view.playerDiscardCount}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setPile('playerVoid')}
                        >
                            消散区<span>{view.playerVoid.length}</span>
                        </button>
                    </div>
                    {view.pools
                        .filter((pool) => pool.owner === 'player')
                        .map((pool) => (
                            <div className="battle-resource" key={pool.id}>
                                <span>
                                    {catalog.resources.find(
                                        (item) => item.id === pool.id,
                                    )?.name ?? pool.id}
                                </span>
                                <b>{pool.amount}</b>
                            </div>
                        ))}
                    <div className="battle-inspect" aria-live="polite">
                        <span className="battle-kicker">
                            {inspectInfo ? '卡牌档案' : '行动提示'}
                        </span>
                        {inspectInfo ? (
                            <>
                                <h3>{inspectInfo.name}</h3>
                                <p>
                                    {inspectInfo.text ||
                                        '以纯粹的力量占据战场。'}
                                </p>
                                <div className="battle-inspect__meta">
                                    <span>
                                        {SCHOOL_NAMES[inspectInfo.school] ??
                                            '怪物'}
                                    </span>
                                    <span>
                                        {inspectInfo.isSpell
                                            ? '法术'
                                            : `${inspectCard?.currentPoints ?? inspectInfo.points} 点`}
                                    </span>
                                </div>
                                {inspectCard?.statuses.length ? (
                                    <p className="battle-inspect__status">
                                        {inspectCard.statuses
                                            .map(
                                                (id) =>
                                                    catalog.statuses.find(
                                                        (item) =>
                                                            item.id === id,
                                                    )?.name ?? id,
                                            )
                                            .join(' · ')}
                                    </p>
                                ) : null}
                                {inspectCard?.timer ? (
                                    <p className="battle-inspect__status">
                                        计时 {inspectCard.timer}
                                    </p>
                                ) : null}
                                {inspectCard?.cardBackId ? (
                                    <p className="battle-inspect__status">
                                        卡背 ·{' '}
                                        {
                                            catalog.backs.find(
                                                (back) =>
                                                    back.id ===
                                                    inspectCard.cardBackId,
                                            )?.name
                                        }
                                    </p>
                                ) : null}
                            </>
                        ) : (
                            <>
                                <h3>看见意图，布下回应。</h3>
                                <p>
                                    选择一张手牌，点亮合法格位。
                                    <br />
                                    悬停卡牌，阅读完整能力。
                                </p>
                                <small>1–9 选牌 · E 结束回合</small>
                            </>
                        )}
                    </div>
                    {loose.length > 0 && (
                        <div
                            className="battle-choices"
                            role="group"
                            aria-label="能力选择"
                        >
                            <span className="battle-kicker">
                                {advance.pending?.ability ? '能力结算' : '待决策'}
                            </span>
                            <h2>选择你的回应</h2>
                            <div>
                                {loose.map((option) => {
                                    const card = view.cards.find(
                                        (item) => item.instance === option.instance,
                                    )
                                    const info = catalog.cards.find(
                                        (item) =>
                                            item.id === (card?.cardId ?? option.cardId),
                                    )
                                    return (
                                        <button
                                            className="pixel-button"
                                            key={option.id}
                                            type="button"
                                            data-option-id={option.id}
                                            onClick={() => submit(option)}
                                        >
                                            {option.kind === 'activate'
                                                ? '激活 · '
                                                : ''}
                                            {info?.name ??
                                                (option.kind === 'skip'
                                                    ? '跳过'
                                                    : option.kind === 'pass'
                                                      ? '确认'
                                                      : option.kind === 'accept'
                                                        ? '接受'
                                                        : option.kind === 'decline'
                                                          ? '放弃'
                                                          : (option.cardId ??
                                                            '确认选择'))}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </aside>
                <div className="battle-arena">
                    <div className="battle-arena__label">
                        <span>九宫格</span>
                        <span>THE NINEFOLD</span>
                    </div>
                    <div className="battle-board" aria-label="九宫格战场">
                        {view.cells.map((cell) => {
                            const card = cell.card
                            const info = catalog.cards.find(
                                (item) => item.id === card?.cardId,
                            )
                            const option = cellChoice(
                                options,
                                cell.cell,
                                card?.instance ?? null,
                                selected,
                            )
                            const effect = effects.effects.find(
                                (item) => item.cell === cell.cell,
                            )
                            const statuses =
                                card?.statuses.map(
                                    (id) =>
                                        catalog.statuses.find(
                                            (status) => status.id === id,
                                        )?.name ?? id,
                                ) ?? []
                            return (
                                <button
                                    key={cell.cell}
                                    type="button"
                                    data-cell={cell.cell}
                                    data-legal={Boolean(option)}
                                    data-owner={card?.owner ?? 'empty'}
                                    data-instance={card?.instance ?? ''}
                                    className={`battle-cell${option ? ' is-legal' : ''}${cell.polluted ? ' is-polluted' : ''}${effect ? ` is-${effect.kind}` : ''}`}
                                    aria-label={`格位 ${cell.cell}${info ? `，${info.name}，${card?.currentPoints} 点，${card?.owner === 'player' ? '玩家' : '怪物'}` : '，空格'}${option ? '，可选择' : ''}`}
                                    onClick={() => {
                                        if (option) submit(option)
                                        else if (card) setInspection(card)
                                    }}
                                    onMouseEnter={() => {
                                        if (card) setInspection(card)
                                    }}
                                    onMouseLeave={() => setInspection(null)}
                                    onFocus={() => {
                                        if (card) setInspection(card)
                                    }}
                                    onBlur={() => setInspection(null)}
                                >
                                    <span className="battle-cell__index">
                                        {String(cell.cell).padStart(2, '0')}
                                    </span>
                                    {card && info ? (
                                        <div
                                            className="battle-cell__card"
                                            key={`card:${card.instance}`}
                                        >
                                            <CardFace
                                                card={info}
                                                points={card.currentPoints}
                                                owner={card.owner}
                                                statuses={statuses}
                                                compact
                                            />
                                        </div>
                                    ) : (
                                        <span
                                            className="battle-cell__empty"
                                            aria-hidden="true"
                                        >
                                            <i />
                                            {option ? '+' : '·'}
                                        </span>
                                    )}
                                    {cell.polluted && (
                                        <span className="battle-cell__pollution">
                                            污染
                                        </span>
                                    )}
                                    {option && (
                                        <span
                                            className="battle-cell__reticle"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {effect && (
                                        <span
                                            key={`effect:${effects.id}`}
                                            className="battle-cell__effect"
                                        >
                                            <InkBurst tone={effect.owner} />
                                            {effect.kind === 'points' && (
                                                <b
                                                    className={
                                                        effect.delta < 0
                                                            ? 'is-negative'
                                                            : ''
                                                    }
                                                >
                                                    {effect.delta > 0
                                                        ? '+'
                                                        : ''}
                                                    {effect.delta}
                                                </b>
                                            )}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                    <div className="battle-instruction" role="status">
                        <i />
                        {instruction}
                    </div>
                </div>
                <aside className="battle-monster-panel">
                    <div
                        className="battle-score battle-score--monster"
                        aria-label={`怪物总点数 ${view.monsterPoints}`}
                    >
                        <span className="battle-kicker">怪物 / ADVERSARY</span>
                        <strong key={view.monsterPoints}>
                            {String(view.monsterPoints).padStart(2, '0')}
                        </strong>
                        <span className="battle-score__caption">
                            总点数<span>占格 {view.monsterOccupancy} / 9</span>
                        </span>
                        <div className="battle-score__pips">
                            {Array.from({ length: 9 }, (_, index) => (
                                <i
                                    key={index}
                                    className={
                                        index < view.monsterOccupancy
                                            ? 'is-filled'
                                            : ''
                                    }
                                />
                            ))}
                        </div>
                    </div>
                    <div className="battle-intent">
                        <span className="battle-kicker">
                            <i />
                            已揭示意图
                        </span>
                        {intent ? (
                            <>
                                <div className="battle-intent__preview">
                                    <Sigil id={intent.id} />
                                    <div>
                                        <h3>{intent.name}</h3>
                                        <span>
                                            {intent.isSpell
                                                ? '法术'
                                                : `${intent.points} 点 / 占场卡`}
                                        </span>
                                    </div>
                                </div>
                                <p>{intent.text || '将以点数占据战场。'}</p>
                            </>
                        ) : (
                            <p>等待下一次回应。</p>
                        )}
                        <div
                            className="battle-intent__sequence"
                            aria-label="意图顺序"
                        >
                            {view.intents.map((id, index) => (
                                <span
                                    key={`${id}-${index}`}
                                    className={
                                        index ===
                                        view.intentIndex %
                                            Math.max(1, view.intents.length)
                                            ? 'is-current'
                                            : ''
                                    }
                                    title={
                                        catalog.cards.find(
                                            (card) => card.id === id,
                                        )?.name
                                    }
                                >
                                    <Sigil id={id} />
                                    <i />
                                </span>
                            ))}
                        </div>
                    </div>
                    <button
                        className="battle-monster-discard"
                        type="button"
                        onClick={() => setPile('monsterDiscard')}
                    >
                        怪物弃牌堆<span>{view.monsterDiscardCount}</span>
                    </button>
                    {view.pools
                        .filter((pool) => pool.owner === 'monster')
                        .map((pool) => (
                            <div className="battle-resource" key={pool.id}>
                                <span>
                                    {catalog.resources.find(
                                        (item) => item.id === pool.id,
                                    )?.name ?? pool.id}
                                </span>
                                <b>{pool.amount}</b>
                            </div>
                        ))}
                </aside>
            </section>
            {inspectInfo && (
                <div className="battle-mobile-detail">
                    <strong>{inspectInfo.name}</strong>
                    <p>{inspectInfo.text || '以纯粹的力量占据战场。'}</p>
                    {inspectCard?.statuses.length ? (
                        <small>
                            {inspectCard.statuses
                                .map(
                                    (id) =>
                                        catalog.statuses.find(
                                            (status) => status.id === id,
                                        )?.name ?? id,
                                )
                                .join(' · ')}
                        </small>
                    ) : null}
                </div>
            )}
            <section className="battle-hand-area" aria-label="手牌区域">
                <div className="battle-hand-heading">
                    <span>
                        你的手牌 <b>{view.hand.length}</b>
                    </span>
                    <small>
                        {ready
                            ? `出牌机会 ${view.remainingOpportunities}`
                            : '等待结算'}
                    </small>
                </div>
                <div className="battle-hand">
                    {view.hand.map((card, index) => {
                        const info = catalog.cards.find(
                            (item) => item.id === card.cardId,
                        )
                        if (!info) return null
                        const playable = options.some(
                            (option) =>
                                ['play', 'cast', 'card'].includes(
                                    option.kind,
                                ) && option.instance === card.instance,
                        )
                        return (
                            <button
                                type="button"
                                key={card.instance}
                                data-hand-instance={card.instance}
                                data-playable={playable}
                                aria-pressed={selected === card.instance}
                                className={`battle-hand-card${selected === card.instance ? ' is-selected' : ''}${playable ? ' is-playable' : ''}`}
                                aria-label={`${info.name}，${card.isSpell ? '法术' : `${card.currentPoints} 点`}`}
                                onClick={() => {
                                    if (skipClick.current) {
                                        skipClick.current = false
                                        return
                                    }
                                    if (!busy.current) selectHand(card)
                                }}
                                onMouseEnter={() => setInspection(card)}
                                onMouseLeave={() => setInspection(null)}
                                onFocus={() => setInspection(card)}
                                onBlur={() => setInspection(null)}
                                onPointerDown={(event) =>
                                    pointerDown(event, card)
                                }
                                onPointerMove={pointerMove}
                                onPointerUp={pointerUp}
                                onPointerCancel={() => {
                                    dragRef.current = null
                                    cancelledDrag.current = false
                                    setDrag(null)
                                }}
                            >
                                <CardFace
                                    card={info}
                                    points={card.currentPoints}
                                    owner="player"
                                />
                                <span className="battle-hand-card__key">
                                    {index < 9 ? index + 1 : ''}
                                </span>
                            </button>
                        )
                    })}
                    {view.hand.length === 0 && (
                        <p className="battle-empty-hand">
                            手牌已空。等待下一次抽牌。
                        </p>
                    )}
                </div>
            </section>
            <div className="battle-actions">
                {cast && (
                    <button
                        type="button"
                        className="pixel-button battle-cast"
                        onClick={() => submit(cast)}
                    >
                        ✦ 施放法术 <small>ENTER</small>
                    </button>
                )}
                <button
                    type="button"
                    className="pixel-button pixel-button--accent"
                    disabled={!endTurn}
                    onClick={() => {
                        if (endTurn) submit(endTurn)
                    }}
                >
                    结束回合 <small>E</small>
                </button>
            </div>
            <footer className="battle-footer">
                <span>THE CALLED</span>
                <span>青 / 玩家 · 红 / 怪物</span>
                <span>ESC 取消选择</span>
            </footer>
            {notice && (
                <div className="battle-notice" role="alert">
                    {notice}
                </div>
            )}
            <div className="battle-mobile-piles">
                <button type="button" onClick={() => setPile('matchDeck')}>
                    牌组 {view.matchDeckCount}
                </button>
                <button type="button" onClick={() => setPile('playerDiscard')}>
                    弃牌 {view.playerDiscardCount}
                </button>
            </div>
            {drag && (
                <div
                    className="battle-drag-card"
                    style={{ left: drag.x, top: drag.y }}
                >
                    <CardFace
                        card={
                            catalog.cards.find(
                                (card) => card.id === drag.card.cardId,
                            ) ?? fallbackInfo(drag.card)
                        }
                        points={drag.card.currentPoints}
                    />
                </div>
            )}
            {pile && (
                <div className="battle-modal" onClick={() => setPile(null)}>
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label={pileLabels[pile]}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <header>
                            <div>
                                <span className="battle-kicker">卡牌档案</span>
                                <h2>
                                    {pileLabels[pile]}{' '}
                                    <small>
                                        {pile === 'matchDeck'
                                            ? view.matchDeckCount
                                            : pileCards.length}
                                    </small>
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="pixel-button"
                                onClick={() => setPile(null)}
                            >
                                关闭
                            </button>
                        </header>
                        {pile === 'matchDeck' && (
                            <p className="battle-modal__note">
                                抽取顺序不公开，卡牌在抽出时揭示。
                            </p>
                        )}
                        <div className="battle-pile-cards">
                            {pileCards.map((card) => {
                                const info = catalog.cards.find(
                                    (item) => item.id === card.cardId,
                                )
                                return info ? (
                                    <div key={card.instance}>
                                        <CardFace
                                            card={info}
                                            points={card.currentPoints}
                                            owner={card.owner}
                                        />
                                    </div>
                                ) : null
                            })}
                            {pileCards.length === 0 && (
                                <p>
                                    {pile === 'matchDeck' &&
                                    view.matchDeckCount > 0
                                        ? `牌组中还有 ${view.matchDeckCount} 张卡牌。`
                                        : '这里还没有卡牌。'}
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            )}
            {confirmExit && !result && (
                <div className="battle-modal">
                    <section
                        className="battle-exit"
                        role="dialog"
                        aria-modal="true"
                        aria-label="离开对局"
                    >
                        <span className="battle-kicker">对局尚未结束</span>
                        <h2>返回地图？</h2>
                        <p>本次对局的进度将不保留。</p>
                        <div>
                            <button
                                type="button"
                                className="pixel-button"
                                onClick={() => setConfirmExit(false)}
                            >
                                继续对局
                            </button>
                            <button
                                type="button"
                                className="pixel-button pixel-button--accent"
                                onClick={onDone}
                            >
                                返回地图
                            </button>
                        </div>
                    </section>
                </div>
            )}
            {result && (
                <div
                    className="battle-modal battle-result"
                    role="dialog"
                    aria-modal="true"
                    aria-label="对局结果"
                >
                    <section>
                        <span className="battle-kicker">
                            THE NINEFOLD / 对局结束
                        </span>
                        <Sigil id={monsterId} />
                        <h2>
                            {result.winner === 'player'
                                ? '回应已落定'
                                : result.winner === 'monster'
                                  ? '裂隙吞没了回应'
                                  : '不分胜负'}
                        </h2>
                        <p>
                            {result.winner === 'player'
                                ? '你赢下了这场对局。'
                                : result.winner === 'monster'
                                  ? '这一次，怪物赢了。'
                                  : '双方总点数与占格相同。'}
                        </p>
                        <div className="battle-result__score">
                            <span>
                                {view.playerPoints}
                                <small>玩家</small>
                            </span>
                            <i>:</i>
                            <span>
                                {view.monsterPoints}
                                <small>怪物</small>
                            </span>
                        </div>
                        <button
                            type="button"
                            className="pixel-button pixel-button--accent"
                            onClick={onDone}
                        >
                            回到地图
                        </button>
                    </section>
                </div>
            )}
        </main>
    )
}

function pause(ms: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}
function fallbackInfo(card: PcdViewCard) {
    return {
        id: card.cardId,
        name: card.cardId,
        isSpell: card.isSpell,
        points: card.currentPoints,
        load: 0,
        rarity: '',
        school: '',
        text: '',
    }
}
