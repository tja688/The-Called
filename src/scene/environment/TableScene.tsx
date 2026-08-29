import { Board } from '../board/Board'
import { CARD_THICKNESS, Card3D } from '../cards/Card3D'
import { Hand3D } from '../cards/Hand3D'
import { SelectedCardPreview } from '../cards/SelectedCardPreview'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { Group, MathUtils, MeshBasicMaterial, SRGBColorSpace } from 'three'
import { useInteractionStore } from '../../stores/interactionStore'
import { PerspectiveGrid } from './PerspectiveGrid'
import type { MonsterConfig, SceneConfig } from '../../config/gameContent'
import { useGameStore } from '../../stores/gameStore'
import { STAGE_INTRO, stageProgress } from './stageIntro'

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
        />
      ))}
    </StagedProp>
  )
}

function EmptyPile({ position }: { position: [number, number, number] }) {
  return (
    <StagedProp position={position} side={1}>
      <Card3D position={[0, 0, 0]} face="hero" flipped backArt="/card/Hero-back-gray.png" />
    </StagedProp>
  )
}

function Monster({ config, tactical }: { config: MonsterConfig; tactical: boolean }) {
  const monster = useTexture(config.image)
  const group = useRef<Group>(null)
  const material = useRef<MeshBasicMaterial>(null)
  monster.colorSpace = SRGBColorSpace
  const aspectRatio = monster.image.width / monster.image.height
  const width = config.visual.height * aspectRatio
  const initialScale = config.visual.scale
  const initialZ = -config.visual.distance

  useLayoutEffect(() => {
    if (!group.current) return
    group.current.visible = false
    group.current.position.z = initialZ - 18
  }, [])

  useFrame((_, delta) => {
    if (!group.current) return
    const damping = 1 - Math.exp(-delta * 3.6)
    group.current.position.z = MathUtils.lerp(
      group.current.position.z,
      -(tactical ? config.visual.tacticalDistance : config.visual.distance),
      damping,
    )
    const targetScale = tactical ? config.visual.tacticalScale : config.visual.scale
    const scale = MathUtils.lerp(group.current.scale.x, targetScale, damping)
    group.current.position.y = FLOOR_SURFACE_Y + (config.visual.height / 2) * scale
    group.current.scale.setScalar(scale)
  })

  useFrame((state) => {
    if (!group.current || !material.current) return
    const progress = stageProgress(state.clock.elapsedTime, STAGE_INTRO.monsterStart, STAGE_INTRO.monsterDuration)
    const targetZ = -(tactical ? config.visual.tacticalDistance : config.visual.distance)
    const brightness = MathUtils.lerp(0.025, 1, progress)
    group.current.position.z = targetZ - (1 - progress) * 18
    group.current.position.y = FLOOR_SURFACE_Y + (config.visual.height / 2) * group.current.scale.x
    group.current.rotation.z = 0
    group.current.visible = progress > 0
    material.current.color.setRGB(brightness, brightness, brightness)
    material.current.opacity = MathUtils.lerp(0.12, 1, progress)
  })

  return (
    <group
      ref={group}
      position={[0, FLOOR_SURFACE_Y + (config.visual.height / 2) * initialScale, initialZ]}
      scale={initialScale}
    >
      <mesh>
        <planeGeometry args={[width, config.visual.height]} />
        <meshBasicMaterial ref={material} map={monster} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

export function TableScene({ monster, scene }: { monster: MonsterConfig; scene: SceneConfig }) {
  const cameraMode = useInteractionStore((state) => state.cameraMode)
  const deckCount = useGameStore((state) => state.match?.player.deck.length ?? 0)
  const tactical = cameraMode === 'overview'

  return (
    <>
      <color attach="background" args={[scene.background]} />
      <fog attach="fog" args={[scene.fog.color, scene.fog.near, scene.fog.far]} />
      <ambientLight intensity={scene.ambientLightIntensity} />

      <Monster config={monster} tactical={tactical} />
      <PerspectiveGrid />
      <Board />
      <Hand3D />
      {tactical && <SelectedCardPreview />}
      {!tactical && <DrawPile position={[-4.75, 0.24, 7.05]} count={deckCount} />}
      {!tactical && <EmptyPile position={[4.75, 0.24, 7.05]} />}
    </>
  )
}
