import { useFrame } from '@react-three/fiber'
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BoxGeometry, Group, MathUtils, Mesh } from 'three'
import { getCardDefinition } from '../../config/cardCatalog'
import type { CardInstance } from '../../game/types'
import { useGameStore } from '../../stores/gameStore'
import { useInteractionStore } from '../../stores/interactionStore'
import { CARD_HEIGHT, CARD_THICKNESS, CARD_WIDTH, Card3D } from './Card3D'
import { STAGE_INTRO, stageNow, stageProgress } from '../environment/stageIntro'

/** World position of the player's draw pile. Draws leave from the top of this stack. */
export const PLAYER_DECK_PILE: [number, number, number] = [-4.75, 0.24, 7.05]

/** Open fan sits in front of the board, in the band above the hand. */
const OPEN_SPACING = 0.84
const OPEN_SCALE = 0.74
const OPEN_TILT = 1.12
const OPEN_LOCAL: [number, number, number] = [3.7, 3.2, 0.2]

const pileHit = new BoxGeometry(CARD_WIDTH + 0.35, 0.42, CARD_HEIGHT + 0.35)
const ignoreRaycast = () => null
const receiveRaycast = Mesh.prototype.raycast

function StagedProp({ position, children }: { position: [number, number, number]; children: ReactNode }) {
  const battleKey = useGameStore((state) => state.battleKey)
  const group = useRef<Group>(null)
  useLayoutEffect(() => {
    group.current?.position.set(position[0] - 3.2, position[1], position[2] + 1.4)
    group.current?.scale.setScalar(0.001)
  }, [position])
  useFrame((state) => {
    if (!group.current) return
    const progress = stageProgress(stageNow(battleKey, state.clock.elapsedTime), STAGE_INTRO.propsStart, STAGE_INTRO.propsDuration)
    group.current.position.x = position[0] + -1 * (1 - progress) * 3.2
    group.current.position.y = position[1] + Math.sin(progress * Math.PI) * 0.42
    group.current.position.z = position[2] + (1 - progress) * 1.4
    group.current.rotation.y = -1 * (1 - progress) * 0.35
    group.current.scale.setScalar(Math.max(0.001, progress))
  })
  return <group ref={group}>{children}</group>
}

function pilePose(index: number, count: number, open: boolean) {
  const depth = count - 1 - index
  if (!open) {
    return {
      x: (index % 3 - 1) * 0.012,
      y: depth * CARD_THICKNESS,
      z: (index % 2) * 0.004,
      rx: 0,
      ry: (index % 5 - 2) * 0.012,
      scale: 1,
    }
  }
  const center = (count - 1) / 2
  const offset = index - center
  return {
    x: OPEN_LOCAL[0] + offset * OPEN_SPACING,
    y: OPEN_LOCAL[1] + (center - Math.abs(offset)) * 0.04,
    z: OPEN_LOCAL[2],
    rx: OPEN_TILT,
    ry: -offset * 0.02,
    scale: OPEN_SCALE,
  }
}

function DeckCard({ card, index, count, open }: { card: CardInstance; index: number; count: number; open: boolean }) {
  const group = useRef<Group>(null)
  const definition = getCardDefinition(card.cardId)

  useFrame((_, delta) => {
    if (!group.current) return
    const pose = pilePose(index, count, open)
    const damping = 1 - Math.exp(-delta * (open ? 8 : 11))
    group.current.position.x = MathUtils.lerp(group.current.position.x, pose.x, damping)
    group.current.position.y = MathUtils.lerp(group.current.position.y, pose.y, damping)
    group.current.position.z = MathUtils.lerp(group.current.position.z, pose.z, damping)
    group.current.rotation.x = MathUtils.lerp(group.current.rotation.x, pose.rx, damping)
    group.current.rotation.y = MathUtils.lerp(group.current.rotation.y, pose.ry, damping)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x || 1, pose.scale, damping))
  })

  return (
    <group ref={group} position={[0, (count - 1 - index) * CARD_THICKNESS, 0]}>
      <Card3D position={[0, 0, 0]} face="hero" card={definition} currentPower={card.currentPower} flipped={!open} silent />
    </group>
  )
}

export function PlayerDeckPile() {
  const deck = useGameStore((state) => state.match?.player.deck ?? [])
  const tactical = useInteractionStore((state) => state.cameraMode === 'overview')
  const [open, setOpen] = useState(false)
  const visibleCount = deck.length
  const fanWidth = Math.max(CARD_WIDTH * OPEN_SCALE, (visibleCount - 1) * OPEN_SPACING + CARD_WIDTH * OPEN_SCALE + 0.4)

  useEffect(() => {
    if (tactical) setOpen(false)
  }, [tactical])

  return (
    <StagedProp position={PLAYER_DECK_PILE}>
      <group visible={!tactical}>
        {deck.map((card, index) => (
          <DeckCard key={card.instanceId} card={card} index={index} count={visibleCount} open={open} />
        ))}
        <mesh
          geometry={pileHit}
          position={open ? OPEN_LOCAL : [0, Math.max(0.08, (visibleCount - 1) * CARD_THICKNESS * 0.5), 0]}
          rotation={open ? [OPEN_TILT, 0, 0] : [0, 0, 0]}
          scale={open ? [fanWidth / (CARD_WIDTH + 0.35), 2.4, (CARD_HEIGHT * OPEN_SCALE + 0.5) / (CARD_HEIGHT + 0.35)] : [1, Math.max(1, visibleCount * 0.45), 1]}
          raycast={tactical || visibleCount === 0 ? ignoreRaycast : receiveRaycast}
          onPointerOver={(event) => {
            event.stopPropagation()
            document.body.style.cursor = 'var(--cursor-interactive)'
          }}
          onPointerOut={() => document.body.style.removeProperty('cursor')}
          onClick={(event) => {
            event.stopPropagation()
            if (!visibleCount) return
            setOpen((current) => !current)
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </StagedProp>
  )
}
