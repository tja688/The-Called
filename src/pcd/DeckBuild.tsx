import { useEffect, useMemo, useState } from 'react'
import { Atmosphere } from '../visual/Atmosphere'
import { CardFace } from '../visual/CardFace'
import { Sigil } from '../visual/Sigil'
import { fetchCatalog, kernelOfflineMessage, validateDeck } from './client'
import {
    clearSlot,
    DECK_SIZE,
    filled,
    loadBuild,
    saveBuild,
    setBack,
    starterBuild,
    type Build,
} from './deck'
import type { PcdCatalog, PcdDeckReport } from './types'
import './deck.css'

type SchoolFilter = 'all' | 'science' | 'mystery' | 'religion'
type DeckCheck = { kind: 'checking' } | { kind: 'ready'; report: PcdDeckReport }

const SCHOOLS: ReadonlyArray<{
    id: SchoolFilter
    label: string
    code: string
}> = [
    { id: 'all', label: '全部', code: 'ALL' },
    { id: 'science', label: '科学', code: 'SCI' },
    { id: 'mystery', label: '神秘', code: 'MYS' },
    { id: 'religion', label: '宗教', code: 'REL' },
]

function slotNumber(index: number): string {
    return String(index + 1).padStart(2, '0')
}

export function DeckBuild({ onBack }: { onBack: () => void }) {
    const [catalog, setCatalog] = useState<PcdCatalog | null>(null)
    const [build, setBuild] = useState<Build | null>(null)
    const [check, setCheck] = useState<DeckCheck>({ kind: 'checking' })
    const [error, setError] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [school, setSchool] = useState<SchoolFilter>('all')
    const [search, setSearch] = useState('')

    useEffect(() => {
        let alive = true
        void fetchCatalog().then(
            (next) => {
                if (!alive) return
                setCatalog(next)
                setBuild(loadBuild() ?? starterBuild(next))
            },
            (reason: unknown) => {
                if (alive) setError(kernelOfflineMessage(reason))
            },
        )
        return () => {
            alive = false
        }
    }, [])

    useEffect(() => {
        if (!build) return
        saveBuild(build)
        setCheck({ kind: 'checking' })
        let alive = true
        const payload = filled(build)
        const timer = window.setTimeout(() => {
            void validateDeck(payload.cards, payload.backs).then(
                (report) => {
                    if (alive) setCheck({ kind: 'ready', report })
                },
                (reason: unknown) => {
                    if (!alive) return
                    setCheck({
                        kind: 'ready',
                        report: {
                            ok: false,
                            issues: [
                                reason instanceof Error
                                    ? reason.message
                                    : '没能校验牌组',
                            ],
                            load: 0,
                        },
                    })
                },
            )
        }, 180)
        return () => {
            alive = false
            window.clearTimeout(timer)
        }
    }, [build])

    const cards = useMemo(
        () => catalog?.cards.filter((card) => card.rarity.length > 0) ?? [],
        [catalog],
    )
    const cardById = useMemo(
        () => new Map(catalog?.cards.map((card) => [card.id, card])),
        [catalog],
    )
    const cardCounts = useMemo(() => {
        const counts = new Map<string, number>()
        for (const slot of build?.slots ?? []) {
            if (slot)
                counts.set(slot.cardId, (counts.get(slot.cardId) ?? 0) + 1)
        }
        return counts
    }, [build])
    const query = search.trim().toLocaleLowerCase()
    const visibleCards = cards.filter(
        (card) =>
            (school === 'all' || card.school === school) &&
            (!query ||
                `${card.name} ${card.text} ${card.id}`
                    .toLocaleLowerCase()
                    .includes(query)),
    )
    const report = check.kind === 'ready' ? check.report : null
    const selectedSlot = build?.slots[selectedIndex]
    const selectedCard = selectedSlot
        ? cardById.get(selectedSlot.cardId)
        : undefined
    const selectedBack = catalog?.backs.find(
        (back) => back.id === selectedSlot?.backId,
    )
    const cardCount = build ? filled(build).cards.length : 0

    const chooseCard = (cardId: string) => {
        setBuild((current) => {
            if (!current) return current
            return {
                slots: current.slots.map((slot, index) =>
                    index === selectedIndex
                        ? { cardId, backId: slot?.backId ?? '' }
                        : slot,
                ),
            }
        })
    }

    return (
        <main className="ac-deck">
            <Atmosphere variant="deck" />
            <div className="ac-deck__shell">
                <header className="ac-deck__bar">
                    <button
                        type="button"
                        className="ac-deck__back"
                        onClick={onBack}
                    >
                        <span aria-hidden="true">←</span> 返回
                    </button>
                    <div className="ac-deck__title">
                        <p>FIELD ARCHIVE / 01</p>
                        <h1>卡盒与构筑</h1>
                    </div>
                    <div className="ac-deck__metrics">
                        <div>
                            <span>出战卡牌</span>
                            <strong>
                                {cardCount}
                                <small> / {DECK_SIZE}</small>
                            </strong>
                        </div>
                        <div data-state={report?.ok ? 'ready' : 'pending'}>
                            <span>牌组负荷</span>
                            <strong>
                                {report?.load ?? '··'}
                                <small> / 90</small>
                            </strong>
                        </div>
                    </div>
                </header>

                {error ? (
                    <p className="ac-deck__alert" role="alert">
                        {error}
                    </p>
                ) : null}
                {!catalog || !build ? (
                    <div className="ac-deck__loading" role="status">
                        <span aria-hidden="true">▧</span> 正在读取卡盒…
                    </div>
                ) : (
                    <div className="ac-deck__body">
                        <section
                            className="ac-deck__loadout"
                            aria-label="出战牌组"
                        >
                            <div className="ac-deck__section-head">
                                <div>
                                    <p>LOADOUT</p>
                                    <h2>出战牌组</h2>
                                </div>
                                <span>
                                    {String(cardCount).padStart(2, '0')} /{' '}
                                    {DECK_SIZE}
                                </span>
                            </div>
                            <p className="ac-deck__instruction">
                                选中一个位置，再从卡盒中加入或替换卡牌。
                            </p>
                            <ol className="ac-deck__slots">
                                {build.slots.map((slot, index) => {
                                    const card = slot
                                        ? cardById.get(slot.cardId)
                                        : undefined
                                    return (
                                        <li key={index}>
                                            <button
                                                type="button"
                                                className={`ac-deck__slot${index === selectedIndex ? ' ac-deck__slot--selected' : ''}${slot ? '' : ' ac-deck__slot--empty'}`}
                                                data-school={card?.school}
                                                aria-pressed={
                                                    index === selectedIndex
                                                }
                                                aria-label={`选择第 ${index + 1} 个位置：${card?.name ?? '空位'}`}
                                                onClick={() =>
                                                    setSelectedIndex(index)
                                                }
                                            >
                                                <span className="ac-deck__slot-index">
                                                    {slotNumber(index)}
                                                </span>
                                                {card ? (
                                                    <Sigil
                                                        id={card.id}
                                                        className="ac-deck__slot-sigil"
                                                    />
                                                ) : (
                                                    <span
                                                        className="ac-deck__empty-sign"
                                                        aria-hidden="true"
                                                    >
                                                        ＋
                                                    </span>
                                                )}
                                                <strong>
                                                    {card?.name ??
                                                        (slot
                                                            ? '未知卡牌'
                                                            : '空位')}
                                                </strong>
                                                <span className="ac-deck__slot-points">
                                                    {card
                                                        ? card.isSpell
                                                            ? '法术'
                                                            : `${card.points} 点`
                                                        : '待加入'}
                                                </span>
                                                {slot?.backId ? (
                                                    <i
                                                        className="ac-deck__back-dot"
                                                        title="已附加卡背"
                                                    />
                                                ) : null}
                                            </button>
                                        </li>
                                    )
                                })}
                            </ol>

                            <div
                                className="ac-deck__inspector"
                                data-school={selectedCard?.school}
                            >
                                <div className="ac-deck__inspector-head">
                                    <span>
                                        SELECTED / {slotNumber(selectedIndex)}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={!selectedSlot}
                                        onClick={() =>
                                            setBuild(
                                                clearSlot(build, selectedIndex),
                                            )
                                        }
                                    >
                                        移出卡牌{' '}
                                        <span aria-hidden="true">×</span>
                                    </button>
                                </div>
                                <div className="ac-deck__selected-card">
                                    {selectedCard ? (
                                        <Sigil
                                            id={selectedCard.id}
                                            className="ac-deck__selected-sigil"
                                        />
                                    ) : (
                                        <span
                                            className="ac-deck__selected-empty"
                                            aria-hidden="true"
                                        >
                                            ＋
                                        </span>
                                    )}
                                    <div>
                                        <h3>
                                            {selectedCard?.name ??
                                                '等待加入卡牌'}
                                        </h3>
                                        <p>
                                            {selectedCard
                                                ? `${selectedCard.isSpell ? '法术卡' : `占场卡 · ${selectedCard.points} 点`} · 负荷 ${selectedCard.load}`
                                                : '点击右侧卡牌，将它放入这个位置。'}
                                        </p>
                                    </div>
                                </div>
                                {selectedCard ? (
                                    <p className="ac-deck__rule">
                                        {selectedCard.text || '无额外效果。'}
                                    </p>
                                ) : null}
                                <label className="ac-deck__back-select">
                                    <span>附加卡背</span>
                                    <select
                                        value={selectedSlot?.backId ?? ''}
                                        disabled={!selectedSlot}
                                        aria-label={`${selectedCard?.name ?? '选中卡牌'}的卡背`}
                                        onChange={(event) =>
                                            setBuild(
                                                setBack(
                                                    build,
                                                    selectedIndex,
                                                    event.target.value,
                                                ),
                                            )
                                        }
                                    >
                                        <option value="">无卡背</option>
                                        {catalog.backs.map((back) => (
                                            <option
                                                key={back.id}
                                                value={back.id}
                                            >
                                                {back.name} · 负荷 {back.load}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                {selectedBack ? (
                                    <p className="ac-deck__back-rule">
                                        {selectedBack.text}
                                    </p>
                                ) : null}
                            </div>

                            <div
                                className={`ac-deck__validation${report?.ok ? ' ac-deck__validation--ready' : ''}`}
                                role="status"
                            >
                                <div
                                    className="ac-deck__load-meter"
                                    aria-hidden="true"
                                >
                                    {Array.from({ length: 18 }, (_, index) => (
                                        <i
                                            key={index}
                                            className={
                                                report &&
                                                report.load > index * 5
                                                    ? 'is-filled'
                                                    : ''
                                            }
                                        />
                                    ))}
                                </div>
                                {report?.ok ? (
                                    <p>
                                        <span aria-hidden="true">■</span>{' '}
                                        牌组已就绪，可以进入对局。
                                    </p>
                                ) : (
                                    <p>
                                        {report
                                            ? '牌组尚未就绪'
                                            : '正在核对牌组…'}
                                    </p>
                                )}
                                {report && report.issues.length > 0 ? (
                                    <ul>
                                        {report.issues.map((issue) => (
                                            <li key={issue}>{issue}</li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        </section>

                        <section
                            className="ac-deck__collection"
                            aria-label="卡盒"
                        >
                            <div className="ac-deck__section-head">
                                <div>
                                    <p>COLLECTION</p>
                                    <h2>卡盒</h2>
                                </div>
                                <span>{visibleCards.length} 张卡牌</span>
                            </div>
                            <div className="ac-deck__tools">
                                <div
                                    className="ac-deck__school-tabs"
                                    aria-label="按学派筛选"
                                >
                                    {SCHOOLS.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            data-school={item.id}
                                            aria-pressed={school === item.id}
                                            onClick={() => setSchool(item.id)}
                                        >
                                            <span>{item.code}</span>{' '}
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                <label className="ac-deck__search">
                                    <span aria-hidden="true">⌕</span>
                                    <input
                                        aria-label="搜索卡牌名称或效果"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="搜索名称 / 效果"
                                        type="search"
                                    />
                                </label>
                            </div>
                            <div className="ac-deck__destination">
                                <span aria-hidden="true">▸</span>{' '}
                                {selectedSlot ? '替换' : '加入'}{' '}
                                <b>{slotNumber(selectedIndex)}</b> 号位置{' '}
                                {selectedCard ? (
                                    <span>· {selectedCard.name}</span>
                                ) : null}
                            </div>
                            <ul className="ac-deck__cards">
                                {visibleCards.map((card) => {
                                    const count = cardCounts.get(card.id) ?? 0
                                    return (
                                        <li key={card.id}>
                                            <button
                                                type="button"
                                                className="ac-deck__library-card"
                                                data-school={card.school}
                                                aria-label={`${selectedSlot ? '替换' : '加入'}第 ${selectedIndex + 1} 个位置为${card.name}`}
                                                onClick={() =>
                                                    chooseCard(card.id)
                                                }
                                            >
                                                <CardFace card={card} />
                                                {count > 0 ? (
                                                    <span className="ac-deck__included">
                                                        已入组 ×{count}
                                                    </span>
                                                ) : null}
                                                <span className="ac-deck__card-action">
                                                    <span>
                                                        {selectedSlot
                                                            ? '替换'
                                                            : '加入'}{' '}
                                                        {slotNumber(
                                                            selectedIndex,
                                                        )}{' '}
                                                        <b aria-hidden="true">
                                                            ＋
                                                        </b>
                                                    </span>
                                                    <span>
                                                        负荷 {card.load}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                            {visibleCards.length === 0 ? (
                                <p className="ac-deck__no-results">
                                    没有符合条件的卡牌。试试其他名称或学派。
                                </p>
                            ) : null}
                        </section>
                    </div>
                )}
                <footer className="ac-deck__footer">
                    <span>THE CALLED / FIELD ARCHIVE</span>
                    <span>构筑自动保存</span>
                </footer>
            </div>
        </main>
    )
}
