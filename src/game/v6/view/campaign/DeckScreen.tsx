import type { CampaignState } from '../../meta'
import { viewDeckEditor } from './deck'
import { DeckOrganizer } from './DeckOrganizer'

export function DeckScreen({
  campaign,
  onCampaign,
  onBack,
}: {
  campaign: CampaignState
  onCampaign: (state: CampaignState) => void
  onBack?: () => void
}) {
  const view = viewDeckEditor(campaign)
  return (
    <DeckOrganizer
      campaign={campaign}
      onCampaign={onCampaign}
      mode="deck"
      leads={[view.scienceNotice, `金币 ${view.gold}`]}
      alerts={view.battleLock ? [view.battleLock] : []}
      onBack={onBack}
    />
  )
}
