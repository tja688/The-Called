import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Group, MathUtils } from 'three'
import { getCardDefinition } from '../../config/cardCatalog'
import { useGameStore } from '../../stores/gameStore'
import { useInteractionStore } from '../../stores/interactionStore'
import { Card3D } from './Card3D'
import { PLAYER_PENDING } from './tacticalCards'

export function SelectedCardPreview() {
  const selectedId = useInteractionStore((state) => state.selectedCardInstanceId)
  const card = useGameStore((state) => state.match?.player.hand.find((item) => item.instanceId === selectedId))
  const group = useRef<Group>(null)

  useLayoutEffect(() => {
    group.current?.position.set(PLAYER_PENDING.x, PLAYER_PENDING.y + 0.2, PLAYER_PENDING.z)
    group.current?.scale.setScalar(PLAYER_PENDING.scale)
  }, [selectedId])

  useFrame((_, delta) => {
    if (!group.current) return
    const damping = 1 - Math.exp(-delta * 8)
    group.current.position.x = MathUtils.lerp(group.current.position.x, PLAYER_PENDING.x, damping)
    group.current.position.y = MathUtils.lerp(group.current.position.y, PLAYER_PENDING.y, damping)
    group.current.position.z = MathUtils.lerp(group.current.position.z, PLAYER_PENDING.z, damping)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, PLAYER_PENDING.scale, damping))
  })

  if (!card) return null
  const definition = getCardDefinition(card.cardId)
  return (
    <group ref={group}>
      <Card3D position={[0, 0, 0]} face="hero" card={definition} currentPower={card.currentPower} silent />
    </group>
  )
}
