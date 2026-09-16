/**
 * 固定种子无头走完四节点。
 *   npm run sim -- --seed 1
 *   npm run sim -- --seed 1 --event 0 --rewards R01,R04
 *   npm run sim -- --write-baseline
 *   npm run sim -- --compare
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GameService } from '../application/GameService'
import { isAdjacent, isCorner, type Cell } from '../domain/geometry'
import type { DomainEvent } from '../core/messages'

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const seed = Number(flag('--seed') ?? 1)
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
  wound: number
  player: number
  enemy: number
}

interface SimReport {
  seed: number
  eventIndex: number
  rewards: string[]
  hp: number
  result?: string
  battles: BattleSummary[]
  eventTypes: string[]
}

function autoAvatarCell(game: GameService): Cell {
  const view = game.ask({ type: 'battle.view' })!
  const plays = game.ask({ type: 'battle.legalPlays' })
  const av = view.hand.find((id) => view.cards[id].isAvatar)!
  const legal = plays.find((p) => p.card === av)!
  const dingRen = Object.values(view.cards).find((c) => c.defId === 'E2A' && c.zone === 'board')
  const scored = legal.cells.map((cell) => {
    const here = cell ? view.cards[view.cells[cell - 1]?.card ?? ''] : undefined
    let score = 0
    if (isCorner(cell)) score += 3
    if (dingRen?.cell && isAdjacent(cell, dingRen.cell)) score -= 8
    if (here && here.currentPoints >= 6) score -= 5
    const preview = game.ask({ type: 'battle.previewPlay', card: av, cell })
    if (preview) score += preview.avatar * 0.1 + (preview.player - preview.enemy) * 0.05
    return { cell, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].cell
}

async function autoPlayBattle(game: GameService): Promise<void> {
  let guard = 0
  while (guard++ < 40) {
    const view = game.ask({ type: 'battle.view' })
    if (!view || view.result) return
    if (view.mustPlaceAvatar) {
      await game.dispatch({ type: 'battle.play', card: view.hand.find((id) => view.cards[id].isAvatar)!, cell: autoAvatarCell(game) })
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
        if (def && (def.defId === 'P07' || def.defId === 'R08') && prev.player > prev.enemy) score += 15
        cands.push({ card: p.card, cell: o.cell, target: o.target, score })
      }
    }
    cands.sort((a, b) => b.score - a.score)
    const leading = view.playerFinal > view.enemyFinal
    if (leading) {
      const seal = cands.find((c) => {
        const d = view.cards[c.card]
        return d && (d.defId === 'P07' || d.defId === 'R08')
      })
      if (seal) {
        await game.dispatch({ type: 'battle.play', card: seal.card, cell: seal.cell, target: seal.target })
        continue
      }
      if (view.canEndTurn) {
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
    if (leading && best.score < (view.playerFinal - view.enemyFinal) * 10 + view.avatar.current + 1 && view.canEndTurn) {
      await game.dispatch({ type: 'battle.endTurn' })
      continue
    }
    await game.dispatch({ type: 'battle.play', card: best.card, cell: best.cell, target: best.target })
  }
}

async function runSim(): Promise<SimReport> {
  const game = new GameService()
  await game.dispatch({ type: 'run.start', seed })
  const picked: string[] = []
  const battles: BattleSummary[] = []

  const walk: Array<'yuZhuang' | 'drawer' | 'boShou' | 'shouMen'> = ['yuZhuang', 'drawer', 'boShou', 'shouMen']
  for (const node of walk) {
    const run = game.ask({ type: 'run.view' })
    if (!run || run.ended) break
    if (!run.availableNodes.includes(node)) break
    await game.dispatch({ type: 'run.enterNode', node })
    const screen = game.ask({ type: 'run.view' })!.screen
    if (screen === 'battle') {
      await autoPlayBattle(game)
      const bv = game.ask({ type: 'battle.view' })
      if (bv?.result) {
        battles.push({
          encounterId: bv.encounterId,
          outcome: bv.result.outcome,
          reason: bv.result.reason,
          turn: bv.turn,
          wound: bv.result.wound,
          player: bv.playerFinal,
          enemy: bv.enemyFinal,
        })
        await game.dispatch({ type: 'run.finishFlow' })
        const after = game.ask({ type: 'run.view' })!
        if (after.screen === 'reward') {
          const pool = after.reward!.pool
          const prefer = rewardArg.find((id) => pool.includes(id))
          const cardId = prefer ?? pool[0]
          await game.dispatch({ type: 'run.rewardPick', cardId })
          picked.push(cardId)
          await game.dispatch({ type: 'run.finishFlow' })
        }
      }
    } else if (screen === 'event') {
      await game.dispatch({ type: 'run.eventOption', index: eventIndex })
      await game.dispatch({ type: 'run.finishFlow' })
    }
  }

  const run = game.ask({ type: 'run.view' })!
  const eventTypes = game.store.all().map((e: DomainEvent) => e.type)
  return {
    seed,
    eventIndex,
    rewards: picked,
    hp: run.hp,
    result: run.ended,
    battles,
    eventTypes,
  }
}

function fingerprint(r: SimReport) {
  return {
    seed: r.seed,
    hp: r.hp,
    result: r.result,
    battles: r.battles,
    eventTypes: r.eventTypes,
  }
}

const report = await runSim()
console.log(JSON.stringify({
  seed: report.seed,
  hp: report.hp,
  result: report.result,
  eventIndex: report.eventIndex,
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
