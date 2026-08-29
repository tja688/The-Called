import { RoundedBox, useTexture } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Group, MathUtils, SRGBColorSpace } from 'three'

const CARD_FRONTS = Array.from({ length: 7 }, (_, index) => `/card/Monster-front-${index + 1}.png`)
const CARD_BACK = '/card/Monster-back.png'
const CARD_WIDTH = 3.6
const CARD_HEIGHT = 5
const CARD_DEPTH = .11
const FRONT_ROTATION_SPEED = .48
const BACK_ROTATION_SPEED = 2.84
const INITIAL_Y_ROTATION = -.38
// The outgoing illustration is completely edge-on here. A small extra margin
// keeps the texture swap safely on the hidden side of the turn.
const FRONT_SWAP_ANGLE = Math.PI / 2 - INITIAL_Y_ROTATION + .08

useTexture.preload([...CARD_FRONTS, CARD_BACK])

function RotatingShowcaseCard() {
  const group = useRef<Group>(null)
  const textures = useTexture([...CARD_FRONTS, CARD_BACK])
  const [frontIndex, setFrontIndex] = useState(0)
  const queuedFace = useRef(0)
  const totalRotation = useRef(0)

  textures.forEach((texture) => { texture.colorSpace = SRGBColorSpace })
  const backTexture = textures[textures.length - 1]

  useFrame(({ clock }, delta) => {
    if (!group.current) return

    // Linger around the illustrated face, then accelerate through the back.
    // The smooth cosine weight avoids an abrupt velocity change at either edge.
    const normalizedAngle = ((totalRotation.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const backWeight = Math.pow(Math.sin(normalizedAngle / 2), 4)
    const rotationSpeed = MathUtils.lerp(FRONT_ROTATION_SPEED, BACK_ROTATION_SPEED, backWeight)
    totalRotation.current += delta * rotationSpeed
    group.current.rotation.y = totalRotation.current + INITIAL_Y_ROTATION
    group.current.rotation.z = Math.sin(clock.elapsedTime * .42) * .045
    group.current.position.y = Math.sin(clock.elapsedTime * .72) * .12

    // Replace the next illustration just after the outgoing face turns edge-on.
    // At this point the front plane faces away, so the texture swap is invisible.
    const nextQueuedFace = Math.floor((totalRotation.current + Math.PI * 2 - FRONT_SWAP_ANGLE) / (Math.PI * 2))
    if (nextQueuedFace !== queuedFace.current) {
      queuedFace.current = nextQueuedFace
      setFrontIndex(nextQueuedFace % CARD_FRONTS.length)
    }
  })

  return (
    <group ref={group} rotation={[0, INITIAL_Y_ROTATION, 0]}>
      <RoundedBox args={[CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH]} radius={.09} smoothness={4} bevelSegments={4}>
        <meshStandardMaterial color="#131326" roughness={.34} metalness={.18} />
      </RoundedBox>
      <mesh position={[0, 0, CARD_DEPTH / 2 + .006]}>
        <planeGeometry args={[CARD_WIDTH * .975, CARD_HEIGHT * .982]} />
        <meshBasicMaterial map={textures[frontIndex]} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -CARD_DEPTH / 2 - .006]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_WIDTH * .975, CARD_HEIGHT * .982]} />
        <meshBasicMaterial map={backTexture} toneMapped={false} />
      </mesh>
    </group>
  )
}

function CameraBreathing() {
  useFrame(({ camera, clock }, delta) => {
    const targetZ = 8.25 + Math.sin(clock.elapsedTime * .3) * .12
    camera.position.z = MathUtils.damp(camera.position.z, targetZ, 2.2, delta)
    camera.lookAt(0, 0, 0)
  })
  return null
}

export function HomeCardScene() {
  return (
    <div className="home-card-scene" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 8.25], fov: 47, near: .1, far: 30 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
      >
        <ambientLight intensity={1.35} />
        <directionalLight position={[3, 4, 6]} intensity={2.4} color="#c9d6ff" />
        <pointLight position={[-4, -2, 4]} intensity={28} distance={13} color="#ff174f" />
        <RotatingShowcaseCard />
        <CameraBreathing />
      </Canvas>
    </div>
  )
}
