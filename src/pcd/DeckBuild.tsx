import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog, validateDeck } from './client'
import { clearSlot, filled, loadBuild, placeCard, saveBuild, setBack, starterBuild, type Build } from './deck'
import type { PcdCatalog, PcdDeckReport } from './types'
import './pcd.css'

const SCHOOLS = [
  { id: 'science', label: '科学' },
  { id: 'mystery', label: '神秘' },
  { id: 'religion', label: '宗教' },
]

export function DeckBuild({ onBack }: { onBack: () => void }) {
  const [catalog, setCatalog] = useState<PcdCatalog | null>(null)
  const [build, setBuild] = useState<Build | null>(null)
  const [report, setReport] = useState<PcdDeckReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void fetchCatalog().then(
      (next) => {
        if (!alive) return
        setCatalog(next)
        setBuild(loadBuild() ?? starterBuild(next))
      },
      () => {
        if (alive) setError('内核没有连上。请用 start-game.bat 同时启动对局服务和网页。')
      },
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!build) return
    saveBuild(build)
    let alive = true
    const payload = filled(build)
    const timer = window.setTimeout(() => {
      void validateDeck(payload.cards, payload.backs).then(
        (next) => {
          if (alive) setReport(next)
        },
        (reason: unknown) => {
          if (!alive) return
          setReport({
            ok: false,
            issues: [reason instanceof Error ? reason.message : '没能校验牌组'],
            load: 0,
          })
        },
      )
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [build])

  const cards = useMemo(() => catalog?.cards.filter((card) => card.rarity.length > 0) ?? [], [catalog])
  const full = Boolean(build && build.slots.every((slot) => slot !== null))

  return (
    <main className="pcd-deck">
      <header className="pcd-deck__bar">
        <button type="button" onClick={onBack}>返回</button>
        <h1>构筑</h1>
        <p>{report ? `负荷 ${report.load}` : '正在核对'}</p>
      </header>
      {error ? <p className="pcd-deck__alert" role="alert">{error}</p> : null}
      {!catalog || !build ? <p className="pcd-deck__alert">正在读取牌表…</p> : (
        <div className="pcd-deck__body">
          <section className="pcd-deck__slots" aria-label="牌组">
            <ol>
              {build.slots.map((slot, index) => {
                const card = slot ? catalog.cards.find((item) => item.id === slot.cardId) : undefined
                const back = slot?.backId ? catalog.backs.find((item) => item.id === slot.backId) : undefined
                return (
                  <li key={index}>
                    <span className="pcd-back" aria-hidden="true">
                      <i />
                      <b>{back?.name ?? '无'}</b>
                    </span>
                    <div>
                      <strong>{card?.name ?? '空位'}</strong>
                      {slot ? (
                        <label>
                          卡背
                          <select
                            value={slot.backId}
                            aria-label={`${card?.name ?? '这张牌'}的卡背`}
                            onChange={(event) => setBuild(setBack(build, index, event.target.value))}
                          >
                            <option value="">无卡背</option>
                            {catalog.backs.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </label>
                      ) : <span>从右边放进来</span>}
                    </div>
                    <button type="button" disabled={!slot} onClick={() => setBuild(clearSlot(build, index))}>移出</button>
                  </li>
                )
              })}
            </ol>
            {report && report.issues.length > 0 ? (
              <ul className="pcd-deck__issues" role="alert">
                {report.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            ) : <p className="pcd-deck__ok">{report?.ok ? '这套牌可以进局。' : ''}</p>}
          </section>
          <section className="pcd-deck__library" aria-label="牌库">
            {SCHOOLS.map((school) => {
              const group = cards.filter((card) => card.school === school.id)
              if (group.length === 0) return null
              return (
                <div key={school.id}>
                  <h2>{school.label}</h2>
                  <ul>
                    {group.map((card) => (
                      <li key={card.id}>
                        <button type="button" disabled={full} onClick={() => setBuild(placeCard(build, card.id))}>
                          <b>{card.name}</b>
                          <span>{card.points}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </section>
        </div>
      )}
    </main>
  )
}
