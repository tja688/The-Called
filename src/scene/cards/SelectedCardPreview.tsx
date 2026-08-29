import { Html } from '@react-three/drei'
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
    group.current?.position.set(5.35, 0.28, -0.65)
    group.current?.scale.setScalar(1.18)
  }, [selectedId])

  useFrame((_, delta) => {
    if (!group.current) return
    const damping = 1 - Math.exp(-delta * 8)
    group.current.position.x = MathUtils.lerp(group.current.position.x, 4.35, damping)
    group.current.position.y = MathUtils.lerp(group.current.position.y, 0.28, damping)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, 1.46, damping))
  })

  if (!card) return null
  const definition = getCardDefinition(card.cardId)
  return (
    <group ref={group}>
      <Card3D position={[0, 0, 0]} accent="#7b9ca8" face="hero" card={definition} currentPower={card.currentPower} />
      <Html position={[0, 0.12, -1.02]} center style={{ pointerEvents: 'none' }}>
        <div className="card-flip-hint selected-card-hint"><span>当前选牌</span></div>
      </Html>
    </group>
  )
}
