import { getCardDefinition } from '../../config/cardCatalog'
import { useGameStore } from '../../stores/gameStore'
import { Card3D } from './Card3D'

export function MonsterTelegraphCard() {
  const telegraph = useGameStore((state) => state.telegraph)
  if (!telegraph) return null
  const definition = getCardDefinition(telegraph.card.cardId)
  return (
    <group position={[4.05, 0.36, -1.15]} scale={1.45}>
      <Card3D position={[0, 0, 0]} face="monster" card={definition} currentPower={telegraph.card.currentPower} silent />
    </group>
  )
}
