import { useEffect, useRef } from 'react'
import { GameCanvas } from '../scene/GameCanvas'
import { BattleFilters } from '../ui/BattleFilters'
import { HUD } from '../ui/HUD'
import { useNavigationStore } from '../stores/navigationStore'
import { getLevelConfig, getMonsterConfig, getSceneConfig } from '../config/gameContent'
import { useGameStore } from '../stores/gameStore'
import { useInteractionStore } from '../stores/interactionStore'

export function LevelPage() {
  const levelId = useNavigationStore((state) => state.levelId)
  const level = getLevelConfig(levelId)
  const monster = getMonsterConfig(level?.monsterId ?? null)
  const scene = getSceneConfig(level?.sceneId ?? 'default')
  const initialize = useGameStore((state) => state.initialize)
  const match = useGameStore((state) => state.match)
  const playMonsterTurn = useGameStore((state) => state.playMonsterTurn)
  const setCameraMode = useInteractionStore((state) => state.setCameraMode)
  const finishCardPlacement = useInteractionStore((state) => state.finishCardPlacement)
  const previousTurn = useRef(match?.turn)

  useEffect(() => {
    if (level && monster) initialize(level.id, monster.id)
  }, [initialize, level, monster])

  useEffect(() => {
    if (match?.status !== 'playing' || match.turn !== 'monster') return
    finishCardPlacement()
    setCameraMode('overview')
    const timer = window.setTimeout(playMonsterTurn, 950)
    return () => window.clearTimeout(timer)
  }, [finishCardPlacement, match?.round, match?.status, match?.turn, playMonsterTurn, setCameraMode])

  useEffect(() => {
    const wasMonsterTurn = previousTurn.current === 'monster'
    previousTurn.current = match?.turn
    if (!wasMonsterTurn || match?.turn !== 'player' || match.status !== 'playing') return
    const timer = window.setTimeout(() => setCameraMode('board'), 1450)
    return () => window.clearTimeout(timer)
  }, [match?.round, match?.status, match?.turn, setCameraMode])

  if (!level || !monster) return null

  return (
    <main className="app-shell">
      <div className="scene-layer"><GameCanvas monster={monster} scene={scene} /></div>
      <HUD />
      <div className="grain" aria-hidden="true" />
      <BattleFilters fight fightBlue />
    </main>
  )
}
