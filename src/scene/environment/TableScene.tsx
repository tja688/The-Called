import { Board } from '../board/Board'
import { Hand3D } from '../cards/Hand3D'
import { MonsterTelegraphCard } from '../cards/MonsterTelegraphCard'
import { PlayerDeckPile } from '../cards/PlayerDeckPile'
import { SelectedCardPreview } from '../cards/SelectedCardPreview'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Group, MathUtils } from 'three'
import { useInteractionStore } from '../../stores/interactionStore'
import { PerspectiveGrid } from './PerspectiveGrid'
import { StageAtmosphere } from './StageAtmosphere'
import type { MonsterConfig, SceneConfig } from '../../config/gameContent'
import { useGameStore } from '../../stores/gameStore'
import { BONE, VOID } from '../presentation/palette'
import { STAGE_INTRO, stageNow, stageProgress } from './stageIntro'

function Ring({ radius, x = 0, y = 0, tube = 0.06 }: { radius: number; x?: number; y?: number; tube?: number }) {
  return (
    <mesh position={[x, y, 0]} raycast={() => null}>
      <ringGeometry args={[Math.max(0.02, radius - tube), radius, 80]} />
      <meshBasicMaterial color={BONE} side={2} />
    </mesh>
  )
}

const FLOOR_SURFACE_Y = -0.2

function OpponentMark({ config, tactical }: { config: MonsterConfig; tactical: boolean }) {
  const battleKey = useGameStore((state) => state.battleKey)
  const group = useRef<Group>(null)
  const radius = config.visual.height * 0.22
  const rings = config.id === 'moon'
    ? [
        { radius: radius * 1.15, x: 0, y: 0, tube: radius * 0.035 },
        { radius: radius * 0.72, x: radius * 0.38, y: 0, tube: radius * 0.5 },
        { radius: radius * 0.22, x: -radius * 0.55, y: radius * 0.35, tube: radius * 0.02 },
      ]
    : config.id === 'rahu-ketu'
      ? [
          { radius: radius * 0.48, x: -radius * 0.72, y: radius * 0.42, tube: radius * 0.045 },
          { radius: radius * 0.48, x: radius * 0.72, y: -radius * 0.42, tube: radius * 0.045 },
          { radius: radius * 0.2, x: -radius * 0.72, y: radius * 0.42, tube: radius * 0.02 },
          { radius: radius * 0.2, x: radius * 0.72, y: -radius * 0.42, tube: radius * 0.02 },
        ]
      : [
          { radius, x: 0, y: 0, tube: radius * 0.06 },
          { radius: radius * 0.62, x: 0, y: radius * 0.28, tube: radius * 0.04 },
        ]
  const initialScale = config.visual.scale
  const initialZ = -config.visual.distance

  useLayoutEffect(() => {
    if (!group.current) return
    group.current.visible = false
    group.current.position.z = initialZ - 12
  }, [battleKey, initialZ])

  useFrame((state, delta) => {
    if (!group.current) return
    const progress = stageProgress(stageNow(battleKey, state.clock.elapsedTime), STAGE_INTRO.monsterStart, STAGE_INTRO.monsterDuration)
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
        <Ring key={`${item.x}-${item.y}-${item.radius}`} radius={item.radius} x={item.x} y={item.y} tube={item.tube} />
      ))}
      {config.id === 'rahu-ketu' && (
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0.55]} raycast={() => null}>
          <planeGeometry args={[radius * 1.35, radius * 0.035]} />
          <meshBasicMaterial color={BONE} />
        </mesh>
      )}
    </group>
  )
}

export function TableScene({ monster, scene }: { monster: MonsterConfig; scene: SceneConfig }) {
  const cameraMode = useInteractionStore((state) => state.cameraMode)
  const tactical = cameraMode === 'overview'

  return (
    <>
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={[VOID, scene.fog.near, scene.fog.far]} />
      <ambientLight intensity={1} />

      <OpponentMark config={monster} tactical={tactical} />
      <MonsterTelegraphCard />
      <StageAtmosphere monsterId={monster.id} />
      <PerspectiveGrid />
      <Board />
      <Hand3D />
      {tactical && <SelectedCardPreview />}
      <PlayerDeckPile />
    </>
  )
}
