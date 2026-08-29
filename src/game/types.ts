export type CellId = `cell-${number}-${number}`
export type CameraMode = 'board' | 'hand' | 'overview'
export type Side = 'player' | 'monster'
export type MatchStatus = 'playing' | 'finished'

export type CardArtConfig = {
  front: string
  back: string
  rune?: string
  frameVariant?: string
}

export type CardEffect =
  | { type: 'none' }
  | { type: 'self_power_if_position'; condition: 'edge' | 'adjacent_friendly' | 'adjacent_enemy'; amount: number }
  | { type: 'adjacent_power_change'; target: 'friendly' | 'enemy'; amount: number }
  | { type: 'self_power_on_cover'; amount: number }

export type CardDefinition = {
  id: string
  name: string
  power: number
  description: string
  effect: CardEffect
  art: CardArtConfig
}

export type CardInstance = {
  instanceId: string
  cardId: string
  owner: Side
  currentPower: number
}

export type BoardCell = {
  id: CellId
  row: number
  col: number
  card: CardInstance | null
  coveredCards: CardInstance[]
}

export type SideState = {
  deck: CardInstance[]
  hand: CardInstance[]
  turnsTaken: number
}

export type MatchResult = {
  winner: Side | 'draw'
  playerPower: number
  monsterPower: number
}

export type MatchState = {
  levelId: string
  monsterId: string
  turn: Side
  round: number
  status: MatchStatus
  board: BoardCell[]
  player: SideState
  monster: SideState
  result: MatchResult | null
  message: string
}

export type PlayCardAction = {
  side: Side
  cardInstanceId: string
  cellId: CellId
}

export type PlayResult = { state: MatchState; error?: string }
