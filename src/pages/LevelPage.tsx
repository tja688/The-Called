import { useEffect, useRef } from 'react'
import { GameCanvas } from '../scene/GameCanvas'
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
  const prepareMonsterTurn = useGameStore((state) => state.prepareMonsterTurn)
  const playMonsterTurn = useGameStore((state) => state.playMonsterTurn)
  const resolveFinalBattleTurn = useGameStore((state) => state.resolveFinalBattleTurn)
  const resolution = useGameStore((state) => state.resolution)
  const setCameraMode = useInteractionStore((state) => state.setCameraMode)
  const finishCardPlacement = useInteractionStore((state) => state.finishCardPlacement)
  const previousTurn = useRef(match?.turn)

  useEffect(() => {
    if (level && monster) initialize(level.id, monster.id)
  }, [initialize, level, monster])

  useEffect(() => {
    if (match?.status !== 'playing' || !match.finalBattle || !match.openingTurn) return
    const timer = window.setTimeout(resolveFinalBattleTurn, 1000)
    return () => window.clearTimeout(timer)
  }, [match?.finalBattle, match?.openingTurn, match?.round, match?.status, match?.turn, resolveFinalBattleTurn])

  useEffect(() => {
    if (match?.status !== 'playing' || match.turn !== 'monster' || match.openingTurn) return
    finishCardPlacement()
    setCameraMode('overview')
    // The next card is already on the table. Wait out a cover or removal, then play it.
    if (resolution) return
    if (!prepareMonsterTurn()) return
    const timer = window.setTimeout(playMonsterTurn, 950)
    return () => window.clearTimeout(timer)
  }, [finishCardPlacement, match?.openingTurn, match?.round, match?.status, match?.turn, playMonsterTurn, prepareMonsterTurn, resolution, setCameraMode])

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
    </main>
  )
}
