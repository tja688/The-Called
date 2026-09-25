import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Group, MathUtils, Vector3 } from 'three'
import { getCardDefinition } from '../../config/cardCatalog'
import { cellWorldPosition, getCell } from '../../game/core/spatial'
import { landingEase, landingHop } from '../board/landingEase'
import { MONSTER_PENDING } from './tacticalCards'
import type { CameraMode, CardInstance, CellId } from '../../game/types'
import { useGameStore } from '../../stores/gameStore'
import { useInteractionStore } from '../../stores/interactionStore'
import { CARD_THICKNESS, Card3D } from './Card3D'
import { shouldLaunchMonsterCard } from './monsterTelegraphPhase'

const BOARD_ORIGIN: [number, number, number] = [0, -0.1, -0.65]
const SETTLED_LIFT = 0.14
const SETTLED_SCALE = 1.54

const POSE: Record<CameraMode, { position: [number, number, number]; tilt: number; scale: number }> = {
  board: { position: [5.35, 1.68, 0.15], tilt: 1.36, scale: 1.32 },
  hand: { position: [5.35, 1.68, 0.15], tilt: 1.36, scale: 1.32 },
  overview: { position: [MONSTER_PENDING.x, MONSTER_PENDING.y, MONSTER_PENDING.z], tilt: 0.02, scale: MONSTER_PENDING.scale },
}

type Flight = {
  t: number
  from: Vector3
  fromTilt: number
  fromScale: number
  to: Vector3
}

function cellLanding(cellId: CellId, stackDepth: number) {
  const { row, col } = getCell(cellId)
  const [x, , z] = cellWorldPosition(row, col)
  return new Vector3(x + BOARD_ORIGIN[0], BOARD_ORIGIN[1] + SETTLED_LIFT + stackDepth * CARD_THICKNESS, z + BOARD_ORIGIN[2])
}

function stackDepthBeforePlay(cellId: CellId) {
  const cell = useGameStore.getState().match?.board.find((candidate) => candidate.id === cellId)
  return (cell?.coveredCards.length ?? 0) + (cell?.card ? 1 : 0)
}

export function MonsterTelegraphCard() {
  const playing = useGameStore((state) => state.match?.status === 'playing')
  const group = useRef<Group>(null)
  const shards = useRef<Group>(null)
  const phase = useRef<'rest' | 'flying' | 'concealed' | 'assembling'>('rest')
  const flight = useRef<Flight | null>(null)
  const assemble = useRef(1)
  const hold = useRef(0)
  const launchedId = useRef<string | null>(null)
  const shownId = useRef<string | null>(null)
  const [visual, setVisual] = useState<CardInstance | null>(null)
  const [concealed, setConcealed] = useState(false)

  useFrame((_, delta) => {
    const root = group.current
    if (!root) return
    const match = useGameStore.getState().match
    const telegraph = useGameStore.getState().telegraph
    const resolution = useGameStore.getState().resolution
    const cameraMode = useInteractionStore.getState().cameraMode
    const pose = POSE[cameraMode]
    const live = Boolean(match?.status === 'playing' && telegraph)
    const launch = shouldLaunchMonsterCard({
      playing: live,
      turn: match?.turn,
      openingTurn: Boolean(match?.openingTurn),
      resolving: Boolean(resolution),
      phase: phase.current,
      telegraphId: telegraph?.card.instanceId,
      launchedId: launchedId.current,
    })

    if (!launch) hold.current = 0

    if (phase.current === 'flying' && flight.current) {
      const motion = flight.current
      motion.t = Math.min(1, motion.t + delta / 0.62)
      const eased = landingEase(motion.t)
      root.position.lerpVectors(motion.from, motion.to, eased)
      root.position.y += landingHop(motion.t, 0.2)
      root.rotation.x = MathUtils.lerp(motion.fromTilt, 0, eased)
      root.rotation.y = MathUtils.lerp(root.rotation.y, 0, eased)
      root.rotation.z = MathUtils.lerp(root.rotation.z, 0, eased)
      root.scale.setScalar(MathUtils.lerp(motion.fromScale, SETTLED_SCALE, eased))
      if (shards.current) shards.current.scale.setScalar(0.001)
      if (motion.t < 1) return
      flight.current = null
      phase.current = 'concealed'
      root.visible = false
      setConcealed(true)
      useGameStore.getState().playMonsterTurn()
      return
    }

    if (launch && telegraph) {
      if (phase.current === 'concealed' || shownId.current !== telegraph.card.instanceId) {
        phase.current = 'rest'
        shownId.current = telegraph.card.instanceId
        setVisual(telegraph.card)
        setConcealed(false)
        root.visible = true
      }
      hold.current += delta
      const damping = 1 - Math.exp(-delta * 7)
      root.position.x = MathUtils.lerp(root.position.x, pose.position[0], damping)
      root.position.y = MathUtils.lerp(root.position.y, pose.position[1], damping)
      root.position.z = MathUtils.lerp(root.position.z, pose.position[2], damping)
      root.rotation.x = MathUtils.lerp(root.rotation.x, pose.tilt, damping)
      root.scale.setScalar(MathUtils.lerp(root.scale.x || pose.scale, pose.scale, damping))
      if (hold.current < 0.38 || !telegraph.cellId) return
      launchedId.current = telegraph.card.instanceId
      phase.current = 'flying'
      flight.current = {
        t: 0,
        from: root.position.clone(),
        fromTilt: root.rotation.x,
        fromScale: root.scale.x || pose.scale,
        to: cellLanding(telegraph.cellId, stackDepthBeforePlay(telegraph.cellId)),
      }
      return
    }

    if (phase.current === 'concealed') {
      if (cameraMode === 'overview' || !telegraph) return
      phase.current = 'assembling'
      assemble.current = 0
      shownId.current = telegraph.card.instanceId
      setVisual(telegraph.card)
      setConcealed(false)
    } else if (live && telegraph && cameraMode !== 'overview' && shownId.current !== telegraph.card.instanceId && phase.current !== 'flying') {
      phase.current = 'assembling'
      assemble.current = 0
      shownId.current = telegraph.card.instanceId
      setVisual(telegraph.card)
      setConcealed(false)
    }

    if (!visual && !telegraph) return
    const forming = phase.current === 'assembling'
    if (forming) assemble.current = Math.min(1, assemble.current + delta / 0.74)
    const form = forming ? 1 - Math.pow(1 - assemble.current, 3) : 1
    const damping = 1 - Math.exp(-delta * (forming ? 9 : 6.5))
    root.position.x = MathUtils.lerp(root.position.x, pose.position[0], forming ? 1 : damping)
    root.position.y = MathUtils.lerp(root.position.y, pose.position[1], forming ? 1 : damping)
    root.position.z = MathUtils.lerp(root.position.z, pose.position[2], forming ? 1 : damping)
    root.rotation.x = MathUtils.lerp(root.rotation.x, pose.tilt, forming ? 1 : damping)
    root.rotation.y = forming ? (1 - form) * 0.85 : MathUtils.lerp(root.rotation.y, 0, damping)
    root.rotation.z = forming ? (1 - form) * -0.55 : MathUtils.lerp(root.rotation.z, 0, damping)
    const pop = forming ? Math.sin(form * Math.PI) * 0.07 : 0
    const rested = MathUtils.lerp(root.scale.x || pose.scale, pose.scale, damping)
    root.scale.setScalar(forming ? Math.max(0.04, form) * pose.scale * (1 + pop) : rested)
    if (shards.current) {
      shards.current.visible = forming && form < 1
      shards.current.scale.setScalar(forming ? 1 : 0.001)
      shards.current.children.forEach((child, index) => {
        const direction = index % 2 === 0 ? -1 : 1
        const spread = (1 - form) * (0.85 + index * 0.22)
        child.position.set(direction * spread * (index < 2 ? 1 : 0.15), spread * 0.35, (index - 1.5) * spread * 0.45)
        child.rotation.z = direction * (1 - form) * 0.8
      })
    }
    if (forming && assemble.current >= 1) phase.current = 'rest'
  })

  if (!playing) return null
  const definition = visual ? getCardDefinition(visual.cardId) : null
  return (
    <group ref={group} visible={!concealed && Boolean(visual)} position={POSE.board.position} rotation={[POSE.board.tilt, 0, 0]}>
      <group ref={shards}>
        {[0, 1, 2, 3].map((index) => (
          <mesh key={index} raycast={() => null}>
            <boxGeometry args={index < 2 ? [1.15, 0.02, 0.035] : [0.035, 0.02, 1.55]} />
            <meshBasicMaterial color="#efeae0" transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
      {definition && visual && <Card3D position={[0, 0, 0]} face="monster" card={definition} currentPower={visual.currentPower} silent />}
    </group>
  )
}
