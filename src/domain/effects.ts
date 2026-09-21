/**
 * 时机列表上的动作闭集。引擎每种实现一次，卡表只引用这些 op。
 */

export type Timing = 'play' | 'enter' | 'leave' | 'turnStart' | 'turnEnd' | 'timer' | 'active' | 'onCover'

export type Sel =
  | 'self'
  | 'chosen'
  | 'chosen2'
  | 'allAllies'
  | 'allEnemies'
  | 'otherAllies'
  | 'adjacentEnemies'
  | 'adjacentAllies'
  | 'adjacent'
  | 'markedEnemies'
  | 'mirrorOccupant'
  | 'playerAvatar'
  | 'lowestCell'

export type Amt =
  | number
  | 'discardCount*2'
  | 'occupyDiscardCount'
  | 'markedCount'
  | 'chosenAdjAllies*2'
  | 'sacrificeBaseSum'
  | 'resSpent*2'
  | 'adjacentEnemiesToSelf'
  | 'halfChosenCurrent'

export type Op =
  | { op: 'mark'; sel: Sel; one?: boolean }
  | { op: 'unmark'; sel: Sel; one?: boolean }
  | { op: 'damage'; sel: Sel; n: Amt; ifMarked?: { n: Amt; unmark?: boolean }; one?: boolean }
  | { op: 'buff'; sel: Sel; n: Amt; one?: boolean }
  | { op: 'status'; sel: Sel; status: 'vulnerable' | 'protected' | 'rebirth' | 'sealed'; one?: boolean }
  | { op: 'remove'; sel: Sel; maxPoints?: number; one?: boolean }
  | { op: 'draw'; n: number }
  | { op: 'gainRes'; n: number }
  | { op: 'spawnCopyAtMirror'; link: boolean }
  | { op: 'shuffleCopyToDeck' }
  | { op: 'shuffleSelfToDeck' }
  | { op: 'shuffleDiscardToDeck' }
  | { op: 'discardToHand' }
  | { op: 'spawnHalfCopy' }
  | { op: 'moveTowardAvatar'; cover?: boolean; pokeIfAdjacent?: boolean }
  | { op: 'moveColumn' }
  | { op: 'moveRowRandom' }
  | { op: 'moveChosenAdjacent' }
  | { op: 'swapChosen' }
  | { op: 'resetChosen' }
  | { op: 'gold'; n: number }
  | { op: 'burn' }
  | { op: 'spawnAdjacent'; defId: string; max: number }
  | { op: 'removeAdjacentDef'; defId: string }
  | { op: 'pollute'; defId: string }
  | { op: 'nibbleHandOccupy'; n: number }
  | { op: 'sealHighestAdjacentOpponent' }
  | { op: 'transferMark' }
  | { op: 'markOrDraw' }
  | { op: 'buffDifferentAlliesByRes' }
  | { op: 'ifResAtLeast'; n: number; then: Op[]; else: Op[] }
  | { op: 'ifDeckAtMost'; n: number; then: Op[]; else: Op[] }
  | { op: 'ifAdjacentMarked'; then: Op[] }
  | { op: 'ifCorner'; then: Op[] }
  | { op: 'n06Tax' }
  | { op: 'deckThick'; ge: number; plus: number; minus: number }
  | { op: 'coverFeed'; n: number }
  | { op: 'spellFeed'; n: number }
  | { op: 'leaveAdjSwing'; enemy: number; ally: number }
  | { op: 'selfMinusThenSpawn'; minus: number; defId: string }
  | { op: 'timerBlast'; adj: number; self: number }

export interface CardEffect {
  timing: Timing
  sacrifice?: number
  spendRes?: number
  spendResUpTo?: number
  spendResAll?: number
  ops: Op[]
}

export type AuraKind =
  | { aura: 'adjacentAllies'; n: number }
  | { aura: 'mirrorAlly'; n: number }
  | { aura: 'columnOpponents'; n: number }
  | { aura: 'rowOpponents'; n: number }
  | { aura: 'diagOpponents'; n: number }
  | { aura: 'mirrorOpponentCurrent' }
  | { aura: 'perAdjacentOpponent'; n: number }
  | { aura: 'fence' }
  | { aura: 'blockMarkedMove' }

export function needsChosen(effects: CardEffect[]): boolean {
  return effects.some((e) =>
    e.ops.some((op) => opNeedsChosen(op)),
  )
}

function opNeedsChosen(op: Op): boolean {
  if ('sel' in op && (op.sel === 'chosen' || op.sel === 'chosen2')) return true
  if (op.op === 'discardToHand' || op.op === 'spawnHalfCopy' || op.op === 'swapChosen' || op.op === 'resetChosen' || op.op === 'moveChosenAdjacent' || op.op === 'transferMark' || op.op === 'markOrDraw') {
    return true
  }
  if (op.op === 'ifResAtLeast' || op.op === 'ifDeckAtMost' || op.op === 'ifAdjacentMarked' || op.op === 'ifCorner') {
    return [...('then' in op ? op.then : []), ...('else' in op ? op.else ?? [] : [])].some(opNeedsChosen)
  }
  return false
}
