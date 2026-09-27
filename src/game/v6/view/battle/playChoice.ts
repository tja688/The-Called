import {
  boardInstanceIds,
  cardsInZone,
  inspectPlay,
  legalPlayTargets,
  type BattleState,
  type CellId,
  type Opcode,
  type PlayRequest,
  type Side,
} from '../../rules'

export interface PlayTargetOption {
  instanceId: string
  name: string
  zone: 'board' | 'deck'
  cell: CellId | null
  owner: Side
  basePoints: number | null
}

export interface PlayChoiceView {
  /** The engine rejects this spell. Do not send the play. */
  blocked: boolean
  /** The card asked for a pick and the engine found none. Field cards and a search with no match can still be played. */
  skipped: boolean
  placement: 'cell' | 'confirm'
  limit: number
  from: 'board' | 'deck' | null
  targets: PlayTargetOption[]
}

export type ChoiceStep =
  | { kind: 'choose'; targetIds: string[] }
  | { kind: 'play'; request: PlayRequest }
  | { kind: 'wait'; message: string }

export function readPlayChoice(state: BattleState, instanceId: string): PlayChoiceView {
  const card = state.instances[instanceId]
  const definition = card ? state.definitions[card.definitionId] : undefined
  if (!card || !definition || !state.hand.includes(instanceId)) {
    return blank({ blocked: true, placement: 'confirm' })
  }
  if (definition.ruleType === 'spell') return spellChoice(state, instanceId, definition.effects ?? [], definition.spellTarget !== undefined)
  const legal = legalPlayTargets(state, instanceId)
  if (!legal) return blank({ blocked: false, placement: 'cell' })
  const targets = legal.flatMap((id) => boardOption(state, id))
  if (targets.length === 0) return blank({ blocked: false, skipped: true, placement: 'cell' })
  return {
    blocked: false,
    skipped: false,
    placement: 'cell',
    limit: definition.playTargetCount ?? 1,
    from: 'board',
    targets,
  }
}

export function togglePlayTargets(selected: readonly string[], instanceId: string, limit: number): string[] {
  if (selected.includes(instanceId)) return selected.filter((id) => id !== instanceId)
  if (limit <= 0 || selected.length >= limit) return [...selected]
  return [...selected, instanceId]
}

export function actOnCell(input: {
  instanceId: string
  choice: PlayChoiceView
  selected: readonly string[]
  cell: CellId
  occupantId: string | null
}): ChoiceStep {
  if (input.choice.blocked) return { kind: 'wait', message: '这张法术现在不能打出' }
  const occupant = input.occupantId
  const room =
    input.choice.from === 'board' &&
    occupant !== null &&
    input.choice.targets.some((target) => target.instanceId === occupant) &&
    !input.selected.includes(occupant) &&
    input.selected.length < input.choice.limit
  if (room && occupant) {
    const targetIds = togglePlayTargets(input.selected, occupant, input.choice.limit)
    if (input.choice.placement === 'confirm' && input.choice.limit > 0 && targetIds.length >= input.choice.limit) {
      const request = playRequestFromChoice({
        instanceId: input.instanceId,
        choice: input.choice,
        selected: targetIds,
      })
      if (request) return { kind: 'play', request }
    }
    return { kind: 'choose', targetIds }
  }
  if (input.choice.placement === 'confirm') {
    return { kind: 'wait', message: input.choice.targets.length > 0 ? '先点场上的那张牌' : '这张法术不占格' }
  }
  if (input.choice.targets.length > 0 && input.selected.length === 0) return { kind: 'wait', message: '先选择目标' }
  const request = playRequestFromChoice(input)
  if (!request) return { kind: 'wait', message: '先选择目标' }
  return { kind: 'play', request }
}

export function actOnConfirm(input: {
  instanceId: string
  choice: PlayChoiceView
  selected: readonly string[]
}): ChoiceStep {
  if (input.choice.placement !== 'confirm') return { kind: 'wait', message: '再点一个格子放入' }
  if (input.choice.blocked) return { kind: 'wait', message: '这张法术现在不能打出' }
  if (input.choice.targets.length > 0 && pickedIds(input.choice, input.selected).length === 0) {
    return { kind: 'wait', message: '先选择目标' }
  }
  const request = playRequestFromChoice(input)
  if (!request) return { kind: 'wait', message: '先选择目标' }
  return { kind: 'play', request }
}

export function playRequestFromChoice(input: {
  instanceId: string
  choice: PlayChoiceView
  selected: readonly string[]
  cell?: CellId
}): PlayRequest | null {
  if (input.choice.blocked) return null
  const picked = pickedIds(input.choice, input.selected)
  if (input.choice.targets.length > 0 && picked.length === 0) return null
  if (input.choice.placement === 'cell') {
    if (input.cell === undefined) return null
    return picked.length > 0
      ? { instanceId: input.instanceId, cell: input.cell, choice: { targets: picked } }
      : { instanceId: input.instanceId, cell: input.cell }
  }
  return picked.length > 0
    ? { instanceId: input.instanceId, choice: { targets: picked } }
    : { instanceId: input.instanceId }
}

function spellChoice(state: BattleState, instanceId: string, effects: readonly Opcode[], hasSpellTarget: boolean): PlayChoiceView {
  const bare = inspectPlay(state, { instanceId })
  if (hasSpellTarget && bare !== null) {
    const legal = boardInstanceIds(state).filter(
      (id) => inspectPlay(state, { instanceId, choice: { targets: [id] } }) === null,
    )
    const targets = legal.flatMap((id) => boardOption(state, id))
    if (targets.length === 0) return blank({ blocked: true, placement: 'confirm' })
    return { blocked: false, skipped: false, placement: 'confirm', limit: 1, from: 'board', targets }
  }
  const minBase = searchFloor(effects)
  if (minBase !== null) {
    if (bare !== null) return blank({ blocked: true, placement: 'confirm' })
    const targets = deckFieldAtLeast(state, minBase)
    if (targets.length === 0) return blank({ blocked: false, skipped: true, placement: 'confirm' })
    return { blocked: false, skipped: false, placement: 'confirm', limit: 1, from: 'deck', targets }
  }
  return blank({ blocked: bare !== null, placement: 'confirm' })
}

function searchFloor(opcodes: readonly Opcode[]): number | null {
  for (const opcode of opcodes) {
    if (opcode.op === 'search' && typeof opcode.minBase === 'number') return opcode.minBase
  }
  return null
}

function deckFieldAtLeast(state: BattleState, minBase: number): PlayTargetOption[] {
  const found: PlayTargetOption[] = []
  for (const card of cardsInZone(state, 'deck')) {
    if (card.basePoints === null || card.basePoints < minBase) continue
    const definition = state.definitions[card.definitionId]
    if (!definition || definition.ruleType !== 'field') continue
    found.push({
      instanceId: card.instanceId,
      name: definition.name,
      zone: 'deck',
      cell: null,
      owner: card.owner,
      basePoints: card.basePoints,
    })
  }
  return found
}

function boardOption(state: BattleState, instanceId: string): PlayTargetOption[] {
  const card = state.instances[instanceId]
  if (!card?.cell) return []
  const definition = state.definitions[card.definitionId]
  return [
    {
      instanceId,
      cell: card.cell,
      name: definition?.name ?? card.definitionId,
      zone: 'board',
      owner: card.owner,
      basePoints: card.basePoints,
    },
  ]
}

function pickedIds(choice: PlayChoiceView, selected: readonly string[]): string[] {
  const allowed = new Set(choice.targets.map((target) => target.instanceId))
  const picked: string[] = []
  for (const id of selected) {
    if (!allowed.has(id) || picked.includes(id)) continue
    picked.push(id)
    if (picked.length >= choice.limit) break
  }
  return picked
}

function blank(partial: Pick<PlayChoiceView, 'blocked' | 'placement'> & Partial<Pick<PlayChoiceView, 'skipped'>>): PlayChoiceView {
  return {
    blocked: partial.blocked,
    skipped: partial.skipped ?? false,
    placement: partial.placement,
    limit: 0,
    from: null,
    targets: [],
  }
}
