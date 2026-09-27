import { useEffect, useId, useState } from 'react'
import { playCardSelect } from '../../../../audio/gameAudio'
import type { CampaignState } from '../../meta'
import { cardLine } from './cards'
import {
  boxCopies,
  commitOrganizedDeck,
  filledCount,
  firstOpen,
  freshCopies,
  placeCopy,
  seatedDraft,
  unseatAt,
  type Draft,
} from './organize'
import './board.css'

export function DeckOrganizer({
  campaign,
  onCampaign,
  mode,
  leads,
  alerts,
  rejected,
  onBack,
  onDone,
}: {
  campaign: CampaignState
  onCampaign: (state: CampaignState) => void
  mode: 'deck' | 'reward'
  leads: readonly string[]
  alerts?: readonly string[]
  rejected?: readonly string[]
  onBack?: () => void
  onDone?: () => void
}) {
  const titleId = useId()
  const pending = mode === 'reward' ? campaign.pendingRewardNames : []
  const editable = !campaign.inBattle
  const [draft, setDraft] = useState<Draft>(() => seatedDraft(campaign.deck))
  const [armed, setArmed] = useState<number | null>(null)
  const [detailName, setDetailName] = useState<string | null>(campaign.deck[0] ?? null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setDraft(seatedDraft(campaign.deck))
    setArmed(null)
    setMessage(null)
    setDetailName(campaign.deck[0] ?? null)
  }, [campaign])

  const filled = filledCount(draft)
  const ready = editable && filled === draft.length && draft.length > 0
  const fresh = freshCopies(pending, draft)
  const spare = boxCopies(campaign.box, draft, pending)
  const freshLeft = fresh.reduce((sum, row) => sum + row.count, 0)
  const open = firstOpen(draft)
  const detail = detailName ? cardLine(detailName, 0) : null
  const shownAlerts = [...(alerts ?? []), ...(message ? [message] : [])]

  const lift = (index: number) => {
    if (!editable) return
    const seat = draft[index]
    if (!seat) {
      setArmed(index)
      setMessage(null)
      playCardSelect()
      return
    }
    setDraft(unseatAt(draft, index))
    setArmed(null)
    setDetailName(seat.name)
    setMessage(null)
    playCardSelect()
  }

  const place = (name: string, source: 'fresh' | 'box') => {
    if (!editable) return
    const index = armed !== null && draft[armed] === null ? armed : open
    if (index === null) return
    const next = placeCopy(draft, index, name, source, campaign.box, pending)
    if (next === draft) return
    setDraft(next)
    setArmed(null)
    setDetailName(name)
    setMessage(null)
    playCardSelect()
  }

  const save = () => {
    if (!ready) return
    const outcome = commitOrganizedDeck(campaign, draft)
    if (!outcome.ok) {
      setMessage(outcome.message)
      return
    }
    setMessage(null)
    onCampaign(outcome.state)
    onDone?.()
  }

  return (
    <div className="v6-board">
      <section className="v6-board__frame" aria-labelledby={titleId}>
        <header className="v6-board__header">
          <div>
            <p className="v6-board__eyebrow">{mode === 'reward' ? 'REWARD' : 'LOADOUT'}</p>
            <h2 id={titleId}>牌组</h2>
          </div>
          <p className={ready ? 'v6-board__count is-ready' : 'v6-board__count'} aria-live="polite">
            {filled}/{draft.length}
          </p>
          <div className="v6-board__tools">
            {onBack ? (
              <button type="button" onClick={onBack}>返回</button>
            ) : null}
            <button type="button" disabled={!ready} onClick={save}>
              {mode === 'reward' ? '完成' : '保存'}
            </button>
          </div>
        </header>

        {leads.map((line) => (
          <p key={line} className="v6-board__lead">{line}</p>
        ))}
        <p className="v6-board__hint">{hintFor(mode, filled, draft.length, freshLeft)}</p>
        {shownAlerts.map((line) => (
          <p key={line} className="v6-board__alert" role="status">{line}</p>
        ))}

        <div className={mode === 'reward' ? 'v6-board__body' : 'v6-board__body v6-board__body--solo'}>
          <div className="v6-board__main">
            <section className="v6-board__pile" aria-label="出战牌组">
              <h3>出战牌组</h3>
              <div className="v6-board__slots">
                {draft.map((seat, index) => (
                  seat ? (
                    <Plate
                      key={`deck-${index}-${seat.name}`}
                      name={seat.name}
                      fresh={seat.fresh}
                      label={`卸下第 ${index + 1} 张出战牌 ${seat.name}`}
                      disabled={!editable}
                      onInspect={() => setDetailName(seat.name)}
                      onSelect={() => lift(index)}
                    />
                  ) : (
                    <button
                      key={`empty-${index}`}
                      type="button"
                      className={armed === index ? 'v6-slot is-armed' : 'v6-slot'}
                      aria-label={armed === index ? `第 ${index + 1} 个空位已选中` : `选择第 ${index + 1} 个空位`}
                      aria-pressed={armed === index}
                      disabled={!editable}
                      onClick={() => lift(index)}
                    >
                      <span>空位</span>
                      <small>{String(index + 1).padStart(2, '0')}</small>
                    </button>
                  )
                ))}
              </div>
            </section>

            <section className="v6-board__pile" aria-label="卡盒">
              <h3>卡盒</h3>
              {spare.length === 0 ? (
                <p className="v6-board__empty">卸下一张出战牌后，它会回到这里。</p>
              ) : (
                <div className="v6-board__box">
                  {spare.map((row) => (
                    <Plate
                      key={`box-${row.name}`}
                      name={row.name}
                      count={row.count}
                      label={`放入${row.name}`}
                      disabled={!editable}
                      onInspect={() => setDetailName(row.name)}
                      onSelect={() => place(row.name, 'box')}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {mode === 'reward' ? (
            <aside className="v6-board__rail" aria-label="新获得">
              <h3>新获得</h3>
              {fresh.length === 0 ? (
                <p className="v6-board__empty">
                  {pending.length === 0 ? '这次没有新牌。' : '都已放进出战牌组。'}
                </p>
              ) : (
                <div className="v6-board__fresh">
                  {fresh.map((row) => (
                    <Plate
                      key={`fresh-${row.name}`}
                      name={row.name}
                      count={row.count}
                      fresh
                      label={`放入${row.name}`}
                      disabled={!editable}
                      onInspect={() => setDetailName(row.name)}
                      onSelect={() => place(row.name, 'fresh')}
                    />
                  ))}
                </div>
              )}
              {rejected && rejected.length > 0 ? (
                <>
                  <p className="v6-board__kicker">未入盒</p>
                  <ul className="v6-board__reject">
                    {rejected.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </aside>
          ) : null}
        </div>

        {detail ? (
          <footer className="v6-board__detail">
            <b>{detail.power ?? '—'}</b>
            <div>
              <strong>{detail.name}</strong>
              <p>
                {detail.rarityLabel ? <span className="v6-board__rarity">{detail.rarityLabel}</span> : null}
                {detail.effectText}
              </p>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  )
}

function hintFor(mode: 'deck' | 'reward', filled: number, size: number, freshLeft: number): string {
  const open = filled < size
  if (mode === 'reward') {
    if (open) return '还有空位。从新获得或卡盒放回一张牌。'
    if (freshLeft > 0) return '牌组已满。要编入新牌，先从出战牌组卸下一张。'
    return '牌组已满，可以离开。'
  }
  if (open) return '点一个空位，再从卡盒放入一张牌。'
  return '牌组已满。点一张出战牌，把它卸回卡盒。'
}

function Plate({
  name,
  count = 1,
  fresh = false,
  label,
  disabled,
  onInspect,
  onSelect,
}: {
  name: string
  count?: number
  fresh?: boolean
  label: string
  disabled: boolean
  onInspect: () => void
  onSelect: () => void
}) {
  const line = cardLine(name, 0)
  return (
    <button
      type="button"
      className={name.length > 4 ? 'v6-plate is-compact' : 'v6-plate'}
      aria-label={count > 1 ? `${label}，${count} 张` : label}
      disabled={disabled}
      onMouseEnter={onInspect}
      onFocus={onInspect}
      onClick={onSelect}
    >
      <span className="v6-plate__power">{line.power ?? '—'}</span>
      <span className="v6-plate__rule" aria-hidden="true" />
      <span className="v6-plate__name">{name}</span>
      {count > 1 ? <span className="v6-plate__count">×{count}</span> : null}
      {fresh ? <span className="v6-plate__mark">新</span> : null}
    </button>
  )
}
