/** JSON shapes from Pcd.DevHost. Names follow the camelCase serializer. */

export type PcdCardInfo = {
  id: string
  name: string
  isSpell: boolean
  points: number
  load: number
  rarity: string
  school: string
  text: string
}

export type PcdCatalog = {
  contentHash: string
  cards: PcdCardInfo[]
  backs: Array<{ id: string; name: string; load: number; points?: number; cap?: number; isBack: boolean; text: string }>
  monsters: Array<{ id: string; name: string; starting: unknown; intents: string[]; skills: string[] | null }>
  decks: Array<{ id: string; name: string; cards: string[]; load: number }>
  statuses: Array<{ id: string; name: string }>
  resources: Array<{ id: string; name: string }>
}

export type PcdViewCard = {
  instance: number
  cardId: string
  owner: string
  zone: string
  cell: number
  basePoints: number
  currentPoints: number
  cardBackId?: string | null
  modifierCount: number
  isSpell: boolean
  timer: number
  statuses: string[]
}

export type PcdViewCell = {
  cell: number
  polluted: boolean
  card: PcdViewCard | null
}

export type PcdPool = {
  owner: string
  id: string
  amount: number
}

export type PcdView = {
  audience: string
  phase: string
  round: number
  remainingOpportunities: number
  revealedIntent: string | null
  intentIndex: number
  intentMode: string
  committedCell: number
  committedTarget: number
  intents: string[]
  unseen: string[]
  playerPoints: number
  monsterPoints: number
  playerOccupancy: number
  monsterOccupancy: number
  handCount: number
  matchDeckCount: number
  playerDiscardCount: number
  monsterDiscardCount: number
  pools: PcdPool[]
  winner: string | null
  endReason: string | null
  cells: PcdViewCell[]
  hand: PcdViewCard[]
  matchDeck: PcdViewCard[]
  playerDiscard: PcdViewCard[]
  monsterDiscard: PcdViewCard[]
  playerVoid: PcdViewCard[]
  monsterVoid: PcdViewCard[]
  cards: PcdViewCard[]
  instanceHighWater: number
}

export type PcdOption = {
  id: string
  kind: string
  instance: number
  cell: number
  cardId: string | null
}

export type PcdDecision = {
  id: number
  actor: string
  type: string
  ability: string | null
  options: PcdOption[]
}

export type PcdResult = {
  winner: string
  reason: string
  rounds: number
  playerPoints: number
  monsterPoints: number
  playerOccupancy: number
  monsterOccupancy: number
}

export type PcdEvent = {
  seq?: number
  type: string
  cause?: string[]
  card?: string | null
  instance?: number | null
  owner?: string | null
  cell?: number | null
  zone?: string | null
  reason?: string | null
  source?: string | null
  before?: number | null
  after?: number | null
  winner?: string | null
  index?: number | null
  round?: number | null
  points?: number | null
}

export type PcdStep = {
  view: PcdView
  pending: PcdDecision | null
  result: PcdResult | null
  events: PcdEvent[]
}

export type PcdDeckReport = {
  ok: boolean
  issues: string[]
  load: number
}

export type PcdAdvance = {
  view: PcdView
  pending: PcdDecision | null
  result: PcdResult | null
  events: PcdEvent[]
  snapshot: string
  replay: string
  hash: string
  steps: PcdStep[]
}
