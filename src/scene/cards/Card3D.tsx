import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, CanvasTexture, EdgesGeometry, Group, LinearFilter, MathUtils, Mesh, SRGBColorSpace } from 'three'
import type { CardDefinition } from '../../game/types'
import { MONSTER_FACE, PILE_FACE, PLAYER_FACE } from '../presentation/palette'

export const CARD_ASPECT_RATIO = 500 / 360
export const CARD_WIDTH = 1.28
export const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO
export const CARD_THICKNESS = 0.028

type FaceStyle = { fill: string; ink: string; line: string }

export type CardReadout = 'full' | 'power'

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
  /** Full face in vertical view; power only when the board is seen at an angle. */
  readout?: CardReadout
  /** Decorative copies should not steal pointer rays from the board. */
  silent?: boolean
  /**
   * Board cards swap between the big power and the full face when the camera
   * changes. Paint both ahead of time so that swap does not redraw every canvas.
   */
  prepareReadouts?: boolean
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

let cachedFontFamily = ''

function cardFontFamily() {
  if (cachedFontFamily) return cachedFontFamily
  const family = getComputedStyle(document.documentElement).fontFamily || 'sans-serif'
  if (document.fonts?.status === 'loaded') cachedFontFamily = family
  return family
}

function createFaceTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1000
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

function paintCard(canvas: HTMLCanvasElement, style: FaceStyle, card?: CardDefinition, currentPower?: number, side: 'front' | 'back' = 'front', readout: CardReadout = 'full') {
  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = canvas
  context.clearRect(0, 0, width, height)
  context.fillStyle = style.fill
  context.fillRect(0, 0, width, height)
  context.strokeStyle = style.line
  context.lineWidth = 10
  context.strokeRect(36, 36, width - 72, height - 72)
  context.lineWidth = 3
  context.strokeRect(58, 58, width - 116, height - 116)
  context.lineWidth = 8
  const corners: Array<[number, number, number, number]> = [
    [52, 52, 1, 1],
    [width - 52, 52, -1, 1],
    [52, height - 52, 1, -1],
    [width - 52, height - 52, -1, -1],
  ]
  corners.forEach(([x, y, sx, sy]) => {
    context.beginPath()
    context.moveTo(x + sx * 46, y)
    context.lineTo(x, y)
    context.lineTo(x, y + sy * 46)
    context.stroke()
  })

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

  const fontFamily = cardFontFamily()
  const powerText = String(currentPower ?? card.power)
  context.fillStyle = style.ink
  context.textBaseline = 'middle'

  if (readout === 'power') {
    context.textAlign = 'center'
    context.font = `700 360px ${fontFamily}`
    context.fillText(powerText, width / 2, height * 0.52)
    return
  }

  context.textAlign = 'left'
  context.font = `700 118px ${fontFamily}`
  context.fillText(powerText, 88, 162)

  context.beginPath()
  context.moveTo(88, 236)
  context.lineTo(width - 88, 236)
  context.stroke()

  context.textAlign = 'center'
  const copy = effectCopy(card.description)
  const nameSize = fitFontSize(context, card.name, width - 176, copy ? 64 : 78, 42, 700, fontFamily)
  context.font = `700 ${nameSize}px ${fontFamily}`
  context.fillText(card.name, width / 2, copy ? 318 : 520)

  if (!copy) return
  const maxWidth = width - 176
  let size = 62
  context.font = `500 ${size}px ${fontFamily}`
  let lines = wrapText(context, copy, maxWidth)
  while (size > 44 && lines.length > 3) {
    size -= 2
    context.font = `500 ${size}px ${fontFamily}`
    lines = wrapText(context, copy, maxWidth)
  }
  const shown = lines.slice(0, 3)
  const lineHeight = Math.round(size * 1.38)
  const startY = 468
  shown.forEach((line, index) => {
    context.fillText(line, width / 2, startY + index * lineHeight)
  })
}

function useFaceTexture(style: FaceStyle, card: CardDefinition | undefined, currentPower: number | undefined, side: 'front' | 'back', readout: CardReadout, prepareBoth: boolean) {
  const textures = useMemo(() => ({
    full: createFaceTexture(),
    power: prepareBoth ? createFaceTexture() : null,
  }), [prepareBoth])
  const painted = useRef({ full: '', power: '' })
  const contentKey = `${card?.id ?? ''}|${currentPower ?? ''}|${side}|${style.fill}|${style.ink}|${style.line}`

  useLayoutEffect(() => {
    const draw = (which: CardReadout) => {
      const page = textures[which]
      if (!page) return
      const stamp = `${contentKey}|${which}`
      if (painted.current[which] === stamp) return
      paintCard(page.image as HTMLCanvasElement, style, card, currentPower, side, which)
      page.needsUpdate = true
      painted.current[which] = stamp
    }
    draw(readout)
    const other: CardReadout = readout === 'full' ? 'power' : 'full'
    if (!textures[other] || painted.current[other] === `${contentKey}|${other}`) return
    const frame = window.requestAnimationFrame(() => draw(other))
    return () => window.cancelAnimationFrame(frame)
  }, [card, contentKey, currentPower, readout, side, style, textures])

  useEffect(() => {
    if (document.fonts?.status === 'loaded') return
    let drop = false
    void document.fonts?.ready.then(() => {
      if (drop) return
      painted.current = { full: '', power: '' }
      const page = textures[readout]
      if (!page) return
      paintCard(page.image as HTMLCanvasElement, style, card, currentPower, side, readout)
      page.needsUpdate = true
      painted.current[readout] = `${contentKey}|${readout}`
      const other: CardReadout = readout === 'full' ? 'power' : 'full'
      const extra = textures[other]
      if (!extra) return
      paintCard(extra.image as HTMLCanvasElement, style, card, currentPower, side, other)
      extra.needsUpdate = true
      painted.current[other] = `${contentKey}|${other}`
    })
    return () => { drop = true }
  }, [card, contentKey, currentPower, readout, side, style, textures])

  useEffect(() => () => {
    textures.full.dispose()
    textures.power?.dispose()
  }, [textures])

  return textures[readout] ?? textures.full
}

const slab = new BoxGeometry(CARD_WIDTH, CARD_THICKNESS, CARD_HEIGHT)
const edges = new EdgesGeometry(slab)

const ignoreRaycast = () => null
const receiveRaycast = Mesh.prototype.raycast

export function Card3D({ position, rotation = [0, 0, 0], scale = 1, face = 'hero', flipped = false, flipLift = 0.14, card, currentPower, opacity = 1, readout = 'full', silent = false, prepareReadouts = false }: Props) {
  const cardGroup = useRef<Group>(null)
  const flipProgress = useRef(flipped ? 1 : 0)
  const style = !card ? PILE_FACE : face === 'hero' ? PLAYER_FACE : MONSTER_FACE
  const front = useFaceTexture(style, card, currentPower, 'front', readout, prepareReadouts)
  const back = useFaceTexture(style, card, currentPower, 'back', readout, prepareReadouts)

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
