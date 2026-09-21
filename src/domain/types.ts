/** 现行设计用语。残响四节点、压迫、领先撑一轮不在这里。 */

export type Side = 'player' | 'enemy'
export type CardKind = 'occupy' | 'spell' | 'avatar'
export type Zone = 'hand' | 'board' | 'deck' | 'discard' | 'gone'
export type CardStatus = 'sealed' | 'marked' | 'vulnerable' | 'protected' | 'rebirth'
export type Screen =
  | 'map'
  | 'battle'
  | 'event'
  | 'reward'
  | 'shop'
  | 'rest'
  | 'forge'
  | 'chest'
  | 'over'
export type BattlePhase = 'play' | 'over'
export type BattleOutcome = 'win' | 'lose'
export type SettleReason = 'lead' | 'clear' | 'avatarGone' | 'noPlay'
export type RemoveReason = 'cover' | 'effect' | 'tie' | 'stack' | 'link'
export type RemoveTo = 'discard' | 'hand' | 'deck' | 'gone'
export type RunResult = 'victory' | 'defeat'
export type SchoolId = 'SYS.A' | 'SYS.B' | 'SYS.C' | 'neutral'
export type Rarity = 'basic' | 'white' | 'blue' | 'gold'
export type DeckId = 'DK.A' | 'DK.B' | 'DK.C'
export type NodeType = 'normal' | 'elite' | 'boss' | 'event' | 'shop' | 'chest' | 'rest' | 'forge' | 'nextFloor'
export type EncounterId = string
export type FloorId = 1 | 2 | 3

export interface Coord {
  x: number
  y: number
}

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  normal: '普通',
  elite: '精英',
  boss: 'BOSS',
  event: '事件',
  shop: '商店',
  chest: '宝箱',
  rest: '疗养',
  forge: '锻造',
  nextFloor: '下层',
}

export const DECK_IDS: DeckId[] = ['DK.A', 'DK.B', 'DK.C']

export function isBodyKind(kind: CardKind): boolean {
  return kind === 'occupy' || kind === 'avatar'
}

export function coordKey(c: Coord): string {
  return `${c.x},${c.y}`
}

export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export const ORTHO: Coord[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]
