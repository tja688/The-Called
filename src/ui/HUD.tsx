import { useEffect, useState } from 'react'
import { playCameraTransition } from '../audio/gameAudio'
import { useCampaignStore } from '../stores/campaignStore'
import { useInteractionStore } from '../stores/interactionStore'
import { useNavigationStore } from '../stores/navigationStore'
import { usePresentationStore } from '../stores/presentationStore'
import { PlaybackControls } from './PlaybackControls'
import { getCardDefinition } from '../config/cardCatalog'
import { finalBattleMessage, getBoardPower } from '../game/core/matchEngine'
import { useDeckStore } from '../stores/deckStore'
import { useGameStore } from '../stores/gameStore'
import { getMonsterConfig } from '../config/gameContent'
import type { MatchResult } from '../game/types'

export function formatMatchResultMessage(winner: MatchResult['winner'], monsterName: string) {
  return winner === 'draw' ? '平局。' : winner === 'player' ? '你赢了！' : `${monsterName} 获胜。`
}

export function matchDeparture(winner: MatchResult['winner']) {
  return winner === 'player' ? 'map' : 'home'
}

let rewardNotice: { key: string; names: string[] } | null = null

export function HUD() {
  const setCameraMode = useInteractionStore((state) => state.setCameraMode)
  const resetBattleView = useInteractionStore((state) => state.resetBattleView)
  const match = useGameStore((state) => state.match)
  const telegraph = useGameStore((state) => state.telegraph)
  const nextCardName = telegraph && match?.status === 'playing' ? getCardDefinition(telegraph.card.cardId).name : undefined
  const placementNotice = useInteractionStore((state) => state.placementNotice)
  const showPlacementNotice = useInteractionStore((state) => state.showPlacementNotice)
  const monsterName = getMonsterConfig(match?.monsterId ?? null)?.name ?? 'UNKNOWN'
  const resultMessage = formatMatchResultMessage(match?.result?.winner ?? 'draw', monsterName)
  const finished = match?.status === 'finished'
  const winner = match?.result?.winner
  const [rewardNames, setRewardNames] = useState<string[]>([])

  useEffect(() => {
    if (!placementNotice) return
    const timer = window.setTimeout(() => showPlacementNotice(undefined), 2400)
    return () => window.clearTimeout(timer)
  }, [placementNotice, showPlacementNotice])

  useEffect(() => {
    if (!finished || winner !== 'player' || !match) {
      setRewardNames([])
      return
    }
    const key = `${useGameStore.getState().battleKey}:${match.levelId}`
    if (rewardNotice?.key === key) {
      setRewardNames(rewardNotice.names)
      return
    }
    const names = useDeckStore.getState().claimLevelReward(match.levelId).map((cardId) => getCardDefinition(cardId).name)
    rewardNotice = { key, names }
    setRewardNames(names)
  }, [finished, match, winner])

  useEffect(() => {
    if (!finished || !winner || !match) return
    const levelId = match.levelId
    const timer = window.setTimeout(() => {
      resetBattleView()
      if (matchDeparture(winner) === 'map') {
        useCampaignStore.getState().complete(levelId)
        useNavigationStore.getState().exitToMap()
        return
      }
      useCampaignStore.getState().reset()
      useNavigationStore.getState().exitToHome()
    }, 1100)
    return () => window.clearTimeout(timer)
  }, [finished, match, resetBattleView, winner])

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 8) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return
      const match = useGameStore.getState().match
      if (!match || match.status !== 'playing' || match.turn !== 'player' || match.openingTurn) return
      if (usePresentationStore.getState().inputLocked) return
      const interaction = useInteractionStore.getState()
      const forward = event.deltaY < 0
      if (forward && interaction.cameraMode !== 'overview') {
        playCameraTransition('up')
        interaction.setCameraMode('overview')
        event.preventDefault()
      }
      if (!forward && interaction.cameraMode === 'overview') {
        playCameraTransition('down')
        interaction.finishCardPlacement()
        interaction.setCameraMode('board')
        event.preventDefault()
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      const current = useInteractionStore.getState().cameraMode
      const enteringOverview = current !== 'overview'
      playCameraTransition(enteringOverview ? 'up' : 'down')
      setCameraMode(enteringOverview ? 'overview' : 'board')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCameraMode])

  return (
    <>
      <PlaybackControls />
      {match?.status === 'playing' && (
        <aside className="view-hint">
          <span className="view-hint__mark" aria-hidden="true" />
          <span>滚轮向前 俯视</span>
          <span>滚轮向后 手牌</span>
        </aside>
      )}
      {match && (
        <section className="battle-status" aria-live="polite">
          <div className="battle-status__score">
            <span>{getBoardPower(match, 'player')}</span>
            <span>—</span>
            <span>{getBoardPower(match, 'monster')}</span>
          </div>
          <div className="battle-status__meta">
            <span>{monsterName}</span>
            <span>{match.status === 'finished' ? '结束' : match.turn === 'player' ? '你的回合' : '对方回合'}</span>
            {nextCardName && <span>下一张 {nextCardName}</span>}
          </div>
        </section>
      )}
      {placementNotice && <div className="placement-notice" role="status">{placementNotice}</div>}
      {match?.finalBattle && match.status === 'playing' && !placementNotice && (
        <div className="placement-notice" role="status">{finalBattleMessage}</div>
      )}
      {match?.status === 'finished' && match.result && (
        <div className="match-result" role="dialog" aria-modal="true" aria-label="对局结果">
          <div className="match-result__panel">
            <strong>{resultMessage}</strong>
            <span>YOU {match.result.playerPower} — {match.result.monsterPower} {monsterName}</span>
            {rewardNames.length > 0 && <span>获得 {rewardNames.join('、')}</span>}
            <span>{winner === 'player' ? '回到地图' : '回到主菜单'}</span>
          </div>
        </div>
      )}
    </>
  )
}
