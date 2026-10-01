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

export type CardDefinition = {
  id: string
  name: string
  power: number
  description: string
  art: CardArtConfig
  /** Name painted on the geometric back. */
  backLabel?: string
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
  /** The kernel is not offering a hand play, so the table refuses card clicks. */
  openingTurn: boolean
  board: BoardCell[]
  player: SideState
  monster: SideState
  result: MatchResult | null
  message: string
  /** Cards both sides saw leave the board. Covered cards buried under them count too. */
  graveyard: CardInstance[]
}

export type PlayCardAction = {
  side: Side
  cardInstanceId: string
  cellId: CellId
}

export type CoverBeat = {
  cellId: CellId
  cardInstanceId: string
  fromPower: number
  subtract: number
  toPower: number
}

export type DepartingCard = {
  cellId: CellId
  card: CardInstance
}

export type PlayResolution = {
  cover?: CoverBeat
  removed: DepartingCard[]
}

export type PlayResult = { state: MatchState; error?: string; resolution?: PlayResolution }
