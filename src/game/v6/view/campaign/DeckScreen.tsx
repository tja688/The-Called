import { useEffect, useState } from 'react'
import type { CampaignState } from '../../meta'
import { commitDeckEdit, replaceInDeck, viewDeckEditor } from './deck'
import './campaign.css'

export function DeckScreen({
  campaign,
  onCampaign,
}: {
  campaign: CampaignState
  onCampaign: (state: CampaignState) => void
}) {
  const view = viewDeckEditor(campaign)
  const [draft, setDraft] = useState<string[]>(() => [...campaign.deck])
  const [boxPick, setBoxPick] = useState<number | null>(null)
  const [deckPick, setDeckPick] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(view.battleLock)

  useEffect(() => {
    setDraft([...campaign.deck])
    setBoxPick(null)
    setDeckPick(null)
    setMessage(view.battleLock)
  }, [campaign, view.battleLock])

  const swap = () => {
    if (!view.editable || boxPick === null || deckPick === null) return
    const cardName = campaign.box[boxPick]
    if (!cardName) return
    setDraft(replaceInDeck(draft, deckPick, cardName))
    setMessage(null)
  }

  const save = () => {
    if (!view.editable) return
    const outcome = commitDeckEdit(campaign, draft)
    if (!outcome.ok) {
      setMessage(outcome.message)
      return
    }
    setMessage(null)
    onCampaign(outcome.state)
  }

  return (
    <section className="v6-campaign" aria-label="构筑">
      <h2>构筑</h2>
      <p className="v6-campaign__notice">{view.scienceNotice}</p>
      <p className="v6-campaign__gold">金币 {view.gold}</p>
      {view.battleLock ? <p className="v6-campaign__status">{view.battleLock}</p> : null}
      {message && message !== view.battleLock ? <p className="v6-campaign__status">{message}</p> : null}

      <h3>卡盒</h3>
      <ul className="v6-campaign__list">
        {view.box.map((line) => (
          <li key={`box-${line.name}-${line.index}`}>
            <button
              type="button"
              className="v6-campaign__pick"
              aria-pressed={boxPick === line.index}
              disabled={!view.editable}
              onClick={() => setBoxPick(line.index)}
            >
              <CardFace line={line} />
            </button>
          </li>
        ))}
      </ul>

      <h3>牌组</h3>
      <ul className="v6-campaign__list">
        {draft.map((name, index) => (
          <li key={`deck-${name}-${index}`}>
            <button
              type="button"
              className="v6-campaign__pick"
              aria-pressed={deckPick === index}
              disabled={!view.editable}
              onClick={() => setDeckPick(index)}
            >
              <span className="v6-campaign__name">{index + 1}. {name}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="v6-campaign__actions">
        <button type="button" disabled={!view.editable || boxPick === null || deckPick === null} onClick={swap}>
          替换
        </button>
        <button type="button" disabled={!view.editable} onClick={save}>
          保存
        </button>
      </div>
    </section>
  )
}

function CardFace({ line }: { line: { name: string; rarityLabel: string; power: number | null; effectText: string } }) {
  return (
    <>
      <span className="v6-campaign__name">{line.name}</span>
      {line.rarityLabel ? <span className="v6-campaign__meta">{line.rarityLabel}</span> : null}
      {line.power !== null ? <span className="v6-campaign__meta">点数 {line.power}</span> : null}
      {line.effectText ? <span className="v6-campaign__effect">{line.effectText}</span> : null}
    </>
  )
}
