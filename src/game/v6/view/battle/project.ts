import { presentCards } from '../../../../config/cardCatalog'
import { monsters, scenes, type MonsterConfig, type SceneConfig } from '../../../../config/gameContent'
import { cellId, createBoard, getCell } from '../../../../game/core/spatial'
import type { CardDefinition as FaceCard, CardInstance, CellId as SceneCellId, MatchState } from '../../../../game/types'
import type { MonsterTelegraph } from '../../../../stores/gameStore'
import { getCardByName } from '../../content'
import { currentPoints, type BattleState, type CellId } from '../../rules'
import type { MatchState as TurnMatch } from '../../turn'

const RULE_CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export interface BoardArrival {
  instanceId: string
  cell: CellId
  definitionId: string
}

export interface IntentPreview {
  instanceId: string
  definitionId: string
  power: number
  name: string
}

export function sceneCell(cell: CellId): SceneCellId {
  const index = cell - 1
  return cellId(Math.floor(index / 3), index % 3)
}

export function ruleCell(id: SceneCellId): CellId {
  const { row, col } = getCell(id)
  const value = row * 3 + col + 1
  if (value < 1 || value > 9) throw new Error(`Bad cell ${id}`)
  return value as CellId
}

export function openingLay(battle: BattleState): BoardArrival[] {
  const laid: BoardArrival[] = []
  for (const cell of RULE_CELLS) {
    const id = battle.cells[cell]
    const card = id ? battle.instances[id] : undefined
    if (!id || !card || card.owner !== 'enemy') continue
    laid.push({ instanceId: id, cell, definitionId: card.definitionId })
  }
  return laid
}

export function boardArrivals(before: BattleState, after: BattleState): BoardArrival[] {
  const prior = new Set<string>()
  for (const cell of RULE_CELLS) {
    const id = before.cells[cell]
    if (id) prior.add(id)
  }
  const arrived: BoardArrival[] = []
  for (const cell of RULE_CELLS) {
    const id = after.cells[cell]
    const card = id ? after.instances[id] : undefined
    if (!id || !card || prior.has(id)) continue
    arrived.push({ instanceId: id, cell, definitionId: card.definitionId })
  }
  return arrived
}

export function buriedUnder(before: BattleState, after: BattleState, cell: CellId): string | null {
  const previous = before.cells[cell]
  const next = after.cells[cell]
  if (!previous || previous === next) return null
  if (!after.instances[previous]) return null
  return previous
}

export function arrivalTelegraph(battle: BattleState, arrival: BoardArrival, withCell: boolean): MonsterTelegraph {
  return {
    card: {
      instanceId: arrival.instanceId,
      cardId: arrival.instanceId,
      owner: 'monster',
      currentPower: battle.instances[arrival.instanceId] ? currentPoints(battle, arrival.instanceId) : 0,
    },
    cellId: withCell ? sceneCell(arrival.cell) : undefined,
  }
}

export function intentPreview(match: TurnMatch): IntentPreview | null {
  if (!match.revealed || match.over) return null
  return {
    instanceId: `intent:${match.intentIndex}:${match.revealed.definitionId}`,
    definitionId: match.revealed.definitionId,
    power: match.revealed.basePoints ?? 0,
    name: match.revealed.name,
  }
}

export function projectMatch(input: {
  battle: BattleState
  monsterId: string
  hidden?: ReadonlySet<string>
  turn: 'player' | 'monster'
  openingTurn?: boolean
  over: boolean
  winner: 'player' | 'enemy' | null
  buried?: { cell: CellId; instanceId: string } | null
}): MatchState {
  const hidden = input.hidden ?? new Set<string>()
  const board = createBoard()
  for (const cell of RULE_CELLS) {
    const slot = board[cell - 1]
    const id = input.battle.cells[cell]
    if (!id || hidden.has(id) || !input.battle.instances[id]) continue
    slot.card = toCard(input.battle, id)
    const buried = input.buried
    if (buried && buried.cell === cell && buried.instanceId !== id && input.battle.instances[buried.instanceId]) {
      slot.coveredCards = [toCard(input.battle, buried.instanceId)]
    }
  }
  const finished = input.over
  return {
    levelId: input.monsterId,
    monsterId: input.monsterId,
    turn: input.turn,
    round: 1,
    status: finished ? 'finished' : 'playing',
    finalBattle: false,
    openingTurn: Boolean(input.openingTurn),
    board,
    player: {
      deck: input.battle.deck.flatMap((id) => (input.battle.instances[id] ? [toCard(input.battle, id)] : [])),
      hand: input.battle.hand.flatMap((id) => (input.battle.instances[id] ? [toCard(input.battle, id)] : [])),
      turnsTaken: 0,
    },
    monster: { deck: [], hand: [], turnsTaken: 0 },
    result: finished && input.winner
      ? {
          winner: input.winner === 'player' ? 'player' : 'monster',
          playerPower: score(input.battle, 'player', hidden),
          monsterPower: score(input.battle, 'enemy', hidden),
        }
      : null,
    message: '',
    graveyard: input.battle.discard.flatMap((id) => (input.battle.instances[id] ? [toCard(input.battle, id)] : [])),
  }
}

export function publishFaces(battles: readonly BattleState[], previews: readonly IntentPreview[] = []) {
  const faces = new Map<string, FaceCard>()
  for (const battle of battles) {
    for (const card of Object.values(battle.instances)) {
      faces.set(card.instanceId, faceFor(battle, card.instanceId, card.definitionId, card.analyzed, card.sealed))
    }
  }
  for (const preview of previews) {
    const battle = battles.find((item) => item.definitions[preview.definitionId]) ?? battles[0]
    if (!battle) continue
    faces.set(preview.instanceId, faceFor(battle, preview.instanceId, preview.definitionId, false, false))
  }
  presentCards([...faces.values()])
}

export function monsterScene(monsterId: string, name: string): { monster: MonsterConfig; scene: SceneConfig } {
  return {
    monster: {
      id: monsterId,
      name,
      image: monsters.svarbhanu.image,
      visual: monsters.svarbhanu.visual,
    },
    scene: scenes.default,
  }
}

function score(battle: BattleState, owner: 'player' | 'enemy', hidden: ReadonlySet<string>) {
  let total = 0
  for (const cell of RULE_CELLS) {
    const id = battle.cells[cell]
    const card = id ? battle.instances[id] : undefined
    if (!id || !card || hidden.has(id) || card.owner !== owner || card.sealed) continue
    total += currentPoints(battle, id)
  }
  return total
}

function toCard(battle: BattleState, id: string): CardInstance {
  const card = battle.instances[id]
  return {
    instanceId: id,
    cardId: id,
    owner: card.owner === 'player' ? 'player' : 'monster',
    currentPower: card.sealed ? 0 : currentPoints(battle, id),
  }
}

function faceFor(battle: BattleState, id: string, definitionId: string, analyzed: boolean, sealed: boolean): FaceCard {
  const definition = battle.definitions[definitionId]
  const name = definition?.name ?? definitionId
  const marks = [analyzed ? '已解析' : '', sealed ? '封印' : ''].filter(Boolean)
  const effect = getCardByName(name)?.effectText ?? ''
  return {
    id,
    name,
    power: definition?.basePoints ?? 0,
    description: [effect, marks.join(' ')].filter(Boolean).join(' '),
    effect: { type: 'none' },
    art: { front: '', back: '' },
  }
}
