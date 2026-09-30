import { useEffect, useState } from 'react'
import { MapView } from '../game/v6/view/map'
import { createSession, forkGraph, type MapSession } from '../game/v6/map'

let keptSession: MapSession | null = null

function remember(next: MapSession) {
  keptSession = next
  return next
}
import '../game/v6/view/battle/battle.css'
import { fetchCatalog, kernelOfflineMessage, startMatch, validateDeck } from './client'
import { filled, loadBuild, starterBuild } from './deck'
import { PcdBattle } from './PcdBattle'
import type { PcdAdvance, PcdCatalog } from './types'

type Fight = {
  advance: PcdAdvance
  monsterId: string
  seed: number
}

export function ForkRun({ onExit, onDeck }: { onExit: () => void; onDeck: () => void }) {
  const [catalog, setCatalog] = useState<PcdCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [session, setSession] = useState<MapSession>(() => keptSession ?? createSession())
  const [fight, setFight] = useState<Fight | null>(null)

  useEffect(() => {
    let alive = true
    void fetchCatalog().then(
      (next) => {
        if (!alive) return
        setCatalog(next)
        const titles: Record<string, string> = {}
        for (const monster of next.monsters) titles[monster.id] = monster.name
        setSession((current) => remember({ ...current, graph: forkGraph(titles) }))
      },
      (reason: unknown) => {
        if (!alive) return
        setError(kernelOfflineMessage(reason))
      },
    )
    return () => {
      alive = false
    }
  }, [])

  const enterBattle = (monsterId: string) => {
    if (!catalog || starting) {
      if (!catalog) setNotice(error ?? '正在读取牌表…')
      return
    }
    const build = loadBuild() ?? starterBuild(catalog)
    const payload = filled(build)
    setStarting(true)
    setNotice(null)
    void validateDeck(payload.cards, payload.backs)
      .then((report) => {
        if (!report.ok) throw new Error(report.issues.join(' '))
        const seed = Math.floor(Math.random() * 0x7fffffff) + 1
        return startMatch({
          monsterId,
          seed,
          buildDeck: payload.cards,
          buildBacks: payload.backs,
        }).then((advance) => ({ advance, seed }))
      })
      .then(
        (started) => {
          setFight({ advance: started.advance, monsterId, seed: started.seed })
          setStarting(false)
        },
        (reason: unknown) => {
          setStarting(false)
          setNotice(reason instanceof Error ? reason.message : '没能开始对局')
        },
      )
  }

  if (fight && catalog) {
    return (
      <PcdBattle
        key={fight.seed}
        catalog={catalog}
        advance={fight.advance}
        monsterId={fight.monsterId}
        onDone={() => setFight(null)}
      />
    )
  }

  return (
    <div className="v6-run v6-run--map">
      <div className="v6-run__bar">
        <button type="button" onClick={onExit}>返回主菜单</button>
        <button type="button" onClick={onDeck}>构筑</button>
      </div>
      <MapView
        session={session}
        onSessionChange={(next) => {
          setSession(remember(next))
          setNotice(null)
        }}
        onEnterBattle={(monsterId) => enterBattle(monsterId)}
      />
      {error || notice ? <p className="v6-run__notice" role="status">{notice ?? error}</p> : null}
    </div>
  )
}
