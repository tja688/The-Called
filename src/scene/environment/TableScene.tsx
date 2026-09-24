import { Board } from '../board/Board'
import { CARD_THICKNESS, Card3D } from '../cards/Card3D'
import { Hand3D } from '../cards/Hand3D'
import { MonsterTelegraphCard } from '../cards/MonsterTelegraphCard'
import { SelectedCardPreview } from '../cards/SelectedCardPreview'
import { useFrame } from '@react-three/fiber'
import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { Group, MathUtils } from 'three'
import { useInteractionStore } from '../../stores/interactionStore'
import { PerspectiveGrid } from './PerspectiveGrid'
import type { MonsterConfig, SceneConfig } from '../../config/gameContent'
import { useGameStore } from '../../stores/gameStore'
import { BONE, VOID } from '../presentation/palette'
import { STAGE_INTRO, stageProgress } from './stageIntro'

function Ring({ radius, y = 0 }: { radius: number; y?: number }) {
  return (
      <mesh position={[0, y, 0]} raycast={() => null}>
      <ringGeometry args={[radius * 0.94, radius, 80]} />
      <meshBasicMaterial color={BONE} side={2} />
    </mesh>
  )
}

const FLOOR_SURFACE_Y = -0.2

const MAX_VISIBLE_PILE_CARDS = 9

function StagedProp({ position, side, children }: { position: [number, number, number]; side: -1 | 1; children: ReactNode }) {
  const group = useRef<Group>(null)
  useLayoutEffect(() => {
    if (!group.current) return
    group.current.position.set(position[0] + side * 3.2, position[1], position[2] + 1.4)
    group.current.scale.setScalar(0.001)
  }, [])
  useFrame((state) => {
    if (!group.current) return
    const progress = stageProgress(state.clock.elapsedTime, STAGE_INTRO.propsStart, STAGE_INTRO.propsDuration)
    group.current.position.x = position[0] + side * (1 - progress) * 3.2
    group.current.position.y = position[1] + Math.sin(progress * Math.PI) * 0.42
    group.current.position.z = position[2] + (1 - progress) * 1.4
    group.current.rotation.y = side * (1 - progress) * 0.35
    group.current.scale.setScalar(Math.max(0.001, progress))
  })
  return <group ref={group} position={position}>{children}</group>
}

function DrawPile({ position, count }: { position: [number, number, number]; count: number }) {
  const visibleCount = Math.min(count, MAX_VISIBLE_PILE_CARDS)
  return (
    <StagedProp position={position} side={-1}>
      {Array.from({ length: visibleCount }, (_, index) => (
        <Card3D
          key={index}
          position={[0, index * CARD_THICKNESS, 0]}
          rotation={[0, (index % 3 - 1) * 0.004, 0]}
          face="hero"
          flipped
          silent
        />
      ))}
    </StagedProp>
  )
}

function EmptyPile({ position }: { position: [number, number, number] }) {
  return (
    <StagedProp position={position} side={1}>
      <Card3D position={[0, 0, 0]} face="hero" flipped silent />
    </StagedProp>
  )
}

function OpponentMark({ config, tactical }: { config: MonsterConfig; tactical: boolean }) {
  const group = useRef<Group>(null)
  const radius = config.visual.height * 0.22
  const rings = config.id === 'moon'
    ? [{ radius, y: 0 }, { radius: radius * 0.72, y: radius * 0.28 }]
    : config.id === 'rahu-ketu'
      ? [{ radius: radius * 0.62, y: radius * 0.7 }, { radius: radius * 0.62, y: -radius * 0.7 }]
      : [{ radius, y: 0 }, { radius: radius * 0.62, y: radius * 0.28 }]
  const initialScale = config.visual.scale
  const initialZ = -config.visual.distance

  useLayoutEffect(() => {
    if (!group.current) return
    group.current.visible = false
    group.current.position.z = initialZ - 12
  }, [initialZ])

  useFrame((state, delta) => {
    if (!group.current) return
    const progress = stageProgress(state.clock.elapsedTime, STAGE_INTRO.monsterStart, STAGE_INTRO.monsterDuration)
    const damping = 1 - Math.exp(-delta * 3.6)
    const targetZ = -(tactical ? config.visual.tacticalDistance : config.visual.distance)
    const targetScale = tactical ? config.visual.tacticalScale : config.visual.scale
    group.current.position.z = MathUtils.lerp(group.current.position.z, targetZ - (1 - progress) * 12, damping)
    const scale = MathUtils.lerp(group.current.scale.x || 0.001, targetScale * Math.max(progress, 0.001), damping)
    group.current.position.y = FLOOR_SURFACE_Y + radius * scale
    group.current.scale.setScalar(Math.max(0.001, scale))
    group.current.visible = progress > 0
  })

  return (
    <group ref={group} position={[0, FLOOR_SURFACE_Y + radius * initialScale, initialZ]} scale={initialScale}>
      {rings.map((item) => (
        <Ring key={`${item.radius}-${item.y}`} radius={item.radius} y={item.y} />
      ))}
    </group>
  )
}

export function TableScene({ monster, scene }: { monster: MonsterConfig; scene: SceneConfig }) {
  const cameraMode = useInteractionStore((state) => state.cameraMode)
  const deckCount = useGameStore((state) => state.match?.player.deck.length ?? 0)
  const tactical = cameraMode === 'overview'

  return (
    <>
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={[VOID, scene.fog.near, scene.fog.far]} />
      <ambientLight intensity={1} />

      <OpponentMark config={monster} tactical={tactical} />
      <MonsterTelegraphCard />
      <PerspectiveGrid />
      <Board />
      <Hand3D />
      {tactical && <SelectedCardPreview />}
      {!tactical && <DrawPile position={[-4.75, 0.24, 7.05]} count={deckCount} />}
      {!tactical && <EmptyPile position={[4.75, 0.24, 7.05]} />}
    </>
  )
}
