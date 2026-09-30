import { presentCards } from '../config/cardCatalog'
import { createBoard } from '../game/core/spatial'
import type { CardDefinition, CardInstance, CellId, MatchState } from '../game/types'
import type { MonsterTelegraph } from '../stores/gameStore'
import { sceneCell } from '../game/v6/view/battle/project'
import { instanceKey, intentKey } from './ids'
import type { PcdCatalog, PcdView, PcdViewCard } from './types'

const BACK_ID = 'pcd-back'
const playerArt = { front: '/card/Hero-front.png', back: '/card/Hero-back.png' }
const monsterArt = { front: '/card/Monster-front-1.png', back: '/card/Monster-back.png' }

export type ProjectedPool = {
  owner: string
  id: string
  name: string
  amount: number
}

export type ProjectedBattle = {
  match: MatchState
  telegraph?: MonsterTelegraph
  faces: CardDefinition[]
  pools: ProjectedPool[]
  polluted: CellId[]
  deckCount: number
  playerDiscard: number
  monsterDiscard: number
  intentName: string | null
  playerPoints: number
  monsterPoints: number
}

export function projectBattle(input: {
  view: PcdView
  catalog: PcdCatalog
  monsterId: string
  turn: 'player' | 'monster'
  /** Hide this board instance while its flyer is still in the air. */
  concealInstance?: string
  /** Keep the intent card off the table after it has flown in. */
  hideIntent?: boolean
  monsterCell?: number
  telegraphId?: string
}): ProjectedBattle {
  const { view, catalog } = input
  const board = createBoard()
  const faces: CardDefinition[] = []
  for (const cell of view.cells) {
    const slot = board[cell.cell - 1]
    if (!slot || !cell.card) continue
    const instanceId = instanceKey(cell.card.instance)
    if (instanceId === input.concealInstance) continue
    slot.card = toInstance(cell.card)
    faces.push(faceFor(catalog, instanceId, cell.card.cardId, cell.card.currentPoints, cell.card.owner))
  }
  const hand = view.hand.map((card) => {
    const instance = toInstance(card)
    faces.push(faceFor(catalog, instance.cardId, card.cardId, card.currentPoints, 'player'))
    return instance
  })
  const winner = view.winner === 'player' || view.winner === 'monster' || view.winner === 'draw' ? view.winner : null
  const info = view.revealedIntent ? catalog.cards.find((card) => card.id === view.revealedIntent) : undefined
  let telegraph: MonsterTelegraph | undefined
  if (!winner && view.revealedIntent && !input.hideIntent) {
    const id = input.telegraphId ?? intentKey(view.intentIndex, view.revealedIntent)
    const cardId = input.telegraphId ? (info?.id ?? view.revealedIntent) : view.revealedIntent
    telegraph = {
      card: {
        instanceId: id,
        cardId: id,
        owner: 'monster',
        currentPower: info?.points ?? 0,
      },
      cellId: input.monsterCell ? sceneCell(asCell(input.monsterCell)) : undefined,
    }
    faces.push(faceFor(catalog, id, cardId, info?.points ?? 0, 'monster'))
  }
  faces.push({
    id: BACK_ID,
    name: '牌库',
    power: 0,
    description: '',
    effect: { type: 'none' },
    art: playerArt,
  })
  const match: MatchState = {
    levelId: input.monsterId,
    monsterId: input.monsterId,
    turn: input.turn,
    round: view.round,
    status: winner ? 'finished' : 'playing',
    finalBattle: false,
    openingTurn: false,
    board,
    player: {
      deck: Array.from({ length: view.matchDeckCount }, (_, index) => ({
        instanceId: `pcd-deck-${index}`,
        cardId: BACK_ID,
        owner: 'player',
        currentPower: 0,
      })),
      hand,
      turnsTaken: 0,
    },
    monster: { deck: [], hand: [], turnsTaken: 0 },
    result: winner
      ? { winner, playerPower: view.playerPoints, monsterPower: view.monsterPoints }
      : null,
    message: '',
    graveyard: [],
  }
  return {
    match,
    telegraph,
    faces,
    pools: view.pools.map((pool) => ({
      owner: pool.owner,
      id: pool.id,
      amount: pool.amount,
      name: catalog.resources.find((resource) => resource.id === pool.id)?.name ?? pool.id,
    })),
    polluted: view.cells.filter((cell) => cell.polluted).map((cell) => sceneCell(asCell(cell.cell))),
    deckCount: view.matchDeckCount,
    playerDiscard: view.playerDiscardCount,
    monsterDiscard: view.monsterDiscardCount,
    intentName: info?.name ?? view.revealedIntent,
    playerPoints: view.playerPoints,
    monsterPoints: view.monsterPoints,
  }
}

export function publishProjection(projected: ProjectedBattle) {
  presentCards(projected.faces)
}

function toInstance(card: PcdViewCard): CardInstance {
  const id = instanceKey(card.instance)
  return {
    instanceId: id,
    cardId: id,
    owner: card.owner === 'player' ? 'player' : 'monster',
    currentPower: card.currentPoints,
  }
}

function faceFor(catalog: PcdCatalog, id: string, cardId: string, power: number, owner: string): CardDefinition {
  const info = catalog.cards.find((card) => card.id === cardId)
  return {
    id,
    name: info?.name ?? cardId,
    power,
    description: info?.text ?? '',
    effect: { type: 'none' },
    art: owner === 'player' ? playerArt : monsterArt,
  }
}

function asCell(cell: number) {
  return cell as Parameters<typeof sceneCell>[0]
}
