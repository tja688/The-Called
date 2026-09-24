import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BoxGeometry, Group, MathUtils, Mesh } from 'three'
import { playCardFlip, playCardSelect } from '../../audio/gameAudio'
import { getCardDefinition } from '../../config/cardCatalog'
import type { CameraMode, CardInstance } from '../../game/types'
import { useGameStore } from '../../stores/gameStore'
import { useInteractionStore } from '../../stores/interactionStore'
import { usePresentationStore } from '../../stores/presentationStore'
import { CARD_HEIGHT, CARD_THICKNESS, CARD_WIDTH, Card3D } from './Card3D'
import { STAGE_INTRO, stageProgress } from '../environment/stageIntro'

const HAND_PIVOT_Z = 4.45
const HAND_FOREGROUND_OFFSET = 4.1
const HAND_POSTURES: Record<CameraMode, { tilt: number; lift: number; z: number }> = {
  board: { tilt: 0, lift: 0.68, z: 0 }, hand: { tilt: 0.08, lift: 0.92, z: -0.08 }, overview: { tilt: 0, lift: 0, z: 0 },
}
const CARD_TILTS: Record<CameraMode, number> = { board: 1.12, hand: 1.2, overview: 0 }
const handHitGeometry = new BoxGeometry(CARD_WIDTH, CARD_THICKNESS, CARD_HEIGHT)
const ignoreRaycast = () => null
const receiveRaycast = Mesh.prototype.raycast

function getPose(index: number, count: number) {
  const center = (count - 1) / 2
  const offset = index - center
  return { x: offset * 0.82, y: 0.46 + (center - Math.abs(offset)) * 0.035, z: 4.08 + index * 0.095, rotation: -offset * 0.105 }
}

function HandCard({ card, index, count, hoveredIndex, cameraMode, flipped, drawn, onHover, onSelect }: {
  card: CardInstance
  index: number
  count: number
  hoveredIndex: number | null
  cameraMode: CameraMode
  flipped: boolean
  drawn: boolean
  onHover: (index: number | null) => void
  onSelect: (instanceId: string) => void
}) {
  const root = useRef<Group>(null)
  const visual = useRef<Group>(null)
  const hoverProgress = useRef(0)
  const drawProgress = useRef(drawn ? 0 : 1)
  const introFinished = useRef(false)
  const pose = getPose(index, count)
  const definition = getCardDefinition(card.cardId)
  const restZ = pose.z + HAND_FOREGROUND_OFFSET - HAND_PIVOT_Z

  useLayoutEffect(() => {
    root.current?.position.set(drawn ? -4.75 : pose.x, drawn ? -0.44 : pose.y, drawn ? 2.6 : restZ)
    root.current?.rotation.set(drawn ? 0 : CARD_TILTS.board, drawn ? 0.02 : pose.rotation, 0)
    root.current?.scale.setScalar(drawn ? 1 : 0.9)
    visual.current?.position.set(0, 0, 0)
    visual.current?.rotation.set(0, 0, 0)
    visual.current?.scale.setScalar(1)
  }, [drawn, pose.x, pose.y, pose.rotation, restZ])

  useFrame((state, delta) => {
    if (!root.current || !visual.current) return
    const intro = stageProgress(state.clock.elapsedTime, STAGE_INTRO.handStart + index * STAGE_INTRO.handStep, STAGE_INTRO.handCardDuration)
    if (!introFinished.current) {
      const wave = Math.sin(intro * Math.PI) * (0.55 + index * 0.025)
      root.current.position.x = MathUtils.lerp(-4.6, pose.x, intro)
      root.current.position.y = MathUtils.lerp(-1.15, pose.y, intro) + wave
      root.current.position.z = MathUtils.lerp(3.25, restZ, intro)
      root.current.rotation.x = MathUtils.lerp(0.35, CARD_TILTS[cameraMode], intro)
      root.current.rotation.y = MathUtils.lerp(0.42, pose.rotation, intro)
      root.current.scale.setScalar(Math.max(0.001, intro * 0.9))
      visual.current.position.set(0, 0, 0)
      visual.current.rotation.set(0, 0, 0)
      visual.current.scale.setScalar(1)
      introFinished.current = intro >= 1
      if (!introFinished.current) return
    }
    const settled = drawProgress.current >= 1
    const isHovered = settled && hoveredIndex === index && cameraMode !== 'overview'
    hoverProgress.current = MathUtils.lerp(hoverProgress.current, isHovered ? 1 : 0, 1 - Math.exp(-delta * 6))
    const lift = MathUtils.smoothstep(hoverProgress.current, 0, 0.8)
    const front = MathUtils.smoothstep(hoverProgress.current, 0.6, 1)
    if (drawn && drawProgress.current < 1 && cameraMode !== 'overview') drawProgress.current = Math.min(1, drawProgress.current + delta / 0.78)
    const travel = 0.5 - Math.cos(drawProgress.current * Math.PI) / 2
    root.current.position.x = MathUtils.lerp(-4.75, pose.x, travel)
    root.current.position.y = MathUtils.lerp(-0.44, pose.y, travel) + (settled ? 0 : Math.sin(drawProgress.current * Math.PI) * 0.72)
    root.current.position.z = MathUtils.lerp(2.6, restZ, travel)
    root.current.rotation.x = MathUtils.lerp(0, CARD_TILTS[cameraMode], travel)
    root.current.rotation.y = MathUtils.lerp(0.02, pose.rotation, travel)
    root.current.scale.setScalar(MathUtils.lerp(1, 0.9, travel))
    visual.current.position.set(0, 1.35 * lift, (4.72 - pose.z) * front)
    visual.current.rotation.set(0, pose.rotation * (MathUtils.lerp(1, 0.28, lift) - 1), 0)
    visual.current.scale.setScalar(MathUtils.lerp(1, 1 / 0.9, lift))
  })

  const interactive = cameraMode !== 'overview'
  return (
    <group ref={root}>
      <mesh
        geometry={handHitGeometry}
        raycast={interactive ? receiveRaycast : ignoreRaycast}
        onPointerOver={(event) => {
          if (!interactive) return
          event.stopPropagation()
          onHover(index)
          document.body.style.cursor = 'var(--cursor-interactive)'
        }}
        onPointerOut={() => {
          onHover(null)
          document.body.style.removeProperty('cursor')
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (!interactive) return
          onSelect(card.instanceId)
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={visual}>
        <Card3D position={[0, 0, 0]} face="hero" card={definition} currentPower={card.currentPower} flipped={flipped} silent />
      </group>
    </group>
  )
}

export function Hand3D() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [flippedCards, setFlippedCards] = useState<Set<string>>(() => new Set())
  const cards = useGameStore((state) => state.match?.player.hand ?? [])
  const knownCards = useRef<Set<string>>(new Set())
  const [drawnCards, setDrawnCards] = useState<Set<string>>(() => new Set())
  const canPlayMatch = useGameStore((state) => state.match?.turn === 'player' && state.match.status === 'playing' && !state.match.openingTurn)
  const inputLocked = usePresentationStore((state) => state.inputLocked)
  const introReady = useRef(false)
  const cameraMode = useInteractionStore((state) => state.cameraMode)
  const beginCardPlacement = useInteractionStore((state) => state.beginCardPlacement)
  const handRig = useRef<Group>(null)

  useEffect(() => {
    if (!cards.length) return
    if (!knownCards.current.size) {
      knownCards.current = new Set(cards.map((card) => card.instanceId))
      return
    }
    const additions = cards.filter((card) => !knownCards.current.has(card.instanceId))
    cards.forEach((card) => knownCards.current.add(card.instanceId))
    if (additions.length) setDrawnCards((current) => new Set([...current, ...additions.map((card) => card.instanceId)]))
  }, [cards])

  useFrame((state, delta) => {
    if (!handRig.current) return
    introReady.current = state.clock.elapsedTime >= STAGE_INTRO.complete
    const posture = HAND_POSTURES[cameraMode]
    const damping = 1 - Math.exp(-delta * 5.2)
    handRig.current.rotation.x = MathUtils.lerp(handRig.current.rotation.x, posture.tilt, damping)
    handRig.current.position.y = MathUtils.lerp(handRig.current.position.y, posture.lift, damping)
    handRig.current.position.z = MathUtils.lerp(handRig.current.position.z, HAND_PIVOT_Z + posture.z, damping)
  })

  useEffect(() => {
    if (cameraMode === 'overview') setHoveredIndex(null)
  }, [cameraMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyR' || event.repeat || hoveredIndex === null || cameraMode === 'overview') return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      const card = cards[hoveredIndex]
      if (!card) return
      event.preventDefault()
      playCardFlip()
      setFlippedCards((current) => {
        const next = new Set(current)
        if (next.has(card.instanceId)) next.delete(card.instanceId)
        else next.add(card.instanceId)
        return next
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cameraMode, cards, hoveredIndex])

  if (!cards.length) return null
  return (
    <group ref={handRig} position={[0, HAND_POSTURES.board.lift, HAND_PIVOT_Z]}>
      {cards.map((card, index) => (
        <HandCard
          key={card.instanceId}
          card={card}
          index={index}
          count={cards.length}
          hoveredIndex={hoveredIndex}
          cameraMode={cameraMode}
          flipped={flippedCards.has(card.instanceId)}
          drawn={drawnCards.has(card.instanceId)}
          onHover={(next) => {
            if (!canPlayMatch || !introReady.current || inputLocked) return
            setHoveredIndex((current) => (next === null && current !== index ? current : next))
          }}
          onSelect={(instanceId) => {
            if (!canPlayMatch || !introReady.current || inputLocked) return
            playCardSelect()
            beginCardPlacement(instanceId)
            setHoveredIndex(null)
          }}
        />
      ))}
    </group>
  )
}
