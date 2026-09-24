import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Group, MathUtils } from 'three'
import { getCardDefinition } from '../../config/cardCatalog'
import { useGameStore } from '../../stores/gameStore'
import { useInteractionStore } from '../../stores/interactionStore'
import { Card3D } from './Card3D'

export function SelectedCardPreview() {
  const selectedId = useInteractionStore((state) => state.selectedCardInstanceId)
  const card = useGameStore((state) => state.match?.player.hand.find((item) => item.instanceId === selectedId))
  const group = useRef<Group>(null)

  useLayoutEffect(() => {
    group.current?.position.set(4.7, 0.55, -0.65)
    group.current?.scale.setScalar(1.18)
  }, [selectedId])

  useFrame((_, delta) => {
    if (!group.current) return
    const damping = 1 - Math.exp(-delta * 8)
    group.current.position.x = MathUtils.lerp(group.current.position.x, 4.15, damping)
    group.current.position.y = MathUtils.lerp(group.current.position.y, 0.28, damping)
    group.current.position.z = MathUtils.lerp(group.current.position.z, -0.65, damping)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, 1.2, damping))
  })

  if (!card) return null
  const definition = getCardDefinition(card.cardId)
  return (
    <group ref={group}>
      <Card3D position={[0, 0, 0]} face="hero" card={definition} currentPower={card.currentPower} silent />
    </group>
  )
}
