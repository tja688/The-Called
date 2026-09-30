import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GameCanvas } from '../scene/GameCanvas'
import { clearPresentedCards } from '../config/cardCatalog'
import type { CellId } from '../game/types'
import { useBattleCue } from '../game/v6/view/battle/cue'
import { monsterScene, sceneCell } from '../game/v6/view/battle/project'
import '../game/v6/view/battle/battle.css'
import { useGameStore } from '../stores/gameStore'
import { useInteractionStore } from '../stores/interactionStore'
import { usePresentationStore } from '../stores/presentationStore'
import { answerMatch } from './client'
import { readInstance } from './ids'
import { looseCardOptions, optionForAnswer, optionForCast, optionForEndTurn, optionForPlay } from './options'
import { beatsFor, type Beat } from './playback'
import { projectBattle, publishProjection } from './project'
import type { PcdAdvance, PcdCatalog, PcdOption, PcdView } from './types'
import './pcd.css'

type Score = {
  player: number
  monster: number
  intent: string | null
  deck: number
  playerDiscard: number
  monsterDiscard: number
  pools: Array<{ owner: string; id: string; name: string; amount: number }>
  round: number
}

export function PcdBattle({
  catalog,
  advance: opening,
  monsterId,
  onDone,
}: {
  catalog: PcdCatalog
  advance: PcdAdvance
  monsterId: string
  onDone: () => void
}) {
  const monsterName = catalog.monsters.find((monster) => monster.id === monsterId)?.name ?? monsterId
  const stage = monsterScene(monsterId, monsterName)
  const [advance, setAdvance] = useState(opening)
  const [ready, setReady] = useState(false)
  const [score, setScore] = useState<Score | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const optionsRef = useRef<PcdOption[]>([])
  const snapshotRef = useRef(opening.snapshot)
  const busyRef = useRef(true)
  const landRef = useRef<(() => void) | null>(null)
  const submitRef = useRef<(optionId: string) => void>(() => {})
  const shownRef = useRef<PcdView | null>(null)
  const liveRef = useRef(true)
  const match = useGameStore((state) => state.match)
  const placementNotice = useInteractionStore((state) => state.placementNotice)
  const selectedId = useInteractionStore((state) => state.selectedCardInstanceId)

  submitRef.current = (optionId: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setNotice(null)
    usePresentationStore.getState().setInputLocked(true)
    useInteractionStore.getState().finishCardPlacement()
    void answerMatch(snapshotRef.current, optionId).then(
      (next) => {
        if (liveRef.current) setAdvance(next)
      },
      (reason: unknown) => {
        busyRef.current = false
        if (!liveRef.current) return
        usePresentationStore.getState().setInputLocked(false)
        setNotice(reason instanceof Error ? reason.message : '对局请求失败')
      },
    )
  }

  useLayoutEffect(() => {
    liveRef.current = true
    clearPresentedCards()
    useInteractionStore.getState().resetBattleView()
    usePresentationStore.getState().setInputLocked(true)
    useGameStore.setState((state) => ({
      match: null,
      battleKey: state.battleKey + 1,
      telegraph: undefined,
      activePlacement: undefined,
      resolution: undefined,
      placementSettled: false,
    }))
    useBattleCue.getState().bind({
      allows: (instanceId, cell) => Boolean(optionForPlay(optionsRef.current, instanceId, cell)),
      picks: () => false,
      answers: (cell) => Boolean(optionForAnswer(optionsRef.current, cell, cardOn(cell))),
      play: (action) => {
        const id = optionForPlay(optionsRef.current, action.cardInstanceId, action.cellId)
        if (!id) {
          useInteractionStore.getState().showPlacementNotice('这一格现在不能放')
          return 'illegal'
        }
        submitRef.current(id)
        return undefined
      },
      land: () => landRef.current?.(),
      answer: (cell) => {
        const id = optionForAnswer(optionsRef.current, cell, cardOn(cell))
        if (id) submitRef.current(id)
      },
      commit: (instanceId) => {
        const id = optionForCast(optionsRef.current, instanceId)
        if (id) submitRef.current(id)
      },
    })
    return () => {
      liveRef.current = false
      useBattleCue.getState().clear()
      usePresentationStore.getState().setInputLocked(false)
      useGameStore.getState().abandon()
      clearPresentedCards()
    }
  }, [])

  useEffect(() => {
    let alive = true
    const living = () => alive && liveRef.current
    optionsRef.current = []
    snapshotRef.current = advance.snapshot
    busyRef.current = true
    setReady(false)
    usePresentationStore.getState().setInputLocked(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const beats = beatsFor(shownRef.current, advance)
    void (async () => {
      let flown: string | null = null
      for (const beat of beats) {
        if (!living()) return
        const sameIntent = Boolean(flown && beat.view.revealedIntent === flown)
        if (beat.fly?.side === 'monster') {
          flown = beat.fly.cardId
          paint(beat, 'fly', catalog, monsterId, setScore)
          if (!reduce) await waitLand(landRef, living)
          if (!living()) return
          paint(beat, 'landed', catalog, monsterId, setScore)
        } else if (beat.fly?.side === 'player') {
          paint(beat, 'play', catalog, monsterId, setScore, sameIntent)
          await pause(reduce ? 40 : 720)
          if (!living()) return
          useGameStore.setState({ activePlacement: undefined })
        } else {
          paint(beat, 'still', catalog, monsterId, setScore, sameIntent)
          if (beat.view.revealedIntent && beat.view.revealedIntent !== flown) flown = null
          await pause(reduce ? 30 : 240)
        }
      }
      if (!living()) return
      shownRef.current = advance.view
      const over = Boolean(advance.result || advance.view.winner)
      const player = advance.pending?.actor === 'player' && !over
      const live = useGameStore.getState().match
      if (live && player && live.turn !== 'player') {
        useGameStore.setState({ match: { ...live, turn: 'player', openingTurn: false, status: 'playing' } })
      }
      optionsRef.current = player ? advance.pending?.options ?? [] : []
      snapshotRef.current = advance.snapshot
      busyRef.current = false
      usePresentationStore.getState().setInputLocked(!player)
      setReady(player)
    })()
    return () => {
      alive = false
    }
  }, [advance, catalog, monsterId])

  const options = ready ? advance.pending?.options ?? [] : []
  const endTurn = optionForEndTurn(options)
  const boardInstances = new Set(
    advance.view.cells.flatMap((cell) => (cell.card ? [cell.card.instance] : [])),
  )
  const loose = ready ? looseCardOptions(options, boardInstances) : []
  const over = Boolean(match?.result)
  const winner = match?.result?.winner
  const pendingType = ready ? advance.pending?.type ?? null : null

  return (
    <main className="app-shell v6-battle-stage">
      <div className="scene-layer">
        <GameCanvas monster={stage.monster} scene={stage.scene} />
      </div>
      {match?.status === 'playing' ? (
        <aside className="view-hint">
          <span className="view-hint__mark" aria-hidden="true" />
          <span>滚轮向前 俯视</span>
          <span>滚轮向后 手牌</span>
        </aside>
      ) : null}
      <section className="battle-status" aria-live="polite">
        <div className="battle-status__score">
          <span>{score?.player ?? 0}</span>
          <span>—</span>
          <span>{score?.monster ?? 0}</span>
        </div>
        <div className="battle-status__meta">
          <span>{monsterName}</span>
          <span>{statusLabel(over, ready, match?.turn)}</span>
          {score ? <span>第 {score.round} 回合</span> : null}
          {score?.intent ? <span>意图 {score.intent}</span> : null}
          <span>牌组 {score?.deck ?? 0}</span>
          <span>弃牌 {score?.playerDiscard ?? 0}</span>
          <span>对方弃牌 {score?.monsterDiscard ?? 0}</span>
          {score?.pools.filter((pool) => pool.amount > 0).map((pool) => (
            <span key={`${pool.owner}:${pool.id}`}>{pool.name} {pool.amount}</span>
          ))}
        </div>
      </section>
      {placementNotice || notice ? <div className="placement-notice" role="status">{placementNotice || notice}</div> : null}
      {loose.length > 0 ? (
        <div className="v6-pick-prompt" role="status">
          <p>选一张牌</p>
          <div className="v6-pick-prompt__choices">
            {loose.map((option) => (
              <button key={option.id} type="button" onClick={() => submitRef.current(option.id)}>
                {optionLabel(advance.view, catalog, option)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="v6-stage-actions">
        <p className="v6-stage-hint">{hint(ready, pendingType, options, selectedId ?? null)}</p>
        <button type="button" onClick={onDone}>返回</button>
        <button
          type="button"
          disabled={!endTurn}
          onClick={() => {
            if (endTurn) submitRef.current(endTurn)
          }}
        >
          结束回合
        </button>
      </div>
      {over ? (
        <div className="match-result" role="dialog" aria-modal="true" aria-label="对局结果">
          <div className="match-result__panel">
            <strong>{winner === 'player' ? '你赢了' : winner === 'monster' ? '对方赢了' : '平局'}</strong>
            <span>YOU {score?.player ?? 0} — {score?.monster ?? 0} {monsterName}</span>
            <button type="button" onClick={onDone}>回到选择</button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function paint(
  beat: Beat,
  mode: 'fly' | 'landed' | 'play' | 'still',
  catalog: PcdCatalog,
  monsterId: string,
  setScore: (score: Score) => void,
  hideIntent = false,
) {
  const flying = mode === 'fly' && beat.fly?.side === 'monster'
  const projected = projectBattle({
    view: beat.view,
    catalog,
    monsterId,
    turn: flying ? 'monster' : turnOf(beat.view),
    concealInstance: flying ? beat.fly?.instanceId : undefined,
    hideIntent: mode === 'landed' || hideIntent,
    monsterCell: flying ? beat.fly?.cell : undefined,
    telegraphId: flying ? beat.fly?.telegraphId : undefined,
  })
  publishProjection(projected)
  useGameStore.setState({
    match: projected.match,
    telegraph: projected.telegraph,
    activePlacement: mode === 'play' && beat.fly
      ? { side: 'player', cardInstanceId: beat.fly.instanceId, cellId: sceneCell(asCell(beat.fly.cell)) }
      : undefined,
    resolution: undefined,
    placementSettled: false,
  })
  useBattleCue.getState().bump([], projected.polluted)
  setScore({
    player: projected.playerPoints,
    monster: projected.monsterPoints,
    intent: mode === 'landed' || hideIntent ? null : projected.intentName,
    deck: projected.deckCount,
    playerDiscard: projected.playerDiscard,
    monsterDiscard: projected.monsterDiscard,
    pools: projected.pools,
    round: beat.view.round,
  })
}

function turnOf(view: PcdView): 'player' | 'monster' {
  if (view.phase === 'monster-action' || view.phase === 'monster-turn-start' || view.phase === 'monster-turn-end') {
    return 'monster'
  }
  return 'player'
}

function cardOn(cell: CellId) {
  return useGameStore.getState().match?.board.find((item) => item.id === cell)?.card?.instanceId ?? null
}

function asCell(cell: number) {
  return cell as Parameters<typeof sceneCell>[0]
}

function waitLand(landRef: { current: (() => void) | null }, alive: () => boolean) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(finish, 1600)
    function finish() {
      window.clearTimeout(timer)
      landRef.current = null
      resolve()
    }
    landRef.current = finish
    const poll = window.setInterval(() => {
      if (alive()) return
      window.clearInterval(poll)
      finish()
    }, 40)
    window.setTimeout(() => window.clearInterval(poll), 1600)
  })
}

function pause(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function statusLabel(over: boolean, ready: boolean, turn: 'player' | 'monster' | undefined) {
  if (over) return '结束'
  if (!ready) return '结算中'
  if (turn === 'monster') return '对方回合'
  return '你的回合'
}

function hint(ready: boolean, pendingType: string | null, options: PcdOption[], selectedId: string | null) {
  if (!ready) return '正在结算'
  if (pendingType && pendingType !== 'play') {
    if (options.some((option) => option.kind === 'cell')) return '点一个格子'
    if (options.some((option) => option.kind === 'card')) return '点要选的那张牌'
  }
  const selected = selectedId ? readInstance(selectedId) : null
  const canPlay = selected != null && options.some((option) => option.kind === 'play' && option.instance === selected)
  const canCast = selected != null && options.some((option) => option.kind === 'cast' && option.instance === selected)
  if (selected != null && !canPlay && !canCast) return '这张牌现在不能打出'
  if (options.some((option) => option.kind === 'cast') && !options.some((option) => option.kind === 'play')) {
    return '点一张法术打出'
  }
  if (selected == null) return '点一张手牌，再点格子'
  return '再点一个可以放的格子'
}

function optionLabel(view: PcdView, catalog: PcdCatalog, option: PcdOption) {
  const cards = [
    ...view.hand,
    ...view.playerDiscard,
    ...view.monsterDiscard,
    ...view.cells.flatMap((cell) => (cell.card ? [cell.card] : [])),
  ]
  const card = cards.find((item) => item.instance === option.instance)
  const id = card?.cardId ?? option.cardId
  return catalog.cards.find((item) => item.id === id)?.name ?? id ?? '一张牌'
}
