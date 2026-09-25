import { getCardDefinition } from '../config/cardCatalog'

export const CARD_REWARD_HINT = '获得的卡牌可以在牌组中组建卡组'

export function CardRewardDialog({
  cardIds,
  onConfirm,
}: {
  cardIds: readonly string[]
  onConfirm: () => void
}) {
  return (
    <div className="card-reward" role="dialog" aria-modal="true" aria-label="获得卡牌">
      <div className="card-reward__panel">
        <ul className="card-reward__cards">
          {cardIds.map((cardId, index) => {
            const card = getCardDefinition(cardId)
            return (
              <li key={`${cardId}-${index}`} className="deck-card card-reward__card">
                <span className="deck-card__power">{card.power}</span>
                <span className="deck-card__rule" aria-hidden="true" />
                <span className={`deck-card__name${card.name.length > 4 ? ' is-compact' : ''}`}>{card.name}</span>
                <span className="card-reward__description">{card.description}</span>
              </li>
            )
          })}
        </ul>
        <p className="card-reward__hint">{CARD_REWARD_HINT}</p>
        <button type="button" onClick={onConfirm}>OK</button>
      </div>
    </div>
  )
}
