import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Group, MathUtils } from 'three'
import { getCardDefinition } from '../../config/cardCatalog'
import { canPlaceCard } from '../../game/core/matchEngine'
import type { CardInstance, CellId } from '../../game/types'
import { useGameStore } from '../../stores/gameStore'
import { useInteractionStore } from '../../stores/interactionStore'
import { CARD_ASPECT_RATIO, CARD_THICKNESS, Card3D } from '../cards/Card3D'
import { STAGE_INTRO } from '../environment/stageIntro'

const CELL_WIDTH = 2.02
const CELL_HEIGHT = CELL_WIDTH * CARD_ASPECT_RATIO

function PlacedCard({ card, flipped, cellPosition, stackDepth, animate, onSettled }: {
  card: CardInstance
  flipped: boolean
  cellPosition: readonly [number, number, number]
  stackDepth: number
  animate: boolean
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
  const startX = isPlayer ? 4.35 - cellPosition[0] : 0
  const startY = isPlayer ? 0.38 : 1.05
  const startZ = isPlayer ? -cellPosition[2] : -6.35 - cellPosition[2]
  const startScale = isPlayer ? 1.46 : 0.92
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

  return <group ref={group}><Card3D position={[0, 0, 0]} accent={card.owner === 'player' ? '#7b9ca8' : '#9b4d68'} face={card.owner === 'player' ? 'hero' : 'monster'} card={definition} currentPower={card.currentPower} flipped={flipped} flipLift={0.7} /></group>
}

export function Cell({ id, position }: { id: CellId; position: readonly [number, number, number] }) {
  const introReady = useRef(false)
  const [hovered, setHovered] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const match = useGameStore((state) => state.match)
  const play = useGameStore((state) => state.play)
  const activePlacement = useGameStore((state) => state.activePlacement)
  const settlePlacement = useGameStore((state) => state.settlePlacement)
  const selectedInstanceId = useInteractionStore((state) => state.selectedCardInstanceId)
  const finishCardPlacement = useInteractionStore((state) => state.finishCardPlacement)
  const showPlacementNotice = useInteractionStore((state) => state.showPlacementNotice)
  const cameraMode = useInteractionStore((state) => state.cameraMode)
  const cell = match?.board.find((candidate) => candidate.id === id)
  const coveredCards = cell?.coveredCards ?? []
  const shouldAnimateCard = Boolean(
    cell?.card
    && activePlacement?.cardInstanceId === cell.card.instanceId
    && activePlacement.cellId === id,
  )
  const selectedCard = match?.player.hand.find((card) => card.instanceId === selectedInstanceId)
  const isEmptyCell = !cell?.card
  const isPlacementTarget = Boolean(match && selectedCard && match.turn === 'player' && (isEmptyCell || canPlaceCard(match, selectedCard, cell!)))
  const isBlockedEnemy = Boolean(selectedCard && cell?.card?.owner !== selectedCard.owner && !isPlacementTarget)
  const canFlip = cameraMode === 'overview' && !selectedCard && Boolean(cell?.card)
  const isInteractive = isPlacementTarget || isBlockedEnemy || canFlip

  useFrame((state) => {
    introReady.current = state.clock.elapsedTime >= STAGE_INTRO.complete
  })

  useEffect(() => {
    if (cameraMode !== 'overview') setFlipped(false)
  }, [cameraMode])

  useEffect(() => {
    setFlipped(false)
  }, [cell?.card?.instanceId])

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
        if (!introReady.current) return
        if (isPlacementTarget && match && selectedCard) {
          const error = play({ side: 'player', cardInstanceId: selectedCard.instanceId, cellId: id })
          if (!error) finishCardPlacement()
          return
        }
        if (isBlockedEnemy && selectedCard && cell?.card) {
          showPlacementNotice(`点数不足：${selectedCard.currentPower} 点无法覆盖 ${cell.card.currentPower} 点的敌方卡牌`)
          return
        }
        if (canFlip) setFlipped((current) => !current)
      }}
    >
      <RoundedBox
        args={[CELL_WIDTH, 0.055, CELL_HEIGHT]} radius={0.035} smoothness={3}
      >
        <meshStandardMaterial color="#d8d4db" roughness={0.74} metalness={0.05} />
      </RoundedBox>
      {/* The gray card is the permanent physical base of every cell, not an
          empty-state placeholder. Keeping it mounted prevents the board from
          visually dropping out before an incoming card reaches the cell. */}
      <Card3D position={[0, 0.09, 0]} scale={1.54} face="hero" flipped backArt="/card/Hero-back-gray.png" flipLift={0.7} />
      {coveredCards.map((coveredCard, index) => (
        <Card3D
          key={coveredCard.instanceId}
          position={[0, 0.14 + index * CARD_THICKNESS, 0]}
          scale={1.54}
          accent={coveredCard.owner === 'player' ? '#7b9ca8' : '#9b4d68'}
          face={coveredCard.owner === 'player' ? 'hero' : 'monster'}
          card={getCardDefinition(coveredCard.cardId)}
          currentPower={coveredCard.currentPower}
          flipLift={0.7}
        />
      ))}
      {((hovered && isInteractive) || isPlacementTarget) && (
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CELL_WIDTH * 0.98, CELL_HEIGHT * 0.985]} />
          <meshBasicMaterial color={isBlockedEnemy ? '#ff5478' : canFlip ? '#ffffff' : '#6ff5ff'} transparent opacity={isBlockedEnemy ? 0.12 : canFlip ? 0.1 : 0.18} depthWrite={false} />
        </mesh>
      )}
      {cell?.card && <PlacedCard
        key={cell.card.instanceId}
        card={cell.card}
        flipped={flipped}
        cellPosition={position}
        stackDepth={coveredCards.length}
        animate={shouldAnimateCard}
        onSettled={() => settlePlacement(cell.card!.instanceId)}
      />}
    </group>
  )
}
