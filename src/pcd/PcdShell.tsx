import { useEffect, useState } from 'react'
import { fetchCatalog, startMatch } from './client'
import type { PcdAdvance, PcdCatalog } from './types'
import { PcdBattle } from './PcdBattle'
import './pcd.css'

const MONSTERS = ['monster.001', 'monster.002', 'monster.003']
const DECKS = ['deck.science', 'deck.mystery', 'deck.religion']

type Battle = {
  advance: PcdAdvance
  monsterId: string
  seed: number
}

export function PcdShell({ onExit }: { onExit: () => void }) {
  const [catalog, setCatalog] = useState<PcdCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [battle, setBattle] = useState<Battle | null>(null)

  useEffect(() => {
    let alive = true
    void fetchCatalog().then(
      (next) => {
        if (alive) setCatalog(next)
      },
      () => {
        if (alive) setError('内核没有连上。请用 start-game.bat 同时启动对局服务和网页。')
      },
    )
    return () => {
      alive = false
    }
  }, [])

  if (battle && catalog) {
    return (
      <PcdBattle
        key={battle.seed}
        catalog={catalog}
        advance={battle.advance}
        monsterId={battle.monsterId}
        onDone={() => setBattle(null)}
      />
    )
  }

  return (
    <PcdSelect
      catalog={catalog}
      error={error}
      onExit={onExit}
      onError={setError}
      onStart={setBattle}
    />
  )
}

function PcdSelect({
  catalog,
  error,
  onExit,
  onError,
  onStart,
}: {
  catalog: PcdCatalog | null
  error: string | null
  onExit: () => void
  onError: (message: string | null) => void
  onStart: (battle: Battle) => void
}) {
  const monsters = MONSTERS.flatMap((id) => {
    const monster = catalog?.monsters.find((item) => item.id === id)
    return monster ? [monster] : []
  })
  const decks = DECKS.flatMap((id) => {
    const deck = catalog?.decks.find((item) => item.id === id)
    return deck ? [deck] : []
  })
  const [monsterId, setMonsterId] = useState(MONSTERS[0])
  const [deckId, setDeckId] = useState(DECKS[0])
  const [starting, setStarting] = useState(false)

  const begin = () => {
    if (!catalog || starting) return
    const seed = Math.floor(Math.random() * 0x7fffffff) + 1
    setStarting(true)
    onError(null)
    void startMatch(monsterId, deckId, seed).then(
      (advance) => onStart({ advance, monsterId, seed }),
      (reason: unknown) => {
        setStarting(false)
        onError(reason instanceof Error ? reason.message : '没能开始对局')
      },
    )
  }

  return (
    <main className="pcd-select">
      <header className="pcd-select__head">
        <p>选择一场对局</p>
        <h1>三名对手</h1>
      </header>
      {!catalog && !error ? <p className="pcd-select__status">正在读取牌表…</p> : null}
      {error ? <p className="pcd-select__status" role="alert">{error}</p> : null}
      {catalog ? (
        <div className="pcd-columns">
          <section>
            <h2>怪物</h2>
            <div className="pcd-choices" role="listbox" aria-label="怪物">
              {monsters.map((monster, index) => (
                <button
                  key={monster.id}
                  type="button"
                  role="option"
                  aria-selected={monster.id === monsterId}
                  className={monster.id === monsterId ? 'pcd-choice is-current' : 'pcd-choice'}
                  onClick={() => setMonsterId(monster.id)}
                >
                  <span>0{index + 1}</span>
                  <b>{monster.name}</b>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2>牌组</h2>
            <div className="pcd-choices" role="listbox" aria-label="牌组">
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  type="button"
                  role="option"
                  aria-selected={deck.id === deckId}
                  className={deck.id === deckId ? 'pcd-choice is-current' : 'pcd-choice'}
                  onClick={() => setDeckId(deck.id)}
                >
                  <span>{deck.load}</span>
                  <b>{deck.name}</b>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
      <div className="pcd-select__actions">
        <button type="button" onClick={onExit}>返回</button>
        <button type="button" disabled={!catalog || starting || monsters.length !== 3 || decks.length !== 3} onClick={begin}>
          {starting ? '正在开局…' : '开始对局'}
        </button>
      </div>
    </main>
  )
}
