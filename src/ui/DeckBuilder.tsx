import { useEffect, useId, useState } from 'react'
import { getCardDefinition } from '../config/cardCatalog'
import { BATTLE_DECK_LIMIT } from '../config/deckLoadout'
import { playCardSelect } from '../audio/gameAudio'
import { useDeckStore } from '../stores/deckStore'

type DeckBuilderProps = {
  onClose: () => void
}

export function DeckBuilder({ onClose }: DeckBuilderProps) {
  const titleId = useId()
  const slots = useDeckStore((state) => state.slots)
  const library = useDeckStore((state) => state.library)
  const removeSlot = useDeckStore((state) => state.removeSlot)
  const placeCard = useDeckStore((state) => state.placeCard)
  const [armedSlot, setArmedSlot] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(slots.find((cardId) => cardId) ?? library[0]?.cardId ?? null)

  const filled = slots.filter((cardId) => cardId !== null).length
  const openSlots = slots.flatMap((cardId, index) => (cardId === null ? [index] : []))
  const ready = filled === BATTLE_DECK_LIMIT
  const detail = detailId ? getCardDefinition(detailId) : null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (armedSlot !== null && slots[armedSlot] !== null) setArmedSlot(null)
  }, [armedSlot, slots])

  const seat = (cardId: string) => {
    const target = armedSlot !== null && slots[armedSlot] === null ? armedSlot : openSlots[0]
    const result = placeCard(cardId, target)
    if (!result.ok) {
      setNotice(result.reason === 'deck-full' ? '出战牌组已满。先卸下一张，再放入卡库的牌。' : '这张牌不在卡库里。')
      return
    }
    playCardSelect()
    setNotice(null)
    setArmedSlot(null)
    setDetailId(cardId)
  }

  return (
    <div className="deck-builder" role="presentation" onClick={onClose}>
      <section
        className="deck-builder__frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="deck-builder__header">
          <div>
            <p className="deck-builder__eyebrow">LOADOUT</p>
            <h2 id={titleId}>牌组</h2>
          </div>
          <p className={ready ? 'deck-builder__count is-ready' : 'deck-builder__count'}>
            {filled}/{BATTLE_DECK_LIMIT}
          </p>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <p className="deck-builder__hint">
          {ready
            ? '出战牌组已满，可以进入战斗。点击一张出战牌可把它卸回卡库。'
            : '牌组未满，无法进入战斗。点亮一个空位，再从卡库放入一张牌。'}
        </p>
        {notice && <p className="deck-builder__notice" role="status">{notice}</p>}

        <div className="deck-builder__body">
          <section className="deck-builder__pile" aria-label="出战牌组">
            <h3>出战牌组</h3>
            <div className="deck-builder__slots">
              {slots.map((cardId, index) => (
                cardId ? (
                  <CardPlate
                    key={`${cardId}-${index}`}
                    cardId={cardId}
                    label={`卸下第 ${index + 1} 张出战牌`}
                    onSelect={() => {
                      playCardSelect()
                      removeSlot(index)
                      setDetailId(cardId)
                      setNotice(null)
                      setArmedSlot(null)
                    }}
                    onInspect={() => setDetailId(cardId)}
                  />
                ) : (
                  <button
                    key={`empty-${index}`}
                    type="button"
                    className={armedSlot === index ? 'deck-slot is-armed' : 'deck-slot'}
                    aria-label={armedSlot === index ? `第 ${index + 1} 个空位已选中` : `选择第 ${index + 1} 个空位`}
                    aria-pressed={armedSlot === index}
                    onClick={() => {
                      playCardSelect()
                      setArmedSlot(index)
                      setNotice(null)
                    }}
                  >
                    <span>空位</span>
                    <small>{String(index + 1).padStart(2, '0')}</small>
                  </button>
                )
              ))}
            </div>
          </section>

          <section className="deck-builder__pile" aria-label="卡库">
            <h3>卡库</h3>
            {library.length === 0 ? (
              <p className="deck-builder__empty">卡库是空的。卸下一张出战牌后，它会回到这里。</p>
            ) : (
              <div className="deck-builder__library">
                {library.map((entry) => (
                  <CardPlate
                    key={entry.cardId}
                    cardId={entry.cardId}
                    count={entry.count}
                    label={`放入${getCardDefinition(entry.cardId).name}`}
                    disabled={openSlots.length === 0}
                    onSelect={() => seat(entry.cardId)}
                    onInspect={() => setDetailId(entry.cardId)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {detail && (
          <footer className="deck-builder__detail">
            <b>{detail.power}</b>
            <div>
              <strong>{detail.name}</strong>
              <p>{detail.description}</p>
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}

function CardPlate({
  cardId,
  count,
  label,
  disabled = false,
  onSelect,
  onInspect,
}: {
  cardId: string
  count?: number
  label: string
  disabled?: boolean
  onSelect: () => void
  onInspect: () => void
}) {
  const card = getCardDefinition(cardId)
  const monster = card.art.back.includes('Monster')
  return (
    <button
      type="button"
      className={monster ? 'deck-card is-monster' : 'deck-card'}
      aria-label={count && count > 1 ? `${label}，${count} 张` : label}
      disabled={disabled}
      onMouseEnter={onInspect}
      onFocus={onInspect}
      onClick={onSelect}
    >
      <span className="deck-card__power">{card.power}</span>
      <span className="deck-card__rule" aria-hidden="true" />
      <span className={`deck-card__name${card.name.length > 4 ? ' is-compact' : ''}`}>{card.name}</span>
      {count !== undefined && count > 1 && <span className="deck-card__count">×{count}</span>}
    </button>
  )
}
