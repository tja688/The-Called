import { RoundedBox, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Group, LinearFilter, MathUtils } from 'three'
import { SRGBColorSpace } from 'three'
import type { CardDefinition } from '../../game/types'

// Temporary card art is 360 × 500; every card-sized object follows that ratio.
export const CARD_ASPECT_RATIO = 500 / 360
export const CARD_WIDTH = 1.28
export const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO
export const CARD_THICKNESS = 0.035

// Warm the React Three Fiber loader cache, not only the browser HTTP cache.
// Otherwise the first card using a new art variant suspends the whole Canvas
// for a frame, which presents as a black flash during placement.
const CARD_TEXTURE_PAIRS: string[][] = [
  ['/card/Hero-front.png', '/card/Hero-back.png'],
  ['/card/Hero-front.png', '/card/Hero-back-gray.png'],
  ...Array.from({ length: 7 }, (_, index) => [
    `/card/Monster-front-${index + 1}.png`,
    '/card/Monster-back.png',
  ]),
]

CARD_TEXTURE_PAIRS.forEach((textures) => useTexture.preload(textures))

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
  backArt?: string
}

function fitFontSize(context: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, minimumSize: number, weight: number, fontFamily: string) {
  let size = initialSize
  while (size > minimumSize) {
    context.font = `${weight} ${size}px ${fontFamily}`
    if (context.measureText(text).width <= maxWidth) break
    size -= 1
  }
  return size
}

type CopyMask = { x: number; y: number; width: number; height: number }

const CARD_COPY_MASKS = {
  name: { x: 90, y: 558, width: 540, height: 150 },
  description: { x: 75, y: 735, width: 570, height: 190 },
} satisfies Record<'name' | 'description', CopyMask>

function paintGlowingText(context: CanvasRenderingContext2D, text: string, x: number, y: number, strokeWidth: number) {
  // Match the R-rotate hint: a crisp white face, dark separation from the
  // artwork, and a compact cyan glow underneath instead of a card-wide haze.
  context.save()
  context.shadowColor = 'rgba(35, 207, 255, .9)'
  context.shadowBlur = 13
  context.shadowOffsetY = 7
  context.fillStyle = '#fff'
  context.fillText(text, x, y)
  context.shadowColor = 'transparent'
  context.shadowBlur = 0
  context.shadowOffsetY = 0
  context.lineJoin = 'round'
  context.lineWidth = strokeWidth
  context.strokeStyle = 'rgba(0, 0, 0, .78)'
  context.strokeText(text, x, y)
  context.fillText(text, x, y)
  context.restore()
}

function drawMaskedCopy(
  context: CanvasRenderingContext2D,
  text: string,
  mask: CopyMask,
  initialSize: number,
  minimumSize: number,
  weight: number,
  fontFamily: string,
) {
  context.save()
  context.beginPath()
  context.rect(mask.x, mask.y, mask.width, mask.height)
  context.clip()
  const size = fitFontSize(context, text, mask.width - 24, initialSize, minimumSize, weight, fontFamily)
  context.font = `${weight} ${size}px ${fontFamily}`
  paintGlowingText(context, text, mask.x + mask.width / 2, mask.y + mask.height / 2, Math.max(3, size * .075))
  context.restore()
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ''

  // Keep Latin runs such as "Power +1" together while allowing CJK copy to
  // wrap naturally at each character inside the card's description panel.
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

function drawWrappedMaskedCopy(
  context: CanvasRenderingContext2D,
  text: string,
  mask: CopyMask,
  initialSize: number,
  minimumSize: number,
  weight: number,
  fontFamily: string,
) {
  const maxWidth = mask.width - 34
  const maxHeight = mask.height - 22
  let size = initialSize
  let lines: string[] = []
  let lineHeight = size * 1.12

  while (size >= minimumSize) {
    context.font = `${weight} ${size}px ${fontFamily}`
    lines = wrapText(context, text, maxWidth)
    lineHeight = size * 1.12
    if (lines.length * lineHeight <= maxHeight) break
    size -= 1
  }

  context.save()
  context.beginPath()
  context.rect(mask.x, mask.y, mask.width, mask.height)
  context.clip()
  context.font = `${weight} ${size}px ${fontFamily}`
  const firstBaseline = mask.y + mask.height / 2 - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, index) => {
    paintGlowingText(context, line, mask.x + mask.width / 2, firstBaseline + index * lineHeight, Math.max(3, size * .075))
  })
  context.restore()
}

function useCardCopyTexture(card?: CardDefinition, currentPower?: number) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 1000
    const nextTexture = new CanvasTexture(canvas)
    nextTexture.minFilter = LinearFilter
    nextTexture.magFilter = LinearFilter
    return nextTexture
  }, [])

  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement
    const context = canvas.getContext('2d')
    if (!context) return

    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      if (!card) {
        texture.needsUpdate = true
        return
      }
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      // Canvas text does not inherit CSS automatically. Read the resolved
      // global typography stack so card copy stays aligned with the UI system.
      const fontFamily = getComputedStyle(document.documentElement).fontFamily

      context.font = `900 138px ${fontFamily}`
      paintGlowingText(context, String(currentPower ?? card.power), 188, 150, 9)

      drawMaskedCopy(context, card.name, CARD_COPY_MASKS.name, 82, 52, 700, fontFamily)
      // The description panel has room for multiple lines. Using it prevents
      // longer copy from shrinking to a hard-to-read single line. Both the
      // preferred and minimum sizes are 140% of the previous values.
      drawWrappedMaskedCopy(context, card.description, CARD_COPY_MASKS.description, 63, 45, 500, fontFamily)
      texture.needsUpdate = true
    }

    draw()
    void document.fonts?.ready.then(draw)
  }, [card, currentPower, texture])

  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

export function Card3D({ position, rotation = [0, 0, 0], accent = '#ffffff', scale = 1, face = 'hero', flipped = false, flipLift = 0.14, card, currentPower, backArt }: Props) {
  const cardGroup = useRef<Group>(null)
  const flipProgress = useRef(flipped ? 1 : 0)
  const copyTexture = useCardCopyTexture(card, currentPower)
  const fallbackFront = face === 'hero' ? '/card/Hero-front.png' : '/card/Monster-front-1.png'
  const fallbackBack = backArt ?? (face === 'hero' ? '/card/Hero-back.png' : '/card/Monster-back.png')
  const [cardFront, cardBack] = useTexture([card?.art.front ?? fallbackFront, card?.art.back ?? fallbackBack])
  cardFront.colorSpace = SRGBColorSpace
  cardBack.colorSpace = SRGBColorSpace

  useFrame((_, delta) => {
    if (!cardGroup.current) return
    const damping = 1 - Math.exp(-delta * 16)
    flipProgress.current = MathUtils.lerp(flipProgress.current, flipped ? 1 : 0, damping)
    const progress = flipProgress.current
    cardGroup.current.rotation.z = Math.PI * progress
    // The lift follows the turning edge, keeping the whole card above its surface.
    cardGroup.current.position.y = Math.sin(progress * Math.PI) * flipLift
  })

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={cardGroup}>
        <RoundedBox
          args={[CARD_WIDTH, CARD_THICKNESS, CARD_HEIGHT]}
          radius={0.014}
          smoothness={2}
          bevelSegments={2}
          castShadow
        >
          <meshStandardMaterial color={accent} roughness={0.68} />
        </RoundedBox>
        <mesh position={[0, CARD_THICKNESS / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CARD_WIDTH * 0.965, CARD_HEIGHT * 0.975]} />
          <meshBasicMaterial map={cardFront} toneMapped={false} />
        </mesh>
        <mesh position={[0, -CARD_THICKNESS / 2 - 0.002, 0]} rotation={[Math.PI / 2, 0, Math.PI]}>
          <planeGeometry args={[CARD_WIDTH * 0.965, CARD_HEIGHT * 0.975]} />
          <meshBasicMaterial map={cardBack} toneMapped={false} />
        </mesh>
        {card && !flipped && (
          <mesh position={[0, CARD_THICKNESS / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CARD_WIDTH * 0.965, CARD_HEIGHT * 0.975]} />
            <meshBasicMaterial map={copyTexture} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  )
}
