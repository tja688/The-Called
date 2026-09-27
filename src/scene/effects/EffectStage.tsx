import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Euler, Group, Quaternion, Vector3 } from 'three'
import { getCardDefinition } from '../../config/cardCatalog'
import { cellWorldPosition } from '../../game/core/spatial'
import type { CellId, EffectCue, Side } from '../../game/v6/rules'
import { cueMs } from '../../game/v6/rules'
import { landingEase, landingHop } from '../board/landingEase'
import { Card3D } from '../cards/Card3D'
import { PLAYER_DECK_PILE } from '../cards/PlayerDeckPile'
import { BONE, CLAY } from '../presentation/palette'
import { useEffectReel } from './reelStore'

const BOARD: [number, number, number] = [0, -0.1, -0.65]
const DECK: [number, number, number] = [PLAYER_DECK_PILE[0] - BOARD[0], 0.2, PLAYER_DECK_PILE[2] - BOARD[2]]
const HAND: [number, number, number] = [0, 0.45, 4.5]
const RIGHT: [number, number, number] = [5.35, 1.15, 0.8]

function cellPos(cell: CellId): [number, number, number] {
  const index = cell - 1
  const [x, , z] = cellWorldPosition(Math.floor(index / 3), index % 3)
  return [x, 0, z]
}

function sideAnchor(owner: Side | null): [number, number, number] {
  return owner === 'enemy' ? RIGHT : HAND
}

function spot(cue: EffectCue, which: 'source' | 'target'): [number, number, number] {
  const cell = which === 'source' ? cue.sourceCell : (cue.cell ?? cue.toCell)
  if (cell && which === 'source') return cellPos(cell)
  if (which === 'target' && cue.cell) return cellPos(cue.cell)
  if (cue.kind === 'draw' || cue.kind === 'search' || cue.kind === 'sacrifice') return DECK
  return sideAnchor(cue.owner)
}

function ink(owner: Side | null) {
  return owner === 'enemy' ? CLAY : BONE
}

function painted(id: string) {
  try {
    return getCardDefinition(id)
  } catch {
    return null
  }
}

function useT(token: string, ms: number) {
  const [t, setT] = useState(0)
  const start = useRef<number | null>(null)
  useLayoutEffect(() => {
    start.current = null
    setT(0)
  }, [token])
  useFrame((state) => {
    if (start.current === null) start.current = state.clock.elapsedTime
    const next = Math.min(1, ((state.clock.elapsedTime - start.current) * 1000) / ms)
    setT((prev) => (prev === next ? prev : next))
  })
  return t
}

function Stick({
  position,
  rotation = [0, 0, 0],
  size,
  color,
  opacity = 1,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  size: [number, number, number]
  color: string
  opacity?: number
}) {
  return (
    <mesh position={position} rotation={rotation} raycast={() => null} renderOrder={4}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function Ring({
  position,
  radius,
  tube = 0.045,
  color,
  opacity = 1,
}: {
  position: [number, number, number]
  radius: number
  tube?: number
  color: string
  opacity?: number
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={4}>
      <ringGeometry args={[Math.max(0.02, radius - tube), radius, 48]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={2} />
    </mesh>
  )
}

function Beam({ from, to, color, opacity }: { from: [number, number, number]; to: [number, number, number]; color: string; opacity: number }) {
  const start = new Vector3(from[0], 0.58, from[2])
  const end = new Vector3(to[0], 0.58, to[2])
  const length = start.distanceTo(end)
  if (length < 0.25) return null
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const rotation = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), end.clone().sub(start).normalize()))
  return (
    <mesh position={[mid.x, mid.y, mid.z]} rotation={rotation} raycast={() => null} renderOrder={4}>
      <boxGeometry args={[length, 0.025, 0.04]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  )
}

function At({ at, y = 0.36, children }: { at: [number, number, number]; y?: number; children: ReactNode }) {
  return <group position={[at[0], y, at[2]]}>{children}</group>
}

function Reticle({ t, color, slash = false }: { t: number; color: string; slash?: boolean }) {
  const aim = 1.35 - 0.35 * Math.min(1, t / 0.45)
  const opacity = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28
  return (
    <group scale={aim}>
      <Ring position={[0, 0, 0]} radius={0.78} color={color} opacity={opacity} />
      <Ring position={[0, 0.01, 0]} radius={0.18} tube={0.03} color={color} opacity={opacity} />
      <Stick position={[0, 0.02, 0]} size={[1.7, 0.02, 0.035]} color={color} opacity={opacity} />
      <Stick position={[0, 0.02, 0]} rotation={[0, Math.PI / 2, 0]} size={[1.7, 0.02, 0.035]} color={color} opacity={opacity} />
      {slash ? <Stick position={[0, 0.04, 0]} rotation={[0, Math.PI / 4, 0]} size={[1.9, 0.02, 0.05]} color={color} opacity={opacity} /> : null}
    </group>
  )
}

function Shield({ color, opacity = 1, crack = 0 }: { color: string; opacity?: number; crack?: number }) {
  return (
    <group>
      <Stick position={[-0.28 - crack, 0.05, 0]} rotation={[0, 0, 0.55]} size={[0.9, 0.025, 0.045]} color={color} opacity={opacity} />
      <Stick position={[0.28 + crack, 0.05, 0]} rotation={[0, 0, -0.55]} size={[0.9, 0.025, 0.045]} color={color} opacity={opacity} />
      <Stick position={[0, -0.28 - crack * 0.4, 0]} size={[0.045, 0.025, 0.7]} color={color} opacity={opacity} />
      <Stick position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} size={[0.72, 0.025, 0.04]} color={color} opacity={opacity} />
    </group>
  )
}

function Chevron({ up, color, opacity }: { up: boolean; color: string; opacity: number }) {
  const tilt = up ? 0.7 : -0.7
  const y = up ? 0.15 : -0.05
  return (
    <group position={[0, y, 0]}>
      <Stick position={[-0.22, 0, 0]} rotation={[0, 0, tilt]} size={[0.55, 0.025, 0.045]} color={color} opacity={opacity} />
      <Stick position={[0.22, 0, 0]} rotation={[0, 0, -tilt]} size={[0.55, 0.025, 0.045]} color={color} opacity={opacity} />
    </group>
  )
}

function Shards({ t, color }: { t: number; color: string }) {
  const burst = Math.max(0, (t - 0.38) / 0.62)
  return (
    <group>
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2
        const reach = burst * (0.7 + (index % 3) * 0.18)
        return (
          <Stick
            key={index}
            position={[Math.cos(angle) * reach, 0.05 + burst * 0.2, Math.sin(angle) * reach]}
            rotation={[0, angle, burst]}
            size={[0.42, 0.02, 0.045]}
            color={color}
            opacity={1 - burst}
          />
        )
      })}
    </group>
  )
}

function Picture({ cue }: { cue: EffectCue }) {
  const t = useT(`${cue.seq}`, cueMs(cue.kind))
  const color = cue.kind === 'points' || cue.kind === 'faith' ? (cue.amount < 0 ? CLAY : BONE) : ink(cue.owner)
  const here = spot(cue, 'target')
  const there = spot(cue, 'source')
  const fade = 1 - Math.max(0, (t - 0.7) / 0.3)

  if (cue.kind === 'mark') {
    return <At at={here}><Reticle t={t} color={color} /></At>
  }
  if (cue.kind === 'unmark') {
    return <At at={here}><Reticle t={t} color={color} slash /></At>
  }
  if (cue.kind === 'protect') return null
  if (cue.kind === 'guard') {
    return <At at={here}><Shield color={color} opacity={1 - t} crack={t * 0.35} /></At>
  }
  if (cue.kind === 'remove' || cue.kind === 'cover') {
    const beam = Math.min(1, t / 0.4)
    return (
      <group>
        {cue.kind === 'remove' ? <Beam from={there} to={here} color={color} opacity={beam * (1 - Math.max(0, (t - 0.55) / 0.45))} /> : null}
        <At at={here}>{cue.kind === 'cover'
          ? <group position={[0, 0.4 - t * 0.45, 0]}><Stick position={[0, 0, 0]} size={[1.15, 0.03, 0.06]} color={color} opacity={1 - t} /></group>
          : <Shards t={t} color={BONE} />}</At>
      </group>
    )
  }
  if (cue.kind === 'points' || cue.kind === 'double' || cue.kind === 'clear' || cue.kind === 'absorb') {
    const up = cue.kind === 'absorb' ? false : cue.amount >= 0
    return (
      <At at={here}>
        <group position={[0, (up ? 1 : -1) * t * 0.35, 0]}>
          <Chevron up={up} color={color} opacity={fade} />
          {cue.kind === 'double' || cue.kind === 'absorb' ? <group position={[0, up ? 0.28 : -0.28, 0]}><Chevron up={cue.kind === 'absorb' ? true : up} color={color} opacity={fade} /></group> : null}
        </group>
      </At>
    )
  }
  if (cue.kind === 'seal' || cue.kind === 'unseal' || cue.kind === 'threshold') {
    const shut = cue.kind === 'unseal' ? 1 - t : Math.min(1, t / 0.5)
    return (
      <At at={here}>
        <Stick position={[-0.55 * shut, 0, 0]} size={[0.04, 0.03, 1.35]} color={color} opacity={fade} />
        <Stick position={[0.55 * shut, 0, 0]} size={[0.04, 0.03, 1.35]} color={color} opacity={fade} />
        <Stick position={[0, 0, -0.78 * shut]} rotation={[0, Math.PI / 2, 0]} size={[0.04, 0.03, 1.15]} color={color} />
        <Stick position={[0, 0, 0.78 * shut]} rotation={[0, Math.PI / 2, 0]} size={[0.04, 0.03, 1.15]} color={color} />
      </At>
    )
  }
  if (cue.kind === 'aura' || cue.kind === 'settle' || cue.kind === 'cast' || cue.kind === 'reset') {
    const radius = cue.kind === 'settle' || cue.kind === 'cast' ? 0.3 + t * 1.15 : 0.85
    return <At at={cue.kind === 'cast' ? there : here}><Ring position={[0, 0, 0]} radius={radius} color={color} opacity={cue.kind === 'aura' ? 0.9 : fade} /></At>
  }
  if (cue.kind === 'faith') {
    return (
      <At at={there} y={0.7 + t * 0.45}>
        <Stick position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]} size={[0.42, 0.03, 0.42]} color={color} opacity={fade} />
      </At>
    )
  }
  if (cue.kind === 'pollute') {
    return <At at={here} y={0.08}><Ring position={[0, 0, 0]} radius={0.95} tube={0.12} color={CLAY} opacity={0.85} /></At>
  }
  if (cue.kind === 'timer' || cue.kind === 'swift' || cue.kind === 'follow') {
    return (
      <At at={here}>
        <Ring position={[0, 0, 0]} radius={0.7} color={color} opacity={fade} />
        <Stick position={[0.2, 0.02, 0]} rotation={[0, t * 1.4, 0]} size={[0.55, 0.025, 0.04]} color={color} opacity={fade} />
        {cue.kind !== 'timer' ? <Stick position={[-0.15, 0.03, 0.15]} rotation={[0, 0.4, 0]} size={[0.4, 0.025, 0.04]} color={color} opacity={fade} /> : null}
      </At>
    )
  }
  if (cue.kind === 'mirror' && cue.cell && cue.toCell) {
    return <Beam from={cellPos(cue.cell)} to={cellPos(cue.toCell)} color={color} opacity={fade} />
  }
  if (cue.kind === 'transfer') {
    return <At at={here}><Chevron up color={color} opacity={fade} /></At>
  }
  if (cue.kind === 'draw' || cue.kind === 'search' || cue.kind === 'sacrifice') {
    return (
      <At at={DECK} y={0.35}>
        <Ring position={[0, t * 0.4, 0]} radius={0.55 + t * 0.25} color={cue.kind === 'sacrifice' ? CLAY : BONE} opacity={fade} />
        {cue.kind === 'sacrifice' ? <Stick position={[0, 0.05, 0]} rotation={[0, Math.PI / 4, 0]} size={[1.1, 0.03, 0.05]} color={CLAY} opacity={fade} /> : null}
      </At>
    )
  }
  if (cue.kind === 'revive') {
    return <At at={here}><Ring position={[0, 0, 0]} radius={0.62} color={BONE} opacity={fade} /></At>
  }
  if (cue.kind === 'exhaust') {
    return (
      <At at={here}>
        <Stick position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]} size={[1.2, 0.03, 0.05]} color={CLAY} opacity={fade} />
        <Stick position={[0, 0.02, 0]} rotation={[0, -Math.PI / 4, 0]} size={[1.2, 0.03, 0.05]} color={CLAY} opacity={fade} />
      </At>
    )
  }
  return <At at={here}><Ring position={[0, 0, 0]} radius={0.4 + t * 0.4} color={color} opacity={fade} /></At>
}

function SpawnFlight({ cue }: { cue: EffectCue }) {
  const group = useRef<Group>(null)
  const from = cue.sourceCell ? cellPos(cue.sourceCell) : sideAnchor(cue.owner)
  const to = cue.cell ? cellPos(cue.cell) : from
  const start = useRef<number | null>(null)
  useLayoutEffect(() => {
    start.current = null
  }, [cue.seq])
  useFrame((state) => {
    const root = group.current
    if (!root) return
    if (start.current === null) start.current = state.clock.elapsedTime
    const t = Math.min(1, (state.clock.elapsedTime - start.current) / (cueMs('spawn') / 1000))
    const eased = landingEase(t)
    root.position.set(from[0] + (to[0] - from[0]) * eased, 0.14 + landingHop(t, 0.16), from[2] + (to[2] - from[2]) * eased)
    root.scale.setScalar(0.05 + (1.54 - 0.05) * eased)
  })
  const face = cue.targetId ? painted(cue.targetId) : null
  if (!face) return null
  return (
    <group ref={group}>
      <Card3D position={[0, 0, 0]} face={cue.owner === 'player' ? 'hero' : 'monster'} card={face} currentPower={cue.amount} silent />
    </group>
  )
}

function Hold({ badgeId, cell, children }: { badgeId: string; cell: CellId; children: React.ReactNode }) {
  const group = useRef<Group>(null)
  const start = useRef<number | null>(null)
  useLayoutEffect(() => {
    start.current = null
    group.current?.scale.setScalar(0.04)
  }, [badgeId])
  useFrame((state) => {
    const root = group.current
    if (!root) return
    if (start.current === null) start.current = state.clock.elapsedTime
    const t = Math.min(1, (state.clock.elapsedTime - start.current) / 0.42)
    root.scale.setScalar(0.04 + 0.96 * (1 - (1 - t) ** 3))
  })
  const at = cellPos(cell)
  return <group ref={group} position={[at[0], 0.3, at[2]]}>{children}</group>
}

function flagOn(id: string, flag: 'protect' | 'analyzed' | 'sealed' | 'revive', suppress: { id: string; flag: string }[]) {
  return !suppress.some((item) => item.id === id && item.flag === flag)
}

export function EffectStage() {
  const fx = useEffectReel((state) => state.fx)
  const spawn = useEffectReel((state) => state.spawn)
  const badges = useEffectReel((state) => state.badges)
  const suppress = useEffectReel((state) => state.suppress)
  const hidden = useEffectReel((state) => state.hidden)
  return (
    <group>
      {badges.map((badge) => {
        if (hidden.includes(badge.id)) return null
        const color = BONE
        return (
          <group key={badge.id}>
            {badge.protect && flagOn(badge.id, 'protect', suppress) ? (
              <Hold badgeId={`${badge.id}:protect`} cell={badge.cell}><Shield color={color} /></Hold>
            ) : null}
            {badge.analyzed && flagOn(badge.id, 'analyzed', suppress) ? (
              <Hold badgeId={`${badge.id}:mark`} cell={badge.cell}>
                <Stick position={[-0.72, 0, -0.95]} size={[0.28, 0.02, 0.035]} color={color} />
                <Stick position={[-0.84, 0, -0.82]} rotation={[0, Math.PI / 2, 0]} size={[0.28, 0.02, 0.035]} color={color} />
                <Stick position={[0.72, 0, -0.95]} size={[0.28, 0.02, 0.035]} color={color} />
                <Stick position={[0.84, 0, -0.82]} rotation={[0, Math.PI / 2, 0]} size={[0.28, 0.02, 0.035]} color={color} />
                <Stick position={[-0.72, 0, 0.95]} size={[0.28, 0.02, 0.035]} color={color} />
                <Stick position={[-0.84, 0, 0.82]} rotation={[0, Math.PI / 2, 0]} size={[0.28, 0.02, 0.035]} color={color} />
                <Stick position={[0.72, 0, 0.95]} size={[0.28, 0.02, 0.035]} color={color} />
                <Stick position={[0.84, 0, 0.82]} rotation={[0, Math.PI / 2, 0]} size={[0.28, 0.02, 0.035]} color={color} />
              </Hold>
            ) : null}
            {badge.sealed && flagOn(badge.id, 'sealed', suppress) ? (
              <Hold badgeId={`${badge.id}:seal`} cell={badge.cell}>
                <Stick position={[-0.7, 0, 0]} size={[0.04, 0.03, 1.5]} color={CLAY} />
                <Stick position={[0.7, 0, 0]} size={[0.04, 0.03, 1.5]} color={CLAY} />
                <Stick position={[0, 0, -0.95]} rotation={[0, Math.PI / 2, 0]} size={[0.04, 0.03, 1.45]} color={CLAY} />
                <Stick position={[0, 0, 0.95]} rotation={[0, Math.PI / 2, 0]} size={[0.04, 0.03, 1.45]} color={CLAY} />
              </Hold>
            ) : null}
            {badge.revive && flagOn(badge.id, 'revive', suppress) ? (
              <Hold badgeId={`${badge.id}:revive`} cell={badge.cell}>
                <Ring position={[0, 0, 0.55]} radius={0.28} tube={0.03} color={BONE} />
              </Hold>
            ) : null}
          </group>
        )
      })}
      {spawn ? <SpawnFlight key={spawn.seq} cue={spawn} /> : null}
      {fx && fx.kind !== 'spawn' && fx.kind !== 'arrive' ? <Picture key={fx.seq} cue={fx} /> : null}
    </group>
  )
}
