import type { CampaignState, FinishBattleResult } from '../../meta'
import { DeckOrganizer } from './DeckOrganizer'
import { rewardView } from './reward'

export function RewardScreen({
  result,
  monsterId,
  goldBefore,
  campaign,
  onCampaign,
  arrival,
  onDone,
}: {
  result: FinishBattleResult
  monsterId: string
  goldBefore: number
  campaign: CampaignState
  onCampaign: (state: CampaignState) => void
  arrival?: string | null
  onDone: () => void
}) {
  const view = rewardView(result, monsterId, goldBefore)
  const leads = [view.goldText, arrival, view.hugeCardBackNotice, ...view.notices].filter(
    (line): line is string => Boolean(line),
  )

  return (
    <DeckOrganizer
      campaign={campaign}
      onCampaign={onCampaign}
      mode="reward"
      leads={leads}
      rejected={view.rejected.map((item) => item.text)}
      onDone={onDone}
    />
  )
}
