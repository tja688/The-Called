import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, CanvasTexture, EdgesGeometry, Group, LinearFilter, MathUtils, Mesh, SRGBColorSpace } from 'three'
import type { CardDefinition } from '../../game/types'
import { MONSTER_FACE, PILE_FACE, PLAYER_FACE } from '../presentation/palette'

export const CARD_ASPECT_RATIO = 500 / 360
export const CARD_WIDTH = 1.28
export const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO
export const CARD_THICKNESS = 0.028

type FaceStyle = { fill: string; ink: string; line: string }

type Props = {
  position: [number, number, number]
  rotation?: [number, number, number]
  accent?: string
  scale?: number
  face?: 'hero' | 'monster'
  flipped?: boolean
  flipLift?: number
  card?: CardDefinition
  currentPower?: number
  opacity?: number
  backArt?: string
  /** Decorative copies should not steal pointer rays from the board. */
  silent?: boolean
}

function fitFontSize(context: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, minimumSize: number, weight: number, fontFamily: string) {
  let size = initialSize
  context.font = `${weight} ${size}px ${fontFamily}`
  while (size > minimumSize && context.measureText(text).width > maxWidth) {
    size -= 2
    context.font = `${weight} ${size}px ${fontFamily}`
  }
  return size
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ''
  const tokens = text.match(/[A-Za-z0-9]+(?:\s*[+.-]\s*[A-Za-z0-9]+)*|\s+|./gu) ?? []
  tokens.forEach((token) => {
    const candidate = line + token
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line.trim())
      line = token.trimStart()
    } else {
      line = candidate
    }
  })
  if (line.trim()) lines.push(line.trim())
  return lines
}

function effectCopy(description: string) {
  return description.replace(/[。．.]+$/u, '').replace(/^无额外效果$/u, '')
}

function paintCard(canvas: HTMLCanvasElement, style: FaceStyle, card?: CardDefinition, currentPower?: number, side: 'front' | 'back' = 'front') {
  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = canvas
  context.clearRect(0, 0, width, height)
  context.fillStyle = style.fill
  context.fillRect(0, 0, width, height)
  context.strokeStyle = style.line
  context.lineWidth = 10
  context.strokeRect(36, 36, width - 72, height - 72)

  if (side === 'back' || !card) {
    context.beginPath()
    context.moveTo(width / 2, 390)
    context.lineTo(width / 2 + 78, height / 2)
    context.lineTo(width / 2, height - 390)
    context.lineTo(width / 2 - 78, height / 2)
    context.closePath()
    context.stroke()
    return
  }

  const fontFamily = getComputedStyle(document.documentElement).fontFamily || 'sans-serif'
  context.fillStyle = style.ink
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.font = `700 150px ${fontFamily}`
  context.fillText(String(currentPower ?? card.power), 72, 148)

  context.beginPath()
  context.moveTo(72, 220)
  context.lineTo(width - 72, 220)
  context.stroke()

  context.textAlign = 'center'
  const nameSize = fitFontSize(context, card.name, width - 150, 64, 36, 700, fontFamily)
  context.font = `700 ${nameSize}px ${fontFamily}`
  context.fillText(card.name, width / 2, 300)

  const copy = effectCopy(card.description)
  if (!copy) return
  const maxWidth = width - 140
  let size = 34
  context.font = `500 ${size}px ${fontFamily}`
  let lines = wrapText(context, copy, maxWidth)
  while (size > 26 && lines.length > 2) {
    size -= 2
    context.font = `500 ${size}px ${fontFamily}`
    lines = wrapText(context, copy, maxWidth)
  }
  lines.slice(0, 2).forEach((line, index) => {
    context.fillText(line, width / 2, 390 + index * (size + 12))
  })
}

function useFaceTexture(style: FaceStyle, card?: CardDefinition, currentPower?: number, side: 'front' | 'back' = 'front') {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 1000
    const next = new CanvasTexture(canvas)
    next.colorSpace = SRGBColorSpace
    next.minFilter = LinearFilter
    next.magFilter = LinearFilter
    return next
  }, [])

  useEffect(() => {
    const draw = () => {
      paintCard(texture.image as HTMLCanvasElement, style, card, currentPower, side)
      texture.needsUpdate = true
    }
    draw()
    void document.fonts?.ready.then(draw)
  }, [card, currentPower, side, style, texture])

  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

const slab = new BoxGeometry(CARD_WIDTH, CARD_THICKNESS, CARD_HEIGHT)
const edges = new EdgesGeometry(slab)

const ignoreRaycast = () => null
const receiveRaycast = Mesh.prototype.raycast

export function Card3D({ position, rotation = [0, 0, 0], scale = 1, face = 'hero', flipped = false, flipLift = 0.14, card, currentPower, opacity = 1, silent = false }: Props) {
  const cardGroup = useRef<Group>(null)
  const flipProgress = useRef(flipped ? 1 : 0)
  const style = !card ? PILE_FACE : face === 'hero' ? PLAYER_FACE : MONSTER_FACE
  const front = useFaceTexture(style, card, currentPower, 'front')
  const back = useFaceTexture(style, card, currentPower, 'back')

  useFrame((_, delta) => {
    if (!cardGroup.current) return
    flipProgress.current = MathUtils.lerp(flipProgress.current, flipped ? 1 : 0, 1 - Math.exp(-delta * 16))
    const progress = flipProgress.current
    cardGroup.current.rotation.z = Math.PI * progress
    cardGroup.current.position.y = Math.sin(progress * Math.PI) * flipLift
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={cardGroup}>
        <mesh geometry={slab} raycast={silent ? ignoreRaycast : receiveRaycast}>
          <meshBasicMaterial color={style.fill} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <lineSegments geometry={edges} raycast={ignoreRaycast}>
          <lineBasicMaterial color={style.line} transparent={opacity < 1} opacity={opacity} />
        </lineSegments>
        <mesh position={[0, CARD_THICKNESS / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={silent ? ignoreRaycast : receiveRaycast}>
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshBasicMaterial map={front} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
        </mesh>
        <mesh position={[0, -CARD_THICKNESS / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, Math.PI]} raycast={silent ? ignoreRaycast : receiveRaycast}>
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshBasicMaterial map={back} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
        </mesh>
      </group>
    </group>
  )
}
