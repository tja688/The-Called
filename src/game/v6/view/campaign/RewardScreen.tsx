import { useState } from 'react'
import type { CampaignState, FinishBattleResult } from '../../meta'
import { cardLine } from './cards'
import { includeReward, rewardView } from './reward'
import './campaign.css'

export function RewardScreen({
  result,
  monsterId,
  goldBefore,
  campaign,
  onCampaign,
}: {
  result: FinishBattleResult
  monsterId: string
  goldBefore: number
  campaign: CampaignState
  onCampaign: (state: CampaignState) => void
}) {
  const view = rewardView(result, monsterId, goldBefore)
  const [slot, setSlot] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const pending = [...campaign.pendingRewardNames]

  const decide = (cardName: string, replaceIndex: number | null) => {
    const outcome = includeReward(campaign, cardName, replaceIndex)
    if (!outcome.ok) {
      setMessage(outcome.message)
      return
    }
    setMessage(null)
    onCampaign(outcome.state)
  }

  return (
    <section className="v6-campaign" aria-label="战斗奖励">
      <h2>战斗奖励</h2>
      <p className="v6-campaign__gold">{view.goldText}</p>
      {view.hugeCardBackNotice ? <p className="v6-campaign__notice">{view.hugeCardBackNotice}</p> : null}
      {message ? <p className="v6-campaign__status">{message}</p> : null}

      <h3>收入卡盒</h3>
      <ul className="v6-campaign__list">
        {view.includable.map((name, index) => {
          const line = cardLine(name, index)
          const stillPending = pending.indexOf(name)
          if (stillPending >= 0) pending.splice(stillPending, 1)
          return (
            <li key={`${name}-${index}`} className="v6-campaign__card">
              <span className="v6-campaign__name">{line.name}</span>
              {line.rarityLabel ? <span className="v6-campaign__meta">{line.rarityLabel}</span> : null}
              {line.power !== null ? <span className="v6-campaign__meta">点数 {line.power}</span> : null}
              {line.effectText ? <span className="v6-campaign__effect">{line.effectText}</span> : null}
              {stillPending >= 0 ? (
                <span className="v6-campaign__actions">
                  <button type="button" disabled={slot === null} onClick={() => decide(name, slot)}>
                    替换
                  </button>
                  <button type="button" onClick={() => decide(name, null)}>
                    跳过
                  </button>
                </span>
              ) : (
                <span className="v6-campaign__done">已决定</span>
              )}
            </li>
          )
        })}
      </ul>

      <h3>选择要换下的牌</h3>
      <ul className="v6-campaign__list">
        {campaign.deck.map((name, index) => (
          <li key={`${name}-${index}`}>
            <button
              type="button"
              className="v6-campaign__pick"
              aria-pressed={slot === index}
              onClick={() => setSlot(index)}
            >
              <span className="v6-campaign__name">{index + 1}. {name}</span>
            </button>
          </li>
        ))}
      </ul>

      {view.rejected.length > 0 ? (
        <>
          <h3>没有收入卡盒</h3>
          <ul className="v6-campaign__list">
            {view.rejected.map((item) => (
              <li key={item.text} className="v6-campaign__reject">{item.text}</li>
            ))}
          </ul>
        </>
      ) : null}

      {view.notices.map((notice) => (
        <p key={notice} className="v6-campaign__status">{notice}</p>
      ))}
    </section>
  )
}
