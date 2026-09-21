/**
 * 固定种子走完第 1 层。
 *   npm run sim -- --seed 1 --deck DK.A
 *   npm run sim -- --write-baseline
 *   npm run sim -- --compare
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GameService } from '../application/GameService'
import type { Cell } from '../domain/geometry'
import type { DomainEvent } from '../core/messages'
import type { DeckId } from '../domain/types'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const seed = Number(flag('--seed') ?? 1)
const deckId = (flag('--deck') ?? 'DK.A') as DeckId
const eventIndex = Number(flag('--event') ?? 0) as 0 | 1 | 2
const rewardArg = flag('--rewards')?.split(',').filter(Boolean) ?? []
const writeBaseline = args.includes('--write-baseline')
const compare = args.includes('--compare')
const baselinePath = resolve(process.cwd(), 'src/tools/baseline.json')

interface BattleSummary {
  encounterId: string
  outcome: string
  reason: string
  turn: number
  avatarCost: number
  player: number
  enemy: number
}

interface SimReport {
  seed: number
  deckId: string
  eventIndex: number
  rewards: string[]
  hp: number
  gold: number
  result?: string
  battles: BattleSummary[]
  eventTypes: string[]
}

async function autoPlayBattle(game: GameService): Promise<void> {
  let guard = 0
  while (guard++ < 120) {
    const view = game.ask({ type: 'battle.view' })
    if (!view || view.result) return
    if (view.mustPlaceAvatar) {
      const av = view.hand.find((id) => view.cards[id].isAvatar)!
      const legal = game.ask({ type: 'battle.legalPlays' }).find((p) => p.card === av)!
      const cell = legal.cells.includes(7) ? 7 : legal.cells.includes(9) ? 9 : legal.cells[0]
      await game.dispatch({ type: 'battle.play', card: av, cell })
      continue
    }
    const acts = game.ask({ type: 'battle.legalActivates' })
    if (acts[0] && view.canActivate && view.turn >= 2) {
      await game.dispatch({ type: 'battle.activate', card: acts[0].card, target: acts[0].targets[0] })
      continue
    }
    const plays = game.ask({ type: 'battle.legalPlays' })
    type Cand = { card: string; cell?: Cell; target?: string; score: number }
    const cands: Cand[] = []
    for (const p of plays) {
      const opts: { cell?: Cell; target?: string }[] = []
      if (p.cells.length) for (const cell of p.cells) opts.push({ cell })
      else if (p.targets.length) for (const target of p.targets) opts.push({ target })
      else opts.push({})
      for (const o of opts) {
        const prev = game.ask({ type: 'battle.previewPlay', card: p.card, cell: o.cell, target: o.target })
        if (!prev) continue
        let score = (prev.player - prev.enemy) * 10 + prev.avatar
        const def = view.cards[p.card]
        if (def?.defId === 'PC.A02') score += 8
        const occ = o.cell ? view.cells[o.cell - 1] : undefined
        const victim = occ?.card ? view.cards[occ.card] : undefined
        if (victim && victim.owner === 'enemy') score += 20
        if (o.cell && !occ?.card) score += 3
        cands.push({ card: p.card, cell: o.cell, target: o.target, score })
      }
    }
    cands.sort((a, b) => b.score - a.score)
    if (view.playerFinal > view.enemyFinal && view.canEndTurn) {
      await game.dispatch({ type: 'battle.endTurn' })
      continue
    }
    if (view.deckLeft === 0 && view.canEndTurn && cands[0]) {
      const rest = view.hand.filter((id) => id !== cands[0].card)
      const costs = rest.map((id) => {
        const def = view.cards[id]
        return def ? game.ask({ type: 'content.card', defId: def.defId }).cost : 99
      })
      const minRest = costs.length ? Math.min(...costs) : 99
      const prev = game.ask({ type: 'battle.previewPlay', card: cands[0].card, cell: cands[0].cell, target: cands[0].target })
      if (prev && prev.occupy < minRest) {
        await game.dispatch({ type: 'battle.endTurn' })
        continue
      }
    }
    if (!cands.length) {
      if (view.canEndTurn) await game.dispatch({ type: 'battle.endTurn' })
      else return
      continue
    }
    const best = cands[0]
    await game.dispatch({ type: 'battle.play', card: best.card, cell: best.cell, target: best.target })
  }
}

function nodeScore(n: { type: string; completed: boolean; lost: boolean; current: boolean; visited: boolean }): number {
  if (n.type === 'nextFloor') return 100
  if (n.type === 'boss' && !n.completed) return 90
  if (n.lost) return 75
  if (n.type === 'shop') return n.current ? 0 : n.visited ? 12 : 72
  if (!n.completed) {
    if (n.type === 'normal') return 80
    if (n.type === 'elite') return 78
    return 70
  }
  return 0
}

function pickNode(game: GameService): string | undefined {
  const run = game.ask({ type: 'run.view' })!
  const adj = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
  type Step = { id: string; first: string; dist: number }
  const start = run.nodes.filter((n) => n.adjacent)
  const q: Step[] = start.map((n) => ({ id: n.id, first: n.id, dist: 1 }))
  const seen = new Set(q.map((s) => s.id))
  let best: { first: string; score: number; dist: number } | undefined
  const consider = (n: (typeof run.nodes)[0], first: string, dist: number) => {
    const score = nodeScore(n)
    if (score <= 0) return
    if (!best || score > best.score || (score === best.score && dist < best.dist)) {
      best = { first, score, dist }
    }
  }
  for (const s of q) consider(run.nodes.find((n) => n.id === s.id)!, s.first, s.dist)
  for (let i = 0; i < q.length; i++) {
    const s = q[i]
    const cur = run.nodes.find((n) => n.id === s.id)!
    for (const n of run.nodes) {
      if (seen.has(n.id) || !adj(cur, n)) continue
      seen.add(n.id)
      q.push({ id: n.id, first: s.first, dist: s.dist + 1 })
      consider(n, s.first, s.dist + 1)
    }
  }
  return best?.first ?? start.find((n) => !n.current)?.id
}

async function runSim(): Promise<SimReport> {
  const game = new GameService()
  await game.dispatch({ type: 'run.start', seed, deckId })
  const picked: string[] = []
  const battles: BattleSummary[] = []
  let guard = 0
  while (guard++ < 160) {
    const run = game.ask({ type: 'run.view' })
    if (!run || run.ended) break
    if (run.screen === 'map') {
      const node = pickNode(game)
      if (!node) break
      await game.dispatch({ type: 'run.enterNode', node })
      continue
    }
    if (run.screen === 'battle') {
      await autoPlayBattle(game)
      const bv = game.ask({ type: 'battle.view' })
      if (bv?.result) {
        battles.push({
          encounterId: bv.encounterId,
          outcome: bv.result.outcome,
          reason: bv.result.reason,
          turn: bv.turn,
          avatarCost: bv.result.avatarCost,
          player: bv.playerFinal,
          enemy: bv.enemyFinal,
        })
        await game.dispatch({ type: 'run.finishFlow' })
      } else break
      continue
    }
    if (run.screen === 'reward') {
      const pool = run.reward!.pool
      const cardId = rewardArg.find((id) => pool.includes(id)) ?? pool[0]
      if (cardId) {
        await game.dispatch({ type: 'run.rewardPick', cardId })
        picked.push(cardId)
      }
      await game.dispatch({ type: 'run.finishFlow' })
      continue
    }
    if (run.screen === 'event') {
      const opt = run.event?.options.find((o) => o.enabled && o.index === eventIndex) ?? run.event?.options.find((o) => o.enabled)
      if (opt) await game.dispatch({ type: 'run.eventOption', index: opt.index, cardUid: run.boxCards[0]?.uid, cardUid2: run.boxCards[1]?.uid })
      const still = game.ask({ type: 'run.view' })
      if (still?.screen === 'event') await game.dispatch({ type: 'run.finishFlow' })
      continue
    }
    if (run.screen === 'shop' || run.screen === 'chest') {
      await game.dispatch({ type: 'run.finishFlow' })
      continue
    }
    if (run.screen === 'rest') {
      await game.dispatch({ type: 'run.restPick', choice: 'heal' })
      await game.dispatch({ type: 'run.finishFlow' })
      continue
    }
    if (run.screen === 'forge') {
      const uid = run.boxCards[0]?.uid
      if (uid) await game.dispatch({ type: 'run.forgeBuff', uid })
      await game.dispatch({ type: 'run.finishFlow' })
      continue
    }
  }
  const run = game.ask({ type: 'run.view' })!
  return {
    seed,
    deckId,
    eventIndex,
    rewards: picked,
    hp: run.hp,
    gold: run.gold,
    result: run.ended,
    battles,
    eventTypes: game.store.all().map((e: DomainEvent) => e.type),
  }
}

function fingerprint(r: SimReport) {
  return {
    seed: r.seed,
    deckId: r.deckId,
    hp: r.hp,
    gold: r.gold,
    result: r.result,
    battles: r.battles,
    eventTypes: r.eventTypes,
  }
}

const report = await runSim()
console.log(JSON.stringify({
  seed: report.seed,
  deckId: report.deckId,
  hp: report.hp,
  gold: report.gold,
  result: report.result,
  rewards: report.rewards,
  battles: report.battles,
  events: report.eventTypes.length,
}, null, 2))

if (writeBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(fingerprint(report), null, 2)}\n`)
  console.log(`wrote ${baselinePath}`)
}

if (compare) {
  const prev = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const now = fingerprint(report)
  if (JSON.stringify(prev) !== JSON.stringify(now)) {
    console.error('sim 基线不一致')
    process.exit(1)
  }
  console.log('sim 基线一致')
}
