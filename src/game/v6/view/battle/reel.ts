import type { BattleState, CellId, EffectCue } from '../../rules'

export type BadgeFlag = 'protect' | 'analyzed' | 'sealed' | 'revive'

export type Suppress = { id: string; flag: BadgeFlag }

export type LiveBadge = {
  id: string
  cell: CellId
  protect: boolean
  analyzed: boolean
  sealed: boolean
  revive: boolean
}

const FLAGS: BadgeFlag[] = ['protect', 'analyzed', 'sealed', 'revive']

export function boardBadges(battle: BattleState): LiveBadge[] {
  const badges: LiveBadge[] = []
  for (const cell of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const id = battle.cells[cell]
    const card = id ? battle.instances[id] : undefined
    if (!id || !card) continue
    if (!card.protected && !card.analyzed && !card.sealed && !card.revive) continue
    badges.push({
      id,
      cell,
      protect: card.protected,
      analyzed: card.analyzed,
      sealed: card.sealed,
      revive: card.revive,
    })
  }
  return badges
}

/** Flags that became true in this resolution. Hold them until their picture starts. */
export function gainedSuppress(before: BattleState, after: BattleState): Suppress[] {
  const list: Suppress[] = []
  for (const card of Object.values(after.instances)) {
    if (card.zone !== 'board') continue
    const prev = before.instances[card.instanceId]
    for (const flag of FLAGS) {
      const now = flag === 'analyzed' ? card.analyzed : card[flag]
      const was = prev ? (flag === 'analyzed' ? prev.analyzed : prev[flag]) : false
      if (now && !was) list.push({ id: card.instanceId, flag })
    }
  }
  return list
}

export function revealedBy(cue: EffectCue): Suppress | null {
  if (!cue.targetId) return null
  if (cue.kind === 'protect') return { id: cue.targetId, flag: 'protect' }
  if (cue.kind === 'mark') return { id: cue.targetId, flag: 'analyzed' }
  if (cue.kind === 'seal') return { id: cue.targetId, flag: 'sealed' }
  if (cue.kind === 'revive') return { id: cue.targetId, flag: 'revive' }
  return null
}

/**
 * Cards that must stay off the board until their own picture.
 * The player card that is landing right now stays visible. The draw that is
 * happening right now stays visible so the hand can carry it up from the deck.
 */
export function concealedIds(battle: BattleState, cues: readonly EffectCue[]): string[] {
  const hidden: string[] = []
  cues.forEach((cue, index) => {
    if (!cue.targetId) return
    const lead = index === 0
    if (cue.kind === 'spawn') hidden.push(cue.targetId)
    if (cue.kind === 'arrive' && !(lead && cue.owner === 'player')) hidden.push(cue.targetId)
    if (lead && (cue.kind === 'draw' || cue.kind === 'search' || cue.kind === 'sacrifice')) return
    if (cue.kind === 'draw' || cue.kind === 'search') hidden.push(cue.targetId)
    if (cue.kind === 'sacrifice' && battle.instances[cue.targetId]?.zone === 'hand') hidden.push(cue.targetId)
  })
  return hidden
}
