import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEPART_FADE_MS, POWER_COUNT_MS } from './resolutionBeat'
import { usePresentationStore } from '../../stores/presentationStore'
import { BoxGeometry, Group, MathUtils } from 'three'
import { getCardDefinition } from '../../config/cardCatalog'
import { canPlaceCard } from '../../game/core/matchEngine'
import type { CardInstance, CellId } from '../../game/types'
import { useGameStore } from '../../stores/gameStore'
import { useInteractionStore } from '../../stores/interactionStore'
import { CARD_ASPECT_RATIO, CARD_THICKNESS, Card3D } from '../cards/Card3D'
import { BONE, CLAY } from '../presentation/palette'
import { STAGE_INTRO } from '../environment/stageIntro'

const CELL_WIDTH = 2.02
const CELL_HEIGHT = CELL_WIDTH * CARD_ASPECT_RATIO
const cellFrame = new BoxGeometry(CELL_WIDTH, 0.02, CELL_HEIGHT)

function PlacedCard({ card, flipped, cellPosition, stackDepth, animate, shownPower, opacity = 1, onSettled }: {
  card: CardInstance
  flipped: boolean
  cellPosition: readonly [number, number, number]
  stackDepth: number
  animate: boolean
  shownPower: number
  opacity?: number
  onSettled: () => void
}) {
  const group = useRef<Group>(null)
  const elapsed = useRef(0)
  const settled = useRef(!animate)
  const definition = getCardDefinition(card.cardId)
  const isPlayer = card.owner === 'player'
  // Preserve spatial continuity between zones. Player cards take over at the
  // exact world position of SelectedCardPreview; monster cards enter from the
  // far/top edge of the tactical board. Only activePlacement may use this path.
  const startX = isPlayer ? 4.15 - cellPosition[0] : 0
  const startY = isPlayer ? 0.38 : 1.05
  const startZ = isPlayer ? -0.65 - cellPosition[2] : -6.35 - cellPosition[2]
  const startScale = isPlayer ? 1.2 : 0.92
  const duration = isPlayer ? 0.72 : 0.76
  const settledY = 0.14 + stackDepth * CARD_THICKNESS

  useLayoutEffect(() => {
    if (!group.current) return
    if (!animate) {
      group.current.position.set(0, settledY, 0)
      group.current.rotation.set(0, 0, 0)
      group.current.scale.setScalar(1.54)
      return
    }
    group.current.position.set(startX, startY, startZ)
    group.current.rotation.set(isPlayer ? 0 : 0.32, isPlayer ? 0 : 0.16, isPlayer ? 0 : -0.06)
    group.current.scale.setScalar(startScale)
  }, [animate, isPlayer, settledY, startScale, startX, startY, startZ])

  useFrame((_, delta) => {
    if (!group.current || settled.current) return
    elapsed.current = Math.min(1, elapsed.current + delta / duration)
    const progress = elapsed.current
    // Leave the source zone immediately, then ease gently into the cell.
    const eased = 1 - Math.pow(1 - progress, 2.35)
    group.current.position.x = MathUtils.lerp(startX, 0, eased)
    group.current.position.z = MathUtils.lerp(startZ, 0, eased)
    group.current.position.y = MathUtils.lerp(startY, settledY, eased) + Math.sin(progress * Math.PI) * (isPlayer ? 0.58 : 0.42)
    group.current.rotation.x = MathUtils.lerp(isPlayer ? 0 : 0.32, 0, eased)
    group.current.rotation.y = MathUtils.lerp(isPlayer ? 0 : 0.16, 0, eased)
    group.current.rotation.z = MathUtils.lerp(isPlayer ? 0 : -0.06, 0, eased)
    group.current.scale.setScalar(MathUtils.lerp(startScale, 1.54, eased))
    if (progress === 1) {
      settled.current = true
      onSettled()
    }
  })

  return <group ref={group}><Card3D position={[0, 0, 0]} face={card.owner === 'player' ? 'hero' : 'monster'} card={definition} currentPower={shownPower} opacity={opacity} flipped={flipped} flipLift={0.7} silent /></group>
}

export function Cell({ id, position }: { id: CellId; position: readonly [number, number, number] }) {
  const introReady = useRef(false)
  const [hovered, setHovered] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const match = useGameStore((state) => state.match)
  const play = useGameStore((state) => state.play)
  const activePlacement = useGameStore((state) => state.activePlacement)
  const telegraph = useGameStore((state) => state.telegraph)
  const resolution = useGameStore((state) => state.resolution)
  const placementSettled = useGameStore((state) => state.placementSettled)
  const settlePlacement = useGameStore((state) => state.settlePlacement)
  const inputLocked = usePresentationStore((state) => state.inputLocked)
  const selectedInstanceId = useInteractionStore((state) => state.selectedCardInstanceId)
  const finishCardPlacement = useInteractionStore((state) => state.finishCardPlacement)
  const showPlacementNotice = useInteractionStore((state) => state.showPlacementNotice)
  const cameraMode = useInteractionStore((state) => state.cameraMode)
  const cell = match?.board.find((candidate) => candidate.id === id)
  const coveredCards = cell?.coveredCards ?? []
  const removedHere = resolution?.removed.find((item) => item.cellId === id)
  const coverHere = resolution?.cover?.cellId === id ? resolution.cover : undefined
  const visualCard = cell?.card ?? removedHere?.card ?? null
  const counting = Boolean(coverHere && visualCard && coverHere.cardInstanceId === visualCard.instanceId && coverHere.fromPower > coverHere.toPower)
  const departing = Boolean(removedHere && visualCard && removedHere.card.instanceId === visualCard.instanceId)
  const [shownPower, setShownPower] = useState(coverHere?.fromPower ?? visualCard?.currentPower ?? 0)
  const [opacity, setOpacity] = useState(1)
  const shouldAnimateCard = Boolean(
    visualCard
    && activePlacement?.cardInstanceId === visualCard.instanceId
    && activePlacement.cellId === id,
  )
  const displayedPower = counting && coverHere
    ? (placementSettled ? shownPower : coverHere.fromPower)
    : (visualCard?.currentPower ?? 0)
  const selectedCard = match?.player.hand.find((card) => card.instanceId === selectedInstanceId)
  const isEmptyCell = !cell?.card
  const isPlacementTarget = Boolean(!inputLocked && match && selectedCard && match.turn === 'player' && (isEmptyCell || canPlaceCard(match, selectedCard, cell!)))
  const isBlockedEnemy = Boolean(!inputLocked && selectedCard && cell?.card?.owner !== selectedCard.owner && !isPlacementTarget)
  const canFlip = cameraMode === 'overview' && !selectedCard && Boolean(cell?.card)
  const isInteractive = isPlacementTarget || isBlockedEnemy || canFlip
  const telegraphed = telegraph?.action.cellId === id

  useFrame((state) => {
    introReady.current = state.clock.elapsedTime >= STAGE_INTRO.complete
  })

  useEffect(() => {
    if (cameraMode !== 'overview') setFlipped(false)
  }, [cameraMode])

  useEffect(() => {
    setFlipped(false)
  }, [cell?.card?.instanceId])

  useLayoutEffect(() => {
    if (counting && coverHere) setShownPower(coverHere.fromPower)
  }, [counting, coverHere])

  useEffect(() => {
    if (!counting || !coverHere || !placementSettled) return
    const steps = coverHere.fromPower - coverHere.toPower
    const stepMs = POWER_COUNT_MS / steps
    let done = 0
    const timer = window.setInterval(() => {
      done += 1
      setShownPower(coverHere.fromPower - done)
      if (done >= steps) window.clearInterval(timer)
    }, stepMs)
    return () => window.clearInterval(timer)
  }, [counting, coverHere, placementSettled])

  useEffect(() => {
    if (!departing || !placementSettled) {
      setOpacity(1)
      return
    }
    const steps = counting && coverHere ? coverHere.fromPower - coverHere.toPower : 0
    const delay = steps > 0 ? POWER_COUNT_MS : 0
    let frame = 0
    const start = window.setTimeout(() => {
      const begun = performance.now()
      const tick = () => {
        const progress = Math.min(1, (performance.now() - begun) / DEPART_FADE_MS)
        setOpacity(1 - progress)
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, delay)
    return () => {
      window.clearTimeout(start)
      window.cancelAnimationFrame(frame)
    }
  }, [counting, coverHere, departing, placementSettled])

  return (
    <group
      position={position}
      onPointerEnter={(event) => {
        event.stopPropagation()
        setHovered(true)
        if (introReady.current && isInteractive) document.body.style.cursor = 'var(--cursor-interactive)'
      }}
      onPointerLeave={() => {
        setHovered(false)
        document.body.style.removeProperty('cursor')
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (!introReady.current || inputLocked) return
        if (isPlacementTarget && match && selectedCard) {
          const error = play({ side: 'player', cardInstanceId: selectedCard.instanceId, cellId: id })
          if (!error) finishCardPlacement()
          return
        }
        if (isBlockedEnemy && selectedCard && cell?.card) {
          showPlacementNotice(`${selectedCard.currentPower} 无法覆盖 ${cell.card.currentPower}`)
          return
        }
        if (canFlip) setFlipped((current) => !current)
      }}
    >
      <mesh position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CELL_WIDTH, CELL_HEIGHT]} />
        <meshBasicMaterial
          color={isBlockedEnemy ? CLAY : BONE}
          transparent
          opacity={hovered ? 0.34 : telegraphed ? 0.2 : 0}
          depthWrite={false}
        />
      </mesh>
      <lineSegments position={[0, 0.05, 0]} raycast={() => null}>
        <edgesGeometry args={[cellFrame, 1]} />
        <lineBasicMaterial color={hovered ? (isBlockedEnemy ? CLAY : BONE) : BONE} transparent opacity={hovered || telegraphed ? 1 : isPlacementTarget ? 0.95 : 0.55} />
      </lineSegments>
      {coveredCards.map((coveredCard, index) => (
        <Card3D
          key={coveredCard.instanceId}
          position={[0, 0.14 + index * CARD_THICKNESS, 0]}
          scale={1.54}
          face={coveredCard.owner === 'player' ? 'hero' : 'monster'}
          silent
          card={getCardDefinition(coveredCard.cardId)}
          currentPower={coveredCard.currentPower}
          flipLift={0.7}
        />
      ))}
      {visualCard && <PlacedCard
        key={visualCard.instanceId}
        card={visualCard}
        flipped={flipped}
        cellPosition={position}
        stackDepth={coveredCards.length}
        animate={shouldAnimateCard}
        shownPower={displayedPower}
        opacity={opacity}
        onSettled={() => settlePlacement(visualCard.instanceId)}
      />}
    </group>
  )
}
