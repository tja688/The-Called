import { CELL_IDS, CHAIN_DEPTH_LIMIT, HAND_LIMIT, emptyCells, isCellId, mirrorCell, orthogonalNeighbors } from './board';
import { appendCue } from './cues';
import { mixSeed, nextInt } from './rng';
import type {
  EffectCue,
  Aura,
  AuraQuery,
  BattleState,
  CardDefinition,
  CardInstance,
  CardSetup,
  CellId,
  Choice,
  CoverThreshold,
  CreateBattleInput,
  EffectRequest,
  FieldQuery,
  ForceReason,
  ListenerEvent,
  Opcode,
  LeavePrompt,
  PendingEvent,
  PlayRejection,
  PlayRequest,
  PlayResult,
  Reaction,
  RemovalReason,
  RemoveCondition,
  Side,
  TargetSpec,
  TurnEndPrompt,
  TurnEndStep,
  Winner,
  Zone,
} from './types';

const UNIMPLEMENTED = new Set<Opcode['op']>([
  'lookTop',
  'discardToHand',
  'discardToField',
  'shuffleIntoDeck',
  'shuffleCopy',
  'onDrawResolve',
]);

interface ExecCtx {
  selfId: string;
  controller: Side;
  choice: Choice;
  eventSubjectId: string | null;
  /** Cell the event subject entered or left. Null outside a listener. */
  eventCell: CellId | null;
  eachId: string | null;
  lastFaithSpent: number;
}

const OTHER: Record<Side, Side> = { player: 'enemy', enemy: 'player' };

interface LeaveFollowup {
  instanceId: string;
  opcodes: Opcode[];
  ctx: ExecCtx;
  /** The point change had already brought this card to 0. Draw only if it then leaves. */
  becauseZero: boolean;
}

/** Tied to the battle object that queued them. A clone does not inherit the list. */
const leaveFollowups = new WeakMap<BattleState, LeaveFollowup[]>();
/** Player follow-up plays granted while this chain object was resolving. */
const grantedFollowUps = new WeakMap<BattleState, number>();
/** Cell a card last occupied on this chain object, after it has left. */
const vacated = new WeakMap<BattleState, Map<string, CellId>>();

function queueLeaveFollowup(
  state: BattleState,
  instanceId: string,
  opcodes: Opcode[],
  ctx: ExecCtx,
  becauseZero: boolean,
): void {
  const queued = leaveFollowups.get(state) ?? [];
  queued.push({
    instanceId,
    opcodes,
    becauseZero,
    ctx: {
      ...ctx,
      choice: {
        targets: ctx.choice.targets ? [...ctx.choice.targets] : undefined,
        cells: ctx.choice.cells ? [...ctx.choice.cells] : undefined,
        negative: ctx.choice.negative,
        negatives: ctx.choice.negatives ? { ...ctx.choice.negatives } : undefined,
      },
    },
  });
  leaveFollowups.set(state, queued);
}

function flushLeaveFollowups(state: BattleState): void {
  const queued = leaveFollowups.get(state);
  if (!queued || queued.length === 0) return;
  leaveFollowups.delete(state);
  for (const item of queued) {
    if (state.resolutionHalted) return;
    const card = state.instances[item.instanceId];
    if (!item.becauseZero || !card || card.zone === 'board') continue;
    runSegment(state, item.opcodes, item.ctx);
  }
}

interface StayFollowup {
  instanceId: string;
  opcodes: Opcode[];
  ctx: ExecCtx;
}

/** Tied to the battle object that queued them. A clone does not inherit the list. */
const stayFollowups = new WeakMap<BattleState, StayFollowup[]>();

function copyCtx(ctx: ExecCtx): ExecCtx {
  return {
    ...ctx,
    choice: {
      targets: ctx.choice.targets ? [...ctx.choice.targets] : undefined,
      cells: ctx.choice.cells ? [...ctx.choice.cells] : undefined,
      negative: ctx.choice.negative,
      negatives: ctx.choice.negatives ? { ...ctx.choice.negatives } : undefined,
    },
  };
}

function queueStayFollowup(state: BattleState, instanceId: string, opcodes: Opcode[], ctx: ExecCtx): void {
  const queued = stayFollowups.get(state) ?? [];
  queued.push({ instanceId, opcodes, ctx: copyCtx(ctx) });
  stayFollowups.set(state, queued);
}

function flushStayFollowups(state: BattleState): void {
  const queued = stayFollowups.get(state);
  if (!queued || queued.length === 0) return;
  stayFollowups.delete(state);
  for (const item of queued) {
    if (state.resolutionHalted) return;
    const card = state.instances[item.instanceId];
    if (!card || card.zone !== 'board') continue;
    runSegment(state, item.opcodes, item.ctx);
  }
}

function declaresAbsorb(opcodes: readonly Opcode[] | undefined): boolean {
  for (const opcode of opcodes ?? []) {
    if (opcode.op === 'absorbAlly') return true;
    if ((opcode.op === 'forEach' || opcode.op === 'when') && declaresAbsorb(opcode.effects)) return true;
    if (opcode.op === 'ifFaith' && (declaresAbsorb(opcode.then) || declaresAbsorb(opcode.else))) return true;
    if (opcode.op === 'ifOwner' && (declaresAbsorb(opcode.same) || declaresAbsorb(opcode.opponent))) return true;
    if (opcode.op === 'armTimer' && declaresAbsorb(opcode.onZero)) return true;
    if (opcode.op === 'modPermanent' && (declaresAbsorb(opcode.onLeft) || declaresAbsorb(opcode.onStayed))) return true;
  }
  return false;
}

function assertImplemented(opcodes: Opcode[]): void {
  for (const opcode of opcodes) {
    if (UNIMPLEMENTED.has(opcode.op)) {
      throw new Error(`Unimplemented opcode: ${opcode.op}`);
    }
    if (opcode.op === 'forEach' || opcode.op === 'when') assertImplemented(opcode.effects);
    if (opcode.op === 'ifFaith') {
      assertImplemented(opcode.then);
      assertImplemented(opcode.else);
    }
    if (opcode.op === 'ifOwner') {
      assertImplemented(opcode.same);
      assertImplemented(opcode.opponent);
    }
    if (opcode.op === 'armTimer' && opcode.onZero) assertImplemented(opcode.onZero);
    if (opcode.op === 'modPermanent') {
      if (opcode.onLeft) assertImplemented(opcode.onLeft);
      if (opcode.onStayed) assertImplemented(opcode.onStayed);
    }
  }
}

function emptyChoice(): Choice {
  return {};
}

function rememberVacated(state: BattleState, id: string, cell: CellId | null): void {
  if (cell === null) return;
  const map = vacated.get(state) ?? new Map<string, CellId>();
  map.set(id, cell);
  vacated.set(state, map);
}

function originCell(state: BattleState, id: string): CellId | null {
  const card = state.instances[id];
  if (card && card.zone === 'board' && card.cell !== null) return card.cell;
  return vacated.get(state)?.get(id) ?? null;
}

function note(
  state: BattleState,
  ctx: ExecCtx,
  kind: EffectCue['kind'],
  targetId: string | null,
  cell: CellId | null,
  amount = 0,
  toCell: CellId | null = null,
): void {
  const target = targetId ? state.instances[targetId] : undefined;
  const source = state.instances[ctx.selfId];
  appendCue(state, {
    kind,
    sourceId: ctx.selfId,
    sourceCell: originCell(state, ctx.selfId),
    targetId,
    cell: cell ?? (target && target.zone === 'board' ? target.cell : null),
    owner: target?.owner ?? source?.owner ?? ctx.controller,
    amount,
    toCell,
  });
}

function ctxOf(card: CardInstance, choice: Choice | undefined, eventSubjectId: string | null = null): ExecCtx {
  return {
    selfId: card.instanceId,
    controller: card.owner,
    choice: choice ?? emptyChoice(),
    eventSubjectId,
    eventCell: null,
    eachId: null,
    lastFaithSpent: 0,
  };
}

export function createBattle(input: CreateBattleInput = {}): BattleState {
  const seed = mixSeed(input.seed ?? 1);
  const state: BattleState = {
    seed,
    rng: seed,
    definitions: {},
    instances: {},
    deck: [],
    hand: [],
    discard: [],
    exile: [],
    cells: emptyCells(),
    polluted: [],
    faith: {
      player: clampFaith(input.faith?.player ?? 0),
      enemy: clampFaith(input.faith?.enemy ?? 0),
    },
    forceSettlement: input.forceSettlement ?? false,
    forceReasons: [...(input.forceReasons ?? [])],
    log: [],
    cues: [],
    auras: [],
    thresholds: [],
    pendingEvents: [],
    leavePrompts: [],
    fightReactions: [],
    chainDepth: 0,
    resolutionHalted: false,
    nextSerial: 1,
  };

  for (const definition of input.catalog ?? []) rememberDefinition(state, definition);
  for (const setup of input.cards ?? []) placeSetup(state, setup);
  for (const cell of input.polluted ?? []) polluteCell(state, cell);
  return state;
}

function allocateInstanceId(state: BattleState, requested?: string): string {
  if (!requested) return `i${state.nextSerial++}`;
  const matched = /^i(\d+)$/.exec(requested);
  if (matched) {
    const numeric = Number(matched[1]);
    if (numeric >= state.nextSerial) state.nextSerial = numeric + 1;
  }
  return requested;
}

function rememberDefinition(state: BattleState, definition: CardDefinition): void {
  if (definition.ruleType === 'field' && typeof definition.basePoints !== 'number') {
    throw new Error(`Field card ${definition.id} needs base points`);
  }
  if (definition.ruleType === 'spell' && definition.basePoints !== null) {
    throw new Error(`Spell ${definition.id} cannot have base points`);
  }
  const known = state.definitions[definition.id] !== undefined;
  state.definitions[definition.id] = structuredClone(definition);
  if (known) return;
  for (const token of definition.tokens ?? []) rememberDefinition(state, token);
  for (const reaction of definition.fightReactions ?? []) state.fightReactions.push(structuredClone(reaction));
}

function placeSetup(state: BattleState, setup: CardSetup): void {
  rememberDefinition(state, setup.definition);
  const definition = state.definitions[setup.definition.id];
  const instanceId = allocateInstanceId(state, setup.instanceId);
  if (state.instances[instanceId]) throw new Error(`Duplicate instance ${instanceId}`);
  const timerMax = definition.timer ?? null;
  const card: CardInstance = {
    instanceId,
    definitionId: definition.id,
    owner: setup.owner,
    zone: setup.zone,
    cell: null,
    basePoints: definition.basePoints,
    permanentMod: setup.permanentMod ?? 0,
    analyzed: setup.analyzed ?? false,
    sealed: setup.sealed ?? false,
    protected: setup.protected ?? false,
    revive: setup.revive ?? false,
    exhaust: setup.exhaust ?? Boolean(definition.exhaust),
    swift: setup.swift ?? Boolean(definition.swift),
    timer: setup.timer ?? timerMax,
    timerMax,
    timerEffects: null,
    shuffleOnLeave: Boolean(definition.shuffleOnLeave),
    toHandWhenSacrificed: Boolean(definition.toHandWhenSacrificed),
  };
  state.instances[instanceId] = card;
  if (setup.zone === 'board') {
    if (definition.ruleType !== 'field') throw new Error(`Spell ${definition.id} cannot occupy a cell`);
    if (!setup.cell || !isCellId(setup.cell)) throw new Error(`Board card ${instanceId} needs a cell`);
    if (state.cells[setup.cell]) throw new Error(`Cell ${setup.cell} is occupied`);
    state.cells[setup.cell] = instanceId;
    card.cell = setup.cell;
    return;
  }
  if (setup.zone === 'hand') {
    if (state.hand.length >= HAND_LIMIT) throw new Error('Hand limit is 10');
    state.hand.push(instanceId);
    return;
  }
  if (setup.zone === 'deck') state.deck.push(instanceId);
  else if (setup.zone === 'discard') state.discard.push(instanceId);
  else state.exile.push(instanceId);
}

function openChain(state: BattleState): BattleState {
  const next = structuredClone(state);
  next.chainDepth = 0;
  next.resolutionHalted = false;
  next.pendingEvents = [];
  return next;
}

function closeChain(state: BattleState): BattleState {
  if (CELL_IDS.every((cell) => state.cells[cell])) addReason(state, 'board');
  state.chainDepth = 0;
  state.resolutionHalted = false;
  state.pendingEvents = [];
  delete state.leaveChoices;
  return state;
}

function rememberLeaveChoices(state: BattleState, choices: Readonly<Record<string, string>> | undefined): void {
  if (!choices) return;
  state.leaveChoices = { ...choices };
}

function clampFaith(value: number): number {
  return Math.max(0, value);
}

function addReason(state: BattleState, reason: ForceReason): void {
  state.forceSettlement = true;
  if (!state.forceReasons.includes(reason)) state.forceReasons.push(reason);
}

function defOf(state: BattleState, card: CardInstance): CardDefinition {
  const definition = state.definitions[card.definitionId];
  if (!definition) throw new Error(`Missing definition ${card.definitionId}`);
  return definition;
}

export function boardInstanceIds(state: BattleState): string[] {
  const ids: string[] = [];
  for (const cell of CELL_IDS) {
    const id = state.cells[cell];
    if (id) ids.push(id);
  }
  return ids;
}

/** Field cards orthogonally adjacent to `cell` and owned by `owner`. Cell order. */
export function adjacentFieldCards(state: BattleState, cell: CellId, owner: Side): string[] {
  const neighbors = new Set(orthogonalNeighbors(cell));
  return boardInstanceIds(state).filter((id) => {
    const card = state.instances[id];
    return card.owner === owner && card.cell !== null && neighbors.has(card.cell);
  });
}

function matchFieldQuery(
  state: BattleState,
  source: CardInstance | undefined,
  controller: Side,
  query: FieldQuery,
  choice?: Choice,
): string[] {
  const neighbors = source?.cell == null ? null : new Set(orthogonalNeighbors(source.cell));
  const chosenId = choice?.targets?.[0];
  const chosen = chosenId ? state.instances[chosenId] : undefined;
  const chosenNeighbors = chosen?.cell == null ? null : new Set(orthogonalNeighbors(chosen.cell));
  const matched = boardInstanceIds(state).filter((id) => {
    const card = state.instances[id];
    if (query.owner === 'same' && card.owner !== controller) return false;
    if (query.owner === 'opponent' && card.owner === controller) return false;
    if (query.adjacentToSelf && (neighbors === null || card.cell === null || !neighbors.has(card.cell))) return false;
    if (query.adjacentToChoice && (chosenNeighbors === null || card.cell === null || !chosenNeighbors.has(card.cell))) return false;
    if (query.hasMark && !card.analyzed) return false;
    if (query.unmarked && card.analyzed) return false;
    if (query.mirrorOfSource) {
      if (!source || source.cell === null) return false;
      const mirror = mirrorCell(source.cell);
      if (mirror === null || card.cell !== mirror) return false;
    }
    if (query.emptyMirror) {
      if (card.cell === null) return false;
      const mirror = mirrorCell(card.cell);
      if (mirror === null || state.cells[mirror] !== null) return false;
    }
    return true;
  });
  return query.highest ? highestOne(state, matched) : matched;
}

/** Highest current points. The input is already in ascending cell order, so a tie keeps the first. */
function highestOne(state: BattleState, ids: string[]): string[] {
  let best: string | null = null;
  let bestPoints = 0;
  for (const id of ids) {
    const points = currentPoints(state, id);
    if (!best || points > bestPoints) {
      best = id;
      bestPoints = points;
    }
  }
  return best ? [best] : [];
}

export function cardAt(state: BattleState, cell: CellId): CardInstance | null {
  const id = state.cells[cell];
  return id ? state.instances[id] : null;
}

export function cardsInZone(state: BattleState, zone: Zone): CardInstance[] {
  if (zone === 'board') return boardInstanceIds(state).map((id) => state.instances[id]);
  const ids = zone === 'hand' ? state.hand : zone === 'deck' ? state.deck : zone === 'discard' ? state.discard : state.exile;
  return ids.map((id) => state.instances[id]);
}

function sourceActive(state: BattleState, sourceId: string): boolean {
  const source = state.instances[sourceId];
  return Boolean(source && source.zone === 'board' && source.cell !== null && !source.sealed);
}

function auraHits(state: BattleState, aura: Aura, targetId: string): boolean {
  const target = state.instances[targetId];
  const source = state.instances[aura.sourceId];
  if (!target || target.zone !== 'board') return false;
  if (aura.target.kind === 'fixed') return aura.target.instanceIds.includes(targetId);
  const query = aura.target;
  if (!source) return false;
  if (query.mirrorOfSource) {
    if (!source.cell) return false;
    const mirror = mirrorCell(source.cell);
    if (mirror === null || target.cell !== mirror) return false;
  }
  if (query.owner === 'same' && target.owner !== source.owner) return false;
  if (query.owner === 'opponent' && target.owner === source.owner) return false;
  if (query.hasMark && !target.analyzed) return false;
  if (query.hasProtect && !target.protected) return false;
  if (query.self && targetId !== aura.sourceId) return false;
  if (query.selfWhileAllyMirror) {
    if (targetId !== aura.sourceId || !sameOwnerOnMirror(state, source.cell, source.owner)) return false;
  }
  if (query.mirroredAlly && !sameOwnerOnMirror(state, target.cell, target.owner)) return false;
  return true;
}

/** Another same-owner card stands on this cell's mirror. Cell 5 never matches. */
function sameOwnerOnMirror(state: BattleState, cell: CellId | null, owner: Side): boolean {
  if (cell === null) return false;
  const mirror = mirrorCell(cell);
  if (mirror === null) return false;
  const otherId = state.cells[mirror];
  if (!otherId) return false;
  const other = state.instances[otherId];
  return Boolean(other && other.zone === 'board' && other.owner === owner);
}

function auraAmount(state: BattleState, targetId: string): number {
  let sum = 0;
  for (const aura of state.auras) {
    if (!sourceActive(state, aura.sourceId)) continue;
    if (auraHits(state, aura, targetId)) sum += aura.amount;
  }
  for (const sourceId of boardInstanceIds(state)) {
    if (!sourceActive(state, sourceId)) continue;
    const presence = defOf(state, state.instances[sourceId]).presence;
    if (!presence) continue;
    for (const aura of presence) {
      const live: Aura = { id: 'presence', sourceId, amount: aura.amount, target: { kind: 'query', ...aura.target } };
      if (!auraHits(state, live, targetId)) continue;
      const copies = aura.perOwnDiscard ? ownDiscardCount(state, state.instances[sourceId].owner) : 1;
      sum += aura.amount * copies;
    }
  }
  return sum;
}

/** Current points include aura and ignore the seal. Seal zeroes the total, not this value. */
export function currentPoints(state: BattleState, instanceId: string): number {
  const card = state.instances[instanceId];
  if (!card || card.basePoints === null) return 0;
  return Math.max(0, card.basePoints + card.permanentMod + auraAmount(state, instanceId));
}

export function totalPoints(state: BattleState, side: Side): number {
  let sum = 0;
  for (const id of boardInstanceIds(state)) {
    const card = state.instances[id];
    if (card.owner !== side || card.sealed) continue;
    sum += currentPoints(state, id);
  }
  return sum;
}

/** Cards this side owns in the shared discard. The other side's cards do not count. */
function ownDiscardCount(state: BattleState, owner: Side): number {
  let count = 0;
  for (const id of state.discard) {
    if (state.instances[id]?.owner === owner) count += 1;
  }
  return count;
}

function permanentDelta(
  state: BattleState,
  amount: number | 'lastFaithSpent' | { perOwnDiscard: number; cap?: number },
  ctx: ExecCtx,
): number {
  if (amount === 'lastFaithSpent') return ctx.lastFaithSpent;
  if (typeof amount === 'number') return amount;
  const counted = ownDiscardCount(state, ctx.controller);
  const cards = amount.cap === undefined ? counted : Math.min(counted, amount.cap);
  return amount.perOwnDiscard * cards;
}

export function occupiedCount(state: BattleState, side: Side): number {
  let count = 0;
  for (const id of boardInstanceIds(state)) {
    if (state.instances[id].owner === side) count += 1;
  }
  return count;
}

export function activeCoverThreshold(state: BattleState, defenderId: string): number | null {
  let best: number | null = null;
  for (const threshold of state.thresholds) {
    if (threshold.targetId !== defenderId) continue;
    if (!sourceActive(state, threshold.sourceId)) continue;
    best = best === null ? threshold.min : Math.max(best, threshold.min);
  }
  return best;
}

function consumeDepth(state: BattleState): boolean {
  if (state.resolutionHalted) return false;
  state.chainDepth += 1;
  // TODO 【建议默认】同一因果链深度上限 32，到达后停止并记错误。
  if (state.chainDepth > CHAIN_DEPTH_LIMIT) {
    state.resolutionHalted = true;
    state.log.push('error:zero-check depth limit 32');
    return false;
  }
  return true;
}

function isTracked(state: BattleState, id: string): boolean {
  if (state.hand.includes(id) || state.deck.includes(id) || state.discard.includes(id) || state.exile.includes(id)) {
    return true;
  }
  return boardInstanceIds(state).includes(id);
}

function forget(state: BattleState, id: string): void {
  state.deck = state.deck.filter((entry) => entry !== id);
  state.hand = state.hand.filter((entry) => entry !== id);
  state.discard = state.discard.filter((entry) => entry !== id);
  state.exile = state.exile.filter((entry) => entry !== id);
  for (const cell of CELL_IDS) {
    if (state.cells[cell] === id) state.cells[cell] = null;
  }
}

/**
 * TODO 【建议默认】弃牌堆、牌组、移出游戏回到印刷状态：
 * 清掉永久加减、解析标记、封印、保护、返魂。手牌上由效果直接加上的永久加减不从这里清。
 */
function applyPrinted(state: BattleState, id: string): void {
  const card = state.instances[id];
  const definition = defOf(state, card);
  card.basePoints = definition.basePoints;
  card.permanentMod = 0;
  card.analyzed = false;
  card.sealed = false;
  card.protected = false;
  card.revive = false;
  card.exhaust = Boolean(definition.exhaust);
  card.swift = Boolean(definition.swift);
  card.timer = definition.timer ?? null;
  card.timerMax = definition.timer ?? null;
  card.timerEffects = null;
  card.shuffleOnLeave = Boolean(definition.shuffleOnLeave);
  card.toHandWhenSacrificed = Boolean(definition.toHandWhenSacrificed);
  card.cell = null;
}

function putPrinted(state: BattleState, id: string, zone: 'deck' | 'discard' | 'exile'): void {
  const card = state.instances[id];
  forget(state, id);
  applyPrinted(state, id);
  card.zone = zone;
  if (zone === 'deck') state.deck.push(id);
  else if (zone === 'discard') state.discard.push(id);
  else state.exile.push(id);
}

function shuffleDeck(state: BattleState): void {
  for (let index = state.deck.length - 1; index > 0; index -= 1) {
    const rolled = nextInt(state.rng, index + 1);
    state.rng = rolled.rng;
    const swap = state.deck[index];
    state.deck[index] = state.deck[rolled.n];
    state.deck[rolled.n] = swap;
  }
}

/** Create one printed copy and shuffle the player's deck. The enemy has no deck. */
export function shufflePrintedIntoDeck(state: BattleState, definition: CardDefinition, owner: Side): BattleState {
  if (owner !== 'player') return state;
  const next = openChain(state);
  rememberDefinition(next, definition);
  const stored = next.definitions[definition.id];
  if (!stored) return closeChain(next);
  const instanceId = allocateInstanceId(next);
  const timerMax = stored.timer ?? null;
  const card: CardInstance = {
    instanceId,
    definitionId: stored.id,
    owner: 'player',
    zone: 'deck',
    cell: null,
    basePoints: stored.basePoints,
    permanentMod: 0,
    analyzed: false,
    sealed: false,
    protected: false,
    revive: false,
    exhaust: Boolean(stored.exhaust),
    swift: Boolean(stored.swift),
    timer: timerMax,
    timerMax,
    timerEffects: null,
    shuffleOnLeave: Boolean(stored.shuffleOnLeave),
    toHandWhenSacrificed: Boolean(stored.toHandWhenSacrificed),
  };
  next.instances[instanceId] = card;
  next.deck.push(instanceId);
  shuffleDeck(next);
  next.log.push(`shuffle:${instanceId}`);
  return closeChain(next);
}

function moveToHandKeepMods(state: BattleState, id: string): void {
  const card = state.instances[id];
  forget(state, id);
  card.zone = 'hand';
  card.cell = null;
  card.sealed = false;
  card.revive = false;
  state.hand.push(id);
}

function sendToHandOrDiscard(state: BattleState, id: string): void {
  // TODO 【建议默认】返魂时手牌已满（10）则进入弃牌堆。
  if (state.hand.length >= HAND_LIMIT) putPrinted(state, id, 'discard');
  else moveToHandKeepMods(state, id);
}

function dropGranted(state: BattleState, sourceId: string): void {
  state.auras = state.auras.filter((aura) => aura.sourceId !== sourceId);
  state.thresholds = state.thresholds.filter((threshold) => threshold.sourceId !== sourceId);
}

function queueEvent(state: BattleState, type: ListenerEvent, instanceId: string, cell: CellId | null): void {
  const subject = state.instances[instanceId];
  const event: PendingEvent = { type, instanceId, cell, marked: Boolean(subject?.analyzed) };
  state.pendingEvents.push(event);
}

/**
 * The leaver is already off its cell. Enemy picks the highest ally.
 * A player pick that names a legal ally is used at once. Otherwise the effect waits.
 */
function choiceForLeave(state: BattleState, card: CardInstance): Choice | 'defer' {
  const definition = defOf(state, card);
  const query = definition.leaveTarget;
  const effects = definition.onLeave ?? [];
  if (!query || !effects.some(usesChoice)) return emptyChoice();
  const legal = matchFieldQuery(state, card, card.owner, query);
  if (legal.length === 0) return emptyChoice();
  if (card.owner === 'enemy') {
    const picked = highestOne(state, legal)[0];
    return picked ? { targets: [picked] } : emptyChoice();
  }
  const supplied = state.leaveChoices?.[card.instanceId];
  if (supplied && legal.includes(supplied)) return { targets: [supplied] };
  const prompt: LeavePrompt = { sourceId: card.instanceId, targets: legal };
  state.leavePrompts = [...state.leavePrompts, prompt];
  return 'defer';
}

function routeAfterLeave(state: BattleState, id: string): void {
  const card = state.instances[id];
  if (card.revive && !card.exhaust) {
    card.revive = false;
    sendToHandOrDiscard(state, id);
    return;
  }
  if (card.shuffleOnLeave) {
    putPrinted(state, id, 'deck');
    shuffleDeck(state);
    return;
  }
  if (card.exhaust) {
    putPrinted(state, id, 'exile');
    return;
  }
  putPrinted(state, id, 'discard');
}

function clearCell(state: BattleState, id: string): CellId | null {
  const card = state.instances[id];
  const cell = card.cell;
  rememberVacated(state, id, cell);
  if (cell && state.cells[cell] === id) state.cells[cell] = null;
  card.cell = null;
  dropGranted(state, id);
  return cell;
}

function removeInstance(state: BattleState, id: string, reason: RemovalReason, sourceId?: string): void {
  const card = state.instances[id];
  if (state.resolutionHalted) return;
  if (!card || card.zone !== 'board' || card.cell === null) return;
  if (!consumeDepth(state)) return;

  const actor = sourceId ?? id;
  if (reason !== 'cover' && card.protected) {
    card.protected = false;
    state.log.push(`protect:${id}`);
    appendCue(state, {
      kind: 'guard',
      sourceId: actor,
      sourceCell: originCell(state, actor),
      targetId: id,
      cell: card.cell,
      owner: card.owner,
      amount: 0,
      toCell: null,
    });
    return;
  }

  const sealed = card.sealed;
  const leftCell = clearCell(state, id);
  appendCue(state, {
    kind: reason === 'cover' ? 'cover' : 'remove',
    sourceId: actor,
    sourceCell: originCell(state, actor),
    targetId: id,
    cell: leftCell,
    owner: card.owner,
    amount: 0,
    toCell: null,
  });
  const definition = defOf(state, card);
  state.log.push(`leave:${id}`);
  if (!sealed) {
    const choice = choiceForLeave(state, card);
    if (choice !== 'defer') runSegment(state, definition.onLeave ?? [], ctxOf(card, choice));
  }
  queueEvent(state, 'left', id, leftCell);
  routeAfterLeave(state, id);
}

/** Hand card that never entered: destination rules only, no leave and no protect. */
function sendUnentered(state: BattleState, id: string): void {
  const card = state.instances[id];
  if (card.revive && !card.exhaust) {
    card.revive = false;
    sendToHandOrDiscard(state, id);
    return;
  }
  if (card.shuffleOnLeave) {
    putPrinted(state, id, 'deck');
    shuffleDeck(state);
    return;
  }
  if (card.exhaust) {
    putPrinted(state, id, 'exile');
    return;
  }
  putPrinted(state, id, 'discard');
}

function seat(state: BattleState, card: CardInstance, cell: CellId): void {
  state.cells[cell] = card.instanceId;
  card.zone = 'board';
  card.cell = cell;
  appendCue(state, {
    kind: 'arrive',
    sourceId: card.instanceId,
    sourceCell: null,
    targetId: card.instanceId,
    cell,
    owner: card.owner,
    amount: 0,
    toCell: null,
  });
}

function resolveTargets(state: BattleState, spec: TargetSpec, ctx: ExecCtx): string[] {
  if (spec.ref === 'self') return state.instances[ctx.selfId] ? [ctx.selfId] : [];
  if (spec.ref === 'each') return ctx.eachId && state.instances[ctx.eachId] ? [ctx.eachId] : [];
  if (spec.ref === 'eventSubject') {
    return ctx.eventSubjectId && state.instances[ctx.eventSubjectId] ? [ctx.eventSubjectId] : [];
  }
  if (spec.ref === 'instance') return state.instances[spec.id] ? [spec.id] : [];
  if (spec.ref === 'choice') {
    const ids = ctx.choice.targets ?? [];
    if (spec.index === undefined) return ids.filter((id) => state.instances[id]);
    const id = ids[spec.index];
    return id && state.instances[id] ? [id] : [];
  }
  return matchFieldQuery(state, state.instances[ctx.selfId], ctx.controller, spec, ctx.choice);
}

function matchesWhen(state: BattleState, id: string, when: RemoveCondition[] | undefined): boolean {
  if (!when || when.length === 0) return true;
  const card = state.instances[id];
  return when.every((condition) => {
    if (condition.kind === 'hasMark') return card.analyzed;
    if (condition.kind === 'sealed') return card.sealed;
    return currentPoints(state, id) <= condition.max;
  });
}

function polluteCell(state: BattleState, cell: CellId): void {
  if (!state.polluted.includes(cell)) state.polluted.push(cell);
}

function livePointTarget(card: CardInstance): boolean {
  return card.basePoints !== null && (card.zone === 'board' || card.zone === 'hand');
}

/** One layer: base + permanent is below the printed base, so the modifier is negative. */
function hasDebuffLayer(card: CardInstance): boolean {
  return card.basePoints !== null && card.permanentMod < 0;
}

function clearOneNegative(state: BattleState, id: string, ctx: ExecCtx): void {
  const card = state.instances[id];
  if (!card || card.zone !== 'board') return;
  const debuff = hasDebuffLayer(card);
  const sealed = card.sealed;
  if (!debuff && !sealed) return;
  const preference = ctx.choice.negatives?.[id] ?? ctx.choice.negative;
  if (debuff && sealed && preference === 'debuff') {
    card.permanentMod += 1;
    note(state, ctx, 'clear', id, card.cell, 1);
    return;
  }
  if (sealed) {
    card.sealed = false;
    note(state, ctx, 'clear', id, card.cell, 0);
    return;
  }
  card.permanentMod += 1;
  note(state, ctx, 'clear', id, card.cell, 1);
}

function preflight(
  state: BattleState,
  opcodes: Opcode[],
  controller: Side,
): { ok: true; skip: Set<number> } | { ok: false } {
  let faith = state.faith[controller];
  let deck = state.deck.length;
  let hand = state.hand.length;
  const skip = new Set<number>();
  for (let index = 0; index < opcodes.length; index += 1) {
    const opcode = opcodes[index];
    if (opcode.op === 'spendFaith') {
      if (opcode.amount === 'all') faith = 0;
      else if (faith < opcode.amount) return { ok: false };
      else faith -= opcode.amount;
    } else if (opcode.op === 'gainFaith') {
      faith += opcode.amount;
    } else if (opcode.op === 'doubleFaith') {
      faith *= 2;
    } else if (opcode.op === 'sacrifice') {
      if (controller !== 'player') skip.add(index);
      else if (deck < opcode.count) return { ok: false };
      else deck -= opcode.count;
    } else if (opcode.op === 'draw') {
      if (controller !== 'player') skip.add(index);
      else {
        let remaining = opcode.count;
        while (remaining > 0 && deck > 0 && hand < HAND_LIMIT) {
          deck -= 1;
          hand += 1;
          remaining -= 1;
        }
      }
    }
  }
  return { ok: true, skip };
}

function sacrifice(state: BattleState, count: number, ctx: ExecCtx): void {
  if (state.deck.length < count) throw new Error('Sacrifice underpaid after preflight');
  for (let index = 0; index < count; index += 1) {
    const rolled = nextInt(state.rng, state.deck.length);
    state.rng = rolled.rng;
    const id = state.deck[rolled.n];
    state.deck.splice(rolled.n, 1);
    const card = state.instances[id];
    note(state, ctx, 'sacrifice', id, null);
    if (card.toHandWhenSacrificed) {
      // TODO 【建议默认】亡魂被献祭时入手；手牌已满则进弃牌堆。被别的方式丢进弃牌堆不改道。
      forget(state, id);
      if (state.hand.length >= HAND_LIMIT) putPrinted(state, id, 'discard');
      else {
        card.zone = 'hand';
        card.cell = null;
        state.hand.push(id);
      }
    } else {
      putPrinted(state, id, 'discard');
    }
  }
}

function spawnCell(state: BattleState, opcode: Extract<Opcode, { op: 'spawn' }>, ctx: ExecCtx): CellId | null {
  if (opcode.cell === 'randomAdjacentEmpty') {
    const source = state.instances[ctx.selfId];
    if (!source || source.cell === null) return null;
    const open = orthogonalNeighbors(source.cell).filter((cell) => state.cells[cell] === null);
    if (open.length === 0) return null;
    const rolled = nextInt(state.rng, open.length);
    state.rng = rolled.rng;
    return open[rolled.n] ?? null;
  }
  if (opcode.cell === 'randomEmpty') {
    const open = CELL_IDS.filter((cell) => state.cells[cell] === null);
    if (open.length === 0) return null;
    const rolled = nextInt(state.rng, open.length);
    state.rng = rolled.rng;
    return open[rolled.n] ?? null;
  }
  if (opcode.cell === 'mirrorOfSubject') {
    if (ctx.eventCell === null) return null;
    return mirrorCell(ctx.eventCell);
  }
  const cell = opcode.cell === 'choice' ? ctx.choice.cells?.[0] : opcode.cell;
  if (!cell || !isCellId(cell)) return null;
  return cell;
}

function generatedBase(
  state: BattleState,
  opcode: Extract<Opcode, { op: 'spawn' }>,
  ctx: ExecCtx,
  definition: CardDefinition,
): number | null {
  if (opcode.basePoints === 'halfSubjectBase') {
    const subject = ctx.eventSubjectId ? state.instances[ctx.eventSubjectId] : undefined;
    if (!subject || typeof subject.basePoints !== 'number') return null;
    return Math.floor(subject.basePoints / 2);
  }
  if (typeof opcode.basePoints === 'number') return opcode.basePoints;
  return definition.basePoints;
}

function spawn(state: BattleState, opcode: Extract<Opcode, { op: 'spawn' }>, ctx: ExecCtx): void {
  if (state.resolutionHalted) return;
  if (!consumeDepth(state)) return;
  const cell = spawnCell(state, opcode, ctx);
  if (!cell || state.cells[cell]) return;
  const definition = state.definitions[opcode.definitionId];
  if (!definition) throw new Error(`Missing definition ${opcode.definitionId}`);
  if (definition.ruleType !== 'field') return;
  const basePoints = generatedBase(state, opcode, ctx, definition);
  if (basePoints === null) return;
  const owner =
    opcode.owner === 'opponent' ? OTHER[ctx.controller] : opcode.owner === 'self' || opcode.owner === undefined ? ctx.controller : opcode.owner;
  const instanceId = `i${state.nextSerial++}`;
  const timerMax = definition.timer ?? null;
  // 生成不是打出，不吃污染格。入场照常。
  const card: CardInstance = {
    instanceId,
    definitionId: definition.id,
    owner,
    zone: 'board',
    cell,
    basePoints,
    permanentMod: 0,
    analyzed: false,
    sealed: false,
    protected: false,
    revive: false,
    exhaust: Boolean(definition.exhaust),
    swift: Boolean(definition.swift),
    timer: timerMax,
    timerMax,
    timerEffects: null,
    shuffleOnLeave: Boolean(definition.shuffleOnLeave),
    toHandWhenSacrificed: Boolean(definition.toHandWhenSacrificed),
  };
  state.instances[instanceId] = card;
  state.cells[cell] = instanceId;
  state.log.push(`enter:${instanceId}`);
  appendCue(state, {
    kind: 'spawn',
    sourceId: ctx.selfId,
    sourceCell: originCell(state, ctx.selfId),
    targetId: instanceId,
    cell,
    owner,
    amount: basePoints,
    toCell: null,
  });
  runSegment(state, definition.effects ?? [], ctxOf(card, ctx.choice));
  queueEvent(state, 'entered', instanceId, cell);
}

function deckFieldMatches(state: BattleState, minBase: number): string[] {
  const matches: string[] = [];
  for (const id of state.deck) {
    const card = state.instances[id];
    if (!card || card.basePoints === null || card.basePoints < minBase) continue;
    if (defOf(state, card).ruleType !== 'field') continue;
    matches.push(id);
  }
  return matches;
}

function moveDeckCardToHand(state: BattleState, id: string): boolean {
  if (!state.deck.includes(id) || state.hand.length >= HAND_LIMIT) return false;
  state.deck = state.deck.filter((entry) => entry !== id);
  const card = state.instances[id];
  card.zone = 'hand';
  card.cell = null;
  state.hand.push(id);
  return true;
}

/**
 * Printed base, not current points. An empty deck or no qualifying field card
 * is a no-op. A bare search with no `minBase` is still unimplemented.
 */
function searchDeck(state: BattleState, opcode: Extract<Opcode, { op: 'search' }>, ctx: ExecCtx): void {
  if (typeof opcode.minBase !== 'number') throw new Error('Unimplemented opcode: search');
  const matches = deckFieldMatches(state, opcode.minBase);
  if (matches.length === 0) return;
  const picked = ctx.choice.targets?.[0];
  if (picked && matches.includes(picked)) {
    if (moveDeckCardToHand(state, picked)) note(state, ctx, 'search', picked, null);
    return;
  }
  if (matches.length === 1) {
    const only = matches[0];
    if (only && moveDeckCardToHand(state, only)) note(state, ctx, 'search', only, null);
  }
}

function applyOpcode(state: BattleState, opcode: Opcode, ctx: ExecCtx): void {
  switch (opcode.op) {
    case 'modPermanent': {
      const amount = permanentDelta(state, opcode.amount, ctx);
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (!livePointTarget(card)) continue;
        if (ctx.controller === 'enemy' && card.zone === 'hand') continue;
        const onBoard = card.zone === 'board';
        card.permanentMod += amount;
        if (amount !== 0) note(state, ctx, 'points', id, onBoard ? card.cell : null, amount);
        if (onBoard && opcode.onLeft && opcode.onLeft.length > 0) {
          queueLeaveFollowup(state, id, opcode.onLeft, ctx, currentPoints(state, id) === 0);
        }
        if (onBoard && opcode.onStayed && opcode.onStayed.length > 0) {
          queueStayFollowup(state, id, opcode.onStayed, ctx);
        }
      }
      return;
    }
    case 'grantAura': {
      const id = `a${state.nextSerial++}`;
      if (opcode.target.ref === 'query') {
        const query: AuraQuery = {
          owner: opcode.target.owner,
          hasMark: 'hasMark' in opcode.target ? opcode.target.hasMark : undefined,
          hasProtect: 'hasProtect' in opcode.target ? opcode.target.hasProtect : undefined,
          mirrorOfSource: 'mirrorOfSource' in opcode.target ? opcode.target.mirrorOfSource : undefined,
        };
        state.auras.push({ id, sourceId: ctx.selfId, amount: opcode.amount, target: { kind: 'query', ...query } });
      } else {
        state.auras.push({
          id,
          sourceId: ctx.selfId,
          amount: opcode.amount,
          target: { kind: 'fixed', instanceIds: resolveTargets(state, opcode.target, ctx) },
        });
      }
      note(state, ctx, 'aura', ctx.selfId, null, opcode.amount);
      return;
    }
    case 'doubleBasePermanent': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (!livePointTarget(card) || card.basePoints === null) continue;
        // 只翻基础+永久。新永久 = 2*(基础+永久)-基础。第 4.6 节公式少写了乘 2，按句首实现，否则翻倍是空操作。光环不写入永久。
        const sum = card.basePoints + card.permanentMod;
        card.permanentMod = sum * 2 - card.basePoints;
        note(state, ctx, 'double', id, card.cell, card.permanentMod);
      }
      return;
    }
    case 'resetToBase': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (!livePointTarget(card)) continue;
        if (card.permanentMod === 0) continue;
        note(state, ctx, 'reset', id, card.cell, card.permanentMod);
        card.permanentMod = 0;
      }
      return;
    }
    case 'addMark': {
      let ids = resolveTargets(state, opcode.target, ctx);
      if (opcode.pick === 'random') {
        if (ids.length === 0) return;
        const rolled = nextInt(state.rng, ids.length);
        state.rng = rolled.rng;
        const picked = ids[rolled.n];
        ids = picked ? [picked] : [];
      }
      for (const id of ids) {
        const card = state.instances[id];
        if (card.zone !== 'board' && card.zone !== 'hand') continue;
        if (card.analyzed) continue;
        card.analyzed = true;
        note(state, ctx, 'mark', id, card.cell);
        queueEvent(state, 'gainedMark', id, card.cell);
      }
      return;
    }
    case 'removeMark': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (!card.analyzed) continue;
        card.analyzed = false;
        note(state, ctx, 'unmark', id, card.cell);
      }
      return;
    }
    case 'seal': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (card.zone !== 'board' || card.sealed) continue;
        card.sealed = true;
        note(state, ctx, 'seal', id, card.cell);
        queueEvent(state, 'sealed', id, card.cell);
      }
      return;
    }
    case 'clearNegative': {
      for (const id of resolveTargets(state, opcode.target, ctx)) clearOneNegative(state, id, ctx);
      return;
    }
    case 'giveProtect': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (card.protected) continue;
        card.protected = true;
        note(state, ctx, 'protect', id, card.cell);
      }
      return;
    }
    case 'giveRevive': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (card.revive) continue;
        card.revive = true;
        note(state, ctx, 'revive', id, card.cell);
      }
      return;
    }
    case 'setExhaust': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (card.exhaust) continue;
        card.exhaust = true;
        note(state, ctx, 'exhaust', id, card.cell);
      }
      return;
    }
    case 'remove': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        if (!matchesWhen(state, id, opcode.when)) continue;
        removeInstance(state, id, 'effect', ctx.selfId);
      }
      return;
    }
    case 'grantCoverThreshold': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const threshold: CoverThreshold = {
          id: `t${state.nextSerial++}`,
          sourceId: ctx.selfId,
          min: opcode.min,
          targetId: id,
        };
        state.thresholds.push(threshold);
        note(state, ctx, 'threshold', id, state.instances[id].cell, opcode.min);
      }
      return;
    }
    case 'sacrifice': {
      if (ctx.controller !== 'player') return;
      sacrifice(state, opcode.count, ctx);
      return;
    }
    case 'gainFaith': {
      const before = state.faith[ctx.controller];
      state.faith[ctx.controller] = clampFaith(before + opcode.amount);
      if (state.faith[ctx.controller] !== before) note(state, ctx, 'faith', null, null, state.faith[ctx.controller] - before);
      return;
    }
    case 'spendFaith': {
      const before = state.faith[ctx.controller];
      if (opcode.amount === 'all') {
        ctx.lastFaithSpent = before;
        state.faith[ctx.controller] = 0;
      } else {
        state.faith[ctx.controller] = clampFaith(before - opcode.amount);
        ctx.lastFaithSpent = opcode.amount;
      }
      if (state.faith[ctx.controller] !== before) note(state, ctx, 'faith', null, null, state.faith[ctx.controller] - before);
      return;
    }
    case 'doubleFaith': {
      const before = state.faith[ctx.controller];
      state.faith[ctx.controller] = clampFaith(before * 2);
      if (state.faith[ctx.controller] !== before) note(state, ctx, 'faith', null, null, state.faith[ctx.controller] - before);
      return;
    }
    case 'pollute': {
      const cell = opcode.cell === 'choice' ? ctx.choice.cells?.[0] : opcode.cell;
      if (cell && isCellId(cell)) {
        const fresh = !state.polluted.includes(cell);
        polluteCell(state, cell);
        if (fresh) note(state, ctx, 'pollute', null, cell);
      }
      return;
    }
    case 'armTimer': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (card.zone !== 'board') continue;
        card.timer = opcode.turns;
        card.timerMax = opcode.turns;
        card.timerEffects = opcode.onZero ? structuredClone(opcode.onZero) : [];
        note(state, ctx, 'timer', id, card.cell, opcode.turns);
      }
      return;
    }
    case 'grantSwift': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (card.swift) continue;
        card.swift = true;
        note(state, ctx, 'swift', id, card.cell);
      }
      return;
    }
    case 'forceSettlement': {
      const had = state.forceReasons.includes('special');
      addReason(state, 'special');
      if (!had) note(state, ctx, 'settle', ctx.selfId, null);
      return;
    }
    case 'transferOwner': {
      const nextOwner = opcode.to === 'opponent' ? OTHER[ctx.controller] : opcode.to;
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (card.zone !== 'board' || card.cell === null || card.owner === nextOwner) continue;
        card.owner = nextOwner;
        note(state, ctx, 'transfer', id, card.cell);
      }
      return;
    }
    case 'draw': {
      if (ctx.controller !== 'player') return;
      for (let count = 0; count < opcode.count; count += 1) {
        if (state.hand.length >= HAND_LIMIT || state.deck.length === 0) return;
        const id = state.deck.shift();
        if (!id) return;
        const card = state.instances[id];
        const onDraw = defOf(state, card).onDraw ?? [];
        state.log.push(`draw:${id}`);
        note(state, ctx, 'draw', id, null);
        if (onDraw.length > 0) {
          runSegment(state, onDraw, ctxOf(card, emptyChoice()));
          if (!isTracked(state, id)) putPrinted(state, id, 'discard');
          resolveQueue(state);
          continue;
        }
        card.zone = 'hand';
        card.cell = null;
        state.hand.push(id);
      }
      return;
    }
    case 'spawn': {
      spawn(state, opcode, ctx);
      return;
    }
    case 'moveToMirror': {
      for (const id of resolveTargets(state, opcode.target, ctx)) {
        const card = state.instances[id];
        if (card.zone !== 'board' || card.cell === null) continue;
        const mirror = mirrorCell(card.cell);
        if (mirror === null || state.cells[mirror]) continue;
        const from = card.cell;
        state.cells[card.cell] = null;
        state.cells[mirror] = id;
        card.cell = mirror;
        note(state, ctx, 'mirror', id, from, 0, mirror);
      }
      return;
    }
    case 'lookTop':
    case 'discardToHand':
    case 'discardToField':
    case 'absorbAlly':
      return;
    case 'search': {
      searchDeck(state, opcode, ctx);
      return;
    }
    case 'shuffleIntoDeck':
    case 'shuffleCopy':
    case 'onDrawResolve':
      throw new Error(`Unimplemented opcode: ${opcode.op}`);
    case 'followUpPlay': {
      if (ctx.controller !== 'player') return;
      grantedFollowUps.set(state, (grantedFollowUps.get(state) ?? 0) + 1);
      state.log.push('follow-up');
      note(state, ctx, 'follow', ctx.selfId, null);
      return;
    }
    case 'forEach': {
      const ids = matchFieldQuery(state, state.instances[ctx.selfId], ctx.controller, opcode.query, ctx.choice);
      for (const eachId of ids) {
        if (state.resolutionHalted) return;
        if (!state.instances[eachId]) continue;
        runSegment(state, opcode.effects, { ...ctx, eachId });
      }
      return;
    }
    case 'when': {
      const hits = matchFieldQuery(state, state.instances[ctx.selfId], ctx.controller, opcode.query, ctx.choice);
      if (hits.length === 0) return;
      runSegment(state, opcode.effects, ctx);
      return;
    }
    case 'ifFaith': {
      const branch = state.faith[ctx.controller] >= opcode.atLeast ? opcode.then : opcode.else;
      runSegment(state, branch, ctx);
      return;
    }
    case 'ifOwner': {
      const id = resolveTargets(state, opcode.target, ctx)[0];
      const card = id ? state.instances[id] : undefined;
      if (!card) return;
      const branch = card.owner === ctx.controller ? opcode.same : opcode.opponent;
      runSegment(state, branch, ctx);
      return;
    }
    default: {
      const unknown: never = opcode;
      throw new Error(`Unimplemented opcode: ${(unknown as Opcode).op}`);
    }
  }
}

function runSegment(state: BattleState, opcodes: Opcode[], ctx: ExecCtx): boolean {
  assertImplemented(opcodes);
  const plan = preflight(state, opcodes, ctx.controller);
  if (!plan.ok) return false;
  for (let index = 0; index < opcodes.length; index += 1) {
    if (plan.skip.has(index)) continue;
    if (state.resolutionHalted) break;
    applyOpcode(state, opcodes[index], ctx);
  }
  return true;
}

function reactionApplies(state: BattleState, reactorId: string, reaction: Reaction, event: PendingEvent): boolean {
  if (reaction.event !== event.type) return false;
  const reactor = state.instances[reactorId];
  if (reaction.onBoard && (!reactor || reactor.zone !== 'board' || reactor.cell === null)) return false;
  const filter = reaction.subject;
  if (!filter) return true;
  const subject = state.instances[event.instanceId];
  if (!subject) return false;
  if (filter.owner && subject.owner !== filter.owner) return false;
  if (filter.ownerRelation) {
    if (!reactor) return false;
    const same = subject.owner === reactor.owner;
    if (filter.ownerRelation === 'same' && !same) return false;
    if (filter.ownerRelation === 'opponent' && same) return false;
  }
  if (filter.adjacentToSelf) {
    if (!reactor || reactor.cell === null || event.cell === null) return false;
    if (!orthogonalNeighbors(reactor.cell).includes(event.cell)) return false;
  }
  if (filter.onMirrorOf) {
    if (!reactor || event.cell === null) return false;
    const mirror = mirrorCell(event.cell);
    if (mirror === null) return false;
    const occupantId = state.cells[mirror];
    const occupant = occupantId ? state.instances[occupantId] : undefined;
    if (!occupant || occupant.zone !== 'board') return false;
    const same = occupant.owner === reactor.owner;
    if (filter.onMirrorOf === 'opponent' && same) return false;
    if (filter.onMirrorOf === 'same' && !same) return false;
  }
  if (filter.mirrorOfSelf) {
    if (!reactor || reactor.cell === null || event.cell === null) return false;
    if (mirrorCell(reactor.cell) !== event.cell) return false;
  }
  if (filter.hasMark && !event.marked) return false;
  if (filter.field && defOf(state, subject).ruleType !== 'field') return false;
  return true;
}

function canReact(state: BattleState, id: string, event: PendingEvent): boolean {
  const card = state.instances[id];
  if (!card || card.sealed) return false;
  if (card.zone !== 'board' && card.zone !== 'hand') return false;
  return (defOf(state, card).reactions ?? []).some((reaction) => reactionApplies(state, id, reaction, event));
}

function fireEvent(state: BattleState, event: PendingEvent): void {
  const reactors = [
    ...boardInstanceIds(state).filter((id) => id !== event.instanceId && canReact(state, id, event)),
    ...state.hand.filter((id) => id !== event.instanceId && canReact(state, id, event)),
  ];
  for (const id of reactors) {
    if (state.resolutionHalted) return;
    if (!consumeDepth(state)) return;
    const card = state.instances[id];
    if (!canReact(state, id, event)) continue;
    state.log.push(`react:${id}:${event.type}`);
    const reactions = (defOf(state, card).reactions ?? []).filter((reaction) => reactionApplies(state, id, reaction, event));
    for (const reaction of reactions) {
      runSegment(state, reaction.effects, {
        selfId: id,
        controller: card.owner,
        choice: emptyChoice(),
        eventSubjectId: event.instanceId,
        eventCell: event.cell,
        eachId: null,
        lastFaithSpent: 0,
      });
    }
  }
  if (state.resolutionHalted) return;
  fireFightReactions(state, event);
}

function fightReactionApplies(state: BattleState, reaction: Reaction, event: PendingEvent): boolean {
  if (reaction.event !== event.type) return false;
  const filter = reaction.subject;
  if (!filter) return true;
  const subject = state.instances[event.instanceId];
  if (!subject) return false;
  if (filter.owner && subject.owner !== filter.owner) return false;
  if (filter.hasMark && !event.marked) return false;
  if (filter.field && defOf(state, subject).ruleType !== 'field') return false;
  if (filter.ownerRelation || filter.adjacentToSelf || filter.onMirrorOf || filter.mirrorOfSelf) return false;
  return true;
}

function fireFightReactions(state: BattleState, event: PendingEvent): void {
  for (const reaction of state.fightReactions) {
    if (state.resolutionHalted) return;
    if (!fightReactionApplies(state, reaction, event)) continue;
    if (!consumeDepth(state)) return;
    state.log.push(`react:fight:${event.type}`);
    runSegment(state, reaction.effects, {
      selfId: event.instanceId,
      controller: 'enemy',
      choice: emptyChoice(),
      eventSubjectId: event.instanceId,
      eventCell: event.cell,
      eachId: null,
      lastFaithSpent: 0,
    });
  }
}

function stabilize(state: BattleState): void {
  while (!state.resolutionHalted) {
    const zeros = boardInstanceIds(state).filter((id) => currentPoints(state, id) === 0);
    if (zeros.length === 0) return;
    const id = zeros[0];
    const hadProtect = state.instances[id].protected;
    removeInstance(state, id, 'zero');
    const card = state.instances[id];
    if (
      hadProtect &&
      card.zone === 'board' &&
      card.cell !== null &&
      !card.protected &&
      currentPoints(state, id) === 0
    ) {
      removeInstance(state, id, 'zero');
    }
  }
}

function resolveQueue(state: BattleState): void {
  stabilize(state);
  let guard = 0;
  while (!state.resolutionHalted && state.pendingEvents.length > 0) {
    guard += 1;
    if (guard > CHAIN_DEPTH_LIMIT * 4) {
      state.resolutionHalted = true;
      state.log.push('error:zero-check depth limit 32');
      break;
    }
    const event = state.pendingEvents.shift();
    if (!event) break;
    fireEvent(state, event);
    stabilize(state);
  }
  flushLeaveFollowups(state);
  flushStayFollowups(state);
}

function pullFromHand(state: BattleState, id: string): void {
  state.hand = state.hand.filter((entry) => entry !== id);
}

function relation(
  state: BattleState,
  attackerId: string,
  cell: CellId,
): 'empty' | 'cover' | 'equal' | 'higher' | 'ally' | 'threshold' {
  const occupant = state.cells[cell];
  if (!occupant) return 'empty';
  const attacker = state.instances[attackerId];
  const defender = state.instances[occupant];
  if (defender.owner === attacker.owner) return 'ally';
  const attack = currentPoints(state, attackerId);
  const defense = currentPoints(state, occupant);
  if (attack < defense) return 'higher';
  const minimum = activeCoverThreshold(state, occupant);
  if (minimum !== null && attack < minimum) return 'threshold';
  return attack === defense ? 'equal' : 'cover';
}

export function inspectPlay(state: BattleState, request: PlayRequest): PlayRejection | null {
  const card = state.instances[request.instanceId];
  if (!card || !state.hand.includes(request.instanceId)) return 'not-in-hand';
  const definition = defOf(state, card);
  if (definition.ruleType === 'spell') {
    if (definition.spellNeeds && !spellHasNeededTarget(state, card, definition.spellNeeds)) return 'no-target';
    if (
      definition.spellTarget &&
      !spellTargetWaived(state, card, definition) &&
      !spellChoiceLegal(state, card, definition.spellTarget, request)
    ) {
      return 'no-target';
    }
    return null;
  }
  if (request.cell === undefined) return 'missing-cell';
  if (!isCellId(request.cell)) return 'illegal-cell';
  const found = relation(state, request.instanceId, request.cell);
  if (found === 'higher') return 'occupied-by-higher';
  if (found === 'ally' && !declaresAbsorb(definition.effects)) return 'occupied-by-ally';
  if (found === 'threshold') return 'below-threshold';
  return null;
}

function spellHasNeededTarget(state: BattleState, card: CardInstance, needs: 'enemy' | 'ally' | 'any'): boolean {
  return boardInstanceIds(state).some((id) => {
    const other = state.instances[id];
    if (needs === 'any') return true;
    if (needs === 'ally') return other.owner === card.owner;
    return other.owner !== card.owner;
  });
}

function spellTargetWaived(state: BattleState, card: CardInstance, definition: CardDefinition): boolean {
  const floor = definition.spellTargetBelowFaith;
  return floor !== undefined && state.faith[card.owner] >= floor;
}

function spellChoiceLegal(state: BattleState, card: CardInstance, query: FieldQuery, request: PlayRequest): boolean {
  const picked = request.choice?.targets?.[0];
  if (!picked) return false;
  return matchFieldQuery(state, card, card.owner, query).includes(picked);
}

export function hasLegalPlay(state: BattleState): boolean {
  return state.hand.some((id) => {
    const card = state.instances[id];
    if (card.owner !== 'player') return false;
    const definition = defOf(state, card);
    if (definition.ruleType === 'spell') {
      if (definition.spellTarget) {
        if (definition.spellNeeds && !spellHasNeededTarget(state, card, definition.spellNeeds)) return false;
        if (spellTargetWaived(state, card, definition)) return true;
        return matchFieldQuery(state, card, card.owner, definition.spellTarget).length > 0;
      }
      return inspectPlay(state, { instanceId: id }) === null;
    }
    return CELL_IDS.some((cell) => inspectPlay(state, { instanceId: id, cell }) === null);
  });
}

function finishUntracked(state: BattleState, id: string): void {
  if (isTracked(state, id)) return;
  sendUnentered(state, id);
}

/**
 * 夺舍者打到己方格：记下当前点数后移除（保护有效，触发离场），
 * 本卡进入该格并永久加上那个点数，然后再吃污染和零点检查。不走覆盖扣点。
 */
function absorbAllyPlay(
  state: BattleState,
  card: CardInstance,
  cell: CellId,
  occupantId: string,
  choice: Choice | undefined,
): void {
  const recorded = currentPoints(state, occupantId);
  removeInstance(state, occupantId, 'effect', card.instanceId);
  if (state.resolutionHalted) {
    finishUntracked(state, card.instanceId);
    return;
  }
  if (state.cells[cell] !== null) {
    finishUntracked(state, card.instanceId);
    queueEvent(state, 'played', card.instanceId, null);
    resolveQueue(state);
    return;
  }
  seat(state, card, cell);
  card.permanentMod += recorded;
  appendCue(state, {
    kind: 'absorb',
    sourceId: card.instanceId,
    sourceCell: cell,
    targetId: card.instanceId,
    cell,
    owner: card.owner,
    amount: recorded,
    toCell: null,
  });
  if (state.polluted.includes(cell)) card.permanentMod -= 1;
  queueEvent(state, 'played', card.instanceId, cell);
  queueEvent(state, 'entered', card.instanceId, cell);
  state.log.push(`enter:${card.instanceId}`);
  const effects = (defOf(state, card).effects ?? []).filter((opcode) => opcode.op !== 'absorbAlly');
  runSegment(state, effects, ctxOf(card, choice));
  resolveQueue(state);
}

function playResolved(state: BattleState, id: string, request: PlayRequest): void {
  const card = state.instances[id];
  const definition = defOf(state, card);
  pullFromHand(state, id);
  const choice = request.choice;

  if (definition.ruleType === 'spell') {
    const ctx = ctxOf(card, choice);
    note(state, ctx, 'cast', id, null);
    queueEvent(state, 'played', id, null);
    runSegment(state, definition.effects ?? [], ctx);
    finishUntracked(state, id);
    resolveQueue(state);
    return;
  }

  const cell = request.cell as CellId;
  const occupant = state.cells[cell];
  if (occupant && state.instances[occupant].owner === card.owner && declaresAbsorb(definition.effects)) {
    absorbAllyPlay(state, card, cell, occupant, choice);
    return;
  }
  if (!occupant) {
    seat(state, card, cell);
    if (state.polluted.includes(cell)) card.permanentMod -= 1;
    queueEvent(state, 'played', id, cell);
    queueEvent(state, 'entered', id, cell);
    state.log.push(`enter:${id}`);
    runSegment(state, definition.effects ?? [], ctxOf(card, choice));
    resolveQueue(state);
    return;
  }

  const defense = currentPoints(state, occupant);
  const attack = currentPoints(state, id);
  if (attack > defense) {
    removeInstance(state, occupant, 'cover', id);
    if (state.resolutionHalted) {
      finishUntracked(state, id);
      return;
    }
    card.permanentMod -= defense;
    seat(state, card, cell);
    if (state.polluted.includes(cell)) card.permanentMod -= 1;
    queueEvent(state, 'played', id, cell);
    queueEvent(state, 'entered', id, cell);
    state.log.push(`enter:${id}`);
    runSegment(state, definition.effects ?? [], ctxOf(card, choice));
    resolveQueue(state);
    return;
  }

  removeInstance(state, occupant, 'cover', id);
  finishUntracked(state, id);
  queueEvent(state, 'played', id, null);
  resolveQueue(state);
}

export function playCard(state: BattleState, request: PlayRequest): PlayResult {
  const rejection = inspectPlay(state, request);
  if (rejection) return { ok: false, reason: rejection, state };
  const consumedPlay = !state.instances[request.instanceId].swift;
  const effects = defOf(state, state.instances[request.instanceId]).effects ?? [];
  assertImplemented(effects);
  const next = openChain(state);
  rememberLeaveChoices(next, request.leaveChoices);
  playResolved(next, request.instanceId, request);
  return { ok: true, state: closeChain(next), consumedPlay, followUps: grantedFollowUps.get(next) ?? 0 };
}

export function executeOpcodes(state: BattleState, opcodes: Opcode[], request: EffectRequest): BattleState {
  assertImplemented(opcodes);
  const self = state.instances[request.selfId];
  if (!self) throw new Error(`Unknown instance: ${request.selfId}`);
  const controller = request.controller ?? self.owner;
  const plan = preflight(state, opcodes, controller);
  if (!plan.ok) return state;
  const next = openChain(state);
  rememberLeaveChoices(next, request.leaveChoices);
  const ctx: ExecCtx = {
    selfId: request.selfId,
    controller,
    choice: request.choice ?? emptyChoice(),
    eventSubjectId: null,
    eventCell: null,
    eachId: null,
    lastFaithSpent: 0,
  };
  for (let index = 0; index < opcodes.length; index += 1) {
    if (plan.skip.has(index)) continue;
    if (next.resolutionHalted) break;
    applyOpcode(next, opcodes[index], ctx);
  }
  resolveQueue(next);
  return closeChain(next);
}

/** Apply one waiting player leave effect. A target outside the prompt leaves the battle unchanged. */
export function resolveLeaveChoice(state: BattleState, targetId: string): BattleState {
  const current = state.leavePrompts[0];
  if (!current || !current.targets.includes(targetId)) return state;
  const next = openChain(state);
  next.leavePrompts = state.leavePrompts.slice(1);
  const card = next.instances[current.sourceId];
  if (card) runSegment(next, defOf(next, card).onLeave ?? [], ctxOf(card, { targets: [targetId] }));
  resolveQueue(next);
  return closeChain(next);
}

export function checkZero(state: BattleState): BattleState {
  const next = openChain(state);
  resolveQueue(next);
  return closeChain(next);
}

export function unseal(state: BattleState, side: Side): BattleState {
  const next = openChain(state);
  for (const id of boardInstanceIds(next)) {
    const card = next.instances[id];
    if (card.owner !== side || !card.sealed) continue;
    card.sealed = false;
    appendCue(next, {
      kind: 'unseal',
      sourceId: id,
      sourceCell: card.cell,
      targetId: id,
      cell: card.cell,
      owner: card.owner,
      amount: 0,
      toCell: null,
    });
  }
  return closeChain(next);
}

export function tickTimers(state: BattleState, side: Side): BattleState {
  const next = openChain(state);
  const ids = boardInstanceIds(next).filter((id) => {
    const card = next.instances[id];
    return card.owner === side && !card.sealed && card.timer !== null;
  });
  for (const id of ids) {
    if (next.resolutionHalted) break;
    const card = next.instances[id];
    if (card.zone !== 'board' || card.sealed || card.timer === null) continue;
    card.timer -= 1;
    if (card.timer <= 0) {
      const effects = card.timerEffects ?? defOf(next, card).onTimer ?? [];
      next.log.push(`timer:${id}`);
      appendCue(next, {
        kind: 'timer',
        sourceId: id,
        sourceCell: card.cell,
        targetId: id,
        cell: card.cell,
        owner: card.owner,
        amount: 0,
        toCell: null,
      });
      runSegment(next, effects, ctxOf(card, emptyChoice()));
      if (next.instances[id].zone === 'board') next.instances[id].timer = next.instances[id].timerMax;
    }
  }
  resolveQueue(next);
  return closeChain(next);
}

function turnEndChoiceFor(state: BattleState, card: CardInstance, timing: 'onTurnStart' | 'onTurnEnd', choice: Choice | undefined): Choice {
  const selected = choice?.targets ?? [];
  if (timing !== 'onTurnEnd' || selected.length === 0) return emptyChoice();
  const query = defOf(state, card).turnEndTarget;
  if (!query) return emptyChoice();
  const legal = new Set(matchFieldQuery(state, card, card.owner, query));
  const accepted = selected.filter((id) => legal.has(id));
  return accepted.length > 0 ? { targets: accepted } : emptyChoice();
}

function runSideTrigger(
  state: BattleState,
  side: Side,
  timing: 'onTurnStart' | 'onTurnEnd',
  choice?: Choice,
): BattleState {
  const next = openChain(state);
  const label = timing === 'onTurnStart' ? 'turn-start' : 'turn-end';
  const ids = [
    ...boardInstanceIds(next).filter((id) => next.instances[id].owner === side),
    ...next.hand.filter((id) => next.instances[id].owner === side),
  ];
  for (const id of ids) {
    if (next.resolutionHalted) break;
    const card = next.instances[id];
    if (card.sealed) continue;
    if (card.zone !== 'board' && card.zone !== 'hand') continue;
    const effects = defOf(next, card)[timing] ?? [];
    if (effects.length === 0) continue;
    next.log.push(`${label}:${id}`);
    runSegment(next, effects, ctxOf(card, turnEndChoiceFor(next, card, timing, choice)));
  }
  resolveQueue(next);
  return closeChain(next);
}

export function runTurnStartEffects(state: BattleState, side: Side): BattleState {
  return runSideTrigger(state, side, 'onTurnStart');
}

function runTurnStartCard(state: BattleState, card: CardInstance, effects: Opcode[], choice: Choice): void {
  state.log.push(`turn-start:${card.instanceId}`);
  runSegment(state, effects, ctxOf(card, choice));
}

/**
 * Turn-start effects in cell order, then hand order.
 * A card with `turnStartTarget` and at least one legal ally pauses for the player
 * unless `choices` or `fillChoice` already names one. An empty legal list runs
 * the effect with no target. Sealed cards are skipped. `done` is not run again.
 */
export function advanceTurnStart(
  state: BattleState,
  side: Side,
  input: {
    choices?: Readonly<Record<string, string>>;
    done?: readonly string[];
    fillChoice?: (state: BattleState, sourceId: string, legalTargetIds: string[]) => string | null;
  } = {},
): TurnEndStep {
  const next = openChain(state);
  const done = new Set(input.done ?? []);
  const choices = input.choices ?? {};
  const ids = [
    ...boardInstanceIds(next).filter((id) => next.instances[id].owner === side),
    ...next.hand.filter((id) => next.instances[id].owner === side),
  ];
  for (const id of ids) {
    if (done.has(id) || next.resolutionHalted) continue;
    const card = next.instances[id];
    if (!card || card.sealed || (card.zone !== 'board' && card.zone !== 'hand')) continue;
    const definition = defOf(next, card);
    const effects = definition.onTurnStart ?? [];
    if (effects.length === 0) continue;
    const query = definition.turnStartTarget;
    if (!query) {
      runTurnStartCard(next, card, effects, emptyChoice());
      done.add(id);
      continue;
    }
    const picked = choices[id];
    const legal = matchFieldQuery(next, card, card.owner, query);
    if (legal.length > 0 && picked && legal.includes(picked)) {
      runTurnStartCard(next, card, effects, { targets: [picked] });
      done.add(id);
      continue;
    }
    if (legal.length > 0 && input.fillChoice) {
      const filled = input.fillChoice(next, id, legal);
      const choice = filled && legal.includes(filled) ? { targets: [filled] } : emptyChoice();
      runTurnStartCard(next, card, effects, choice);
      done.add(id);
      continue;
    }
    if (legal.length === 0) {
      runTurnStartCard(next, card, effects, emptyChoice());
      done.add(id);
      continue;
    }
    resolveQueue(next);
    const current = next.instances[id];
    if (!current || current.sealed || (current.zone !== 'board' && current.zone !== 'hand')) {
      done.add(id);
      continue;
    }
    const visible = matchFieldQuery(next, current, current.owner, query);
    if (visible.length === 0) {
      runTurnStartCard(next, current, effects, emptyChoice());
      done.add(id);
      continue;
    }
    return { state: closeChain(next), pending: { sourceId: id, targets: visible }, done: [...done] };
  }
  resolveQueue(next);
  return { state: closeChain(next), pending: null, done: [...done] };
}

export function runTurnEndEffects(state: BattleState, side: Side): BattleState {
  return runSideTrigger(state, side, 'onTurnEnd');
}

/**
 * Turn-end step 2. Cards of either owner, cell order then hand order.
 * Call this only from the enemy turn-end pipeline.
 */
export function runEnemyTurnEndEffects(state: BattleState): BattleState {
  const next = openChain(state);
  const ids = [...boardInstanceIds(next), ...next.hand];
  for (const id of ids) {
    if (next.resolutionHalted) break;
    const card = next.instances[id];
    if (!card || card.sealed || (card.zone !== 'board' && card.zone !== 'hand')) continue;
    const effects = defOf(next, card).onEnemyTurnEnd ?? [];
    if (effects.length === 0) continue;
    next.log.push(`enemy-turn-end:${id}`);
    runSegment(next, effects, ctxOf(card, emptyChoice()));
  }
  resolveQueue(next);
  return closeChain(next);
}

/** Legal picks for turn-end effects that declared `turnEndTarget`. Does not settle the turn. */
export function pendingTurnEndTargets(state: BattleState, side: Side): TurnEndPrompt[] {
  const prompts: TurnEndPrompt[] = [];
  const ids = [
    ...boardInstanceIds(state).filter((id) => state.instances[id].owner === side),
    ...state.hand.filter((id) => state.instances[id].owner === side),
  ];
  for (const id of ids) {
    const card = state.instances[id];
    if (card.sealed || (card.zone !== 'board' && card.zone !== 'hand')) continue;
    const definition = defOf(state, card);
    if (!definition.turnEndTarget || (definition.onTurnEnd ?? []).length === 0) continue;
    prompts.push({
      sourceId: id,
      targets: matchFieldQuery(state, card, card.owner, definition.turnEndTarget),
    });
  }
  return prompts;
}

/**
 * Settle turn-end effects with the player's picks.
 * An omitted or empty selection calls `runTurnEndEffects` and does not apply a target.
 */
export function resolveTurnEndEffects(state: BattleState, side: Side, choice?: Choice): BattleState {
  if (!choice?.targets?.length) return runTurnEndEffects(state, side);
  return runSideTrigger(state, side, 'onTurnEnd', choice);
}

function usesChoice(opcode: Opcode): boolean {
  if (opcode.op === 'forEach' || opcode.op === 'when') return opcode.effects.some(usesChoice);
  if (opcode.op === 'ifFaith') return opcode.then.some(usesChoice) || opcode.else.some(usesChoice);
  if (opcode.op === 'ifOwner') {
    return opcode.target.ref === 'choice' || opcode.same.some(usesChoice) || opcode.opponent.some(usesChoice);
  }
  if (opcode.op === 'armTimer') return (opcode.onZero ?? []).some(usesChoice);
  if (opcode.op === 'modPermanent') {
    return (
      opcode.target.ref === 'choice' ||
      (opcode.onLeft ?? []).some(usesChoice) ||
      (opcode.onStayed ?? []).some(usesChoice)
    );
  }
  return 'target' in opcode && opcode.target.ref === 'choice';
}

/** Legal enter targets for a card that declares `playTarget`. Null when it does not ask. */
export function legalPlayTargets(state: BattleState, instanceId: string): string[] | null {
  const card = state.instances[instanceId];
  if (!card) return null;
  const definition = defOf(state, card);
  if (!definition.playTarget) return null;
  if (!(definition.effects ?? []).some(usesChoice)) return null;
  return matchFieldQuery(state, card, card.owner, definition.playTarget);
}

/**
 * Run turn-end effects in cell order, then hand order.
 * A card with `turnEndTarget` and at least one legal id pauses unless `choices`
 * already names one of those ids, or `fillChoice` supplies one.
 * An empty legal list skips that effect. Cards listed in `done` are not run again.
 */
export function advanceTurnEnd(
  state: BattleState,
  side: Side,
  input: {
    choices?: Readonly<Record<string, string>>;
    done?: readonly string[];
    fillChoice?: (state: BattleState, sourceId: string, legalTargetIds: string[]) => string | null;
  } = {},
): TurnEndStep {
  const next = openChain(state);
  const done = new Set(input.done ?? []);
  const choices = input.choices ?? {};
  const ids = [
    ...boardInstanceIds(next).filter((id) => next.instances[id].owner === side),
    ...next.hand.filter((id) => next.instances[id].owner === side),
  ];
  for (const id of ids) {
    if (done.has(id) || next.resolutionHalted) continue;
    const card = next.instances[id];
    if (!card || card.sealed || (card.zone !== 'board' && card.zone !== 'hand')) continue;
    const definition = defOf(next, card);
    const effects = definition.onTurnEnd ?? [];
    if (effects.length === 0) continue;
    const query = definition.turnEndTarget;
    if (!query) {
      runTurnEndCard(next, card, effects, emptyChoice());
      done.add(id);
      continue;
    }
    const picked = choices[id];
    const legal = matchFieldQuery(next, card, card.owner, query);
    if (legal.length > 0 && picked && legal.includes(picked)) {
      runTurnEndCard(next, card, effects, { targets: [picked] });
      done.add(id);
      continue;
    }
    if (legal.length > 0 && input.fillChoice) {
      const filled = input.fillChoice(next, id, legal);
      const choice = filled && legal.includes(filled) ? { targets: [filled] } : emptyChoice();
      runTurnEndCard(next, card, effects, choice);
      done.add(id);
      continue;
    }
    if (legal.length === 0) {
      runTurnEndCard(next, card, effects, emptyChoice());
      done.add(id);
      continue;
    }
    resolveQueue(next);
    const current = next.instances[id];
    if (!current || current.sealed || (current.zone !== 'board' && current.zone !== 'hand')) {
      done.add(id);
      continue;
    }
    const visible = matchFieldQuery(next, current, current.owner, query);
    if (visible.length === 0) {
      runTurnEndCard(next, current, effects, emptyChoice());
      done.add(id);
      continue;
    }
    return { state: closeChain(next), pending: { sourceId: id, targets: visible }, done: [...done] };
  }
  resolveQueue(next);
  return { state: closeChain(next), pending: null, done: [...done] };
}

function runTurnEndCard(state: BattleState, card: CardInstance, effects: Opcode[], choice: Choice): void {
  state.log.push(`turn-end:${card.instanceId}`);
  runSegment(state, effects, ctxOf(card, choice));
}

export function raiseForceSettlement(state: BattleState, reason: ForceReason): BattleState {
  const next = openChain(state);
  addReason(next, reason);
  return closeChain(next);
}

export function evaluateForceSettlement(
  state: BattleState,
  options?: { voluntaryPass?: boolean },
): BattleState {
  const next = openChain(state);
  if (CELL_IDS.every((cell) => next.cells[cell])) addReason(next, 'board');
  const legal = hasLegalPlay(next);
  const deckBlocked = next.deck.length === 0 || next.hand.length >= HAND_LIMIT;
  if (!(options?.voluntaryPass && legal) && !legal && deckBlocked) addReason(next, 'resource');
  return closeChain(next);
}

/**
 * Board appraisal for the side whose turn is starting.
 * That side wins only when their total points are strictly greater.
 * A tie or a deficit is not a result, and the turn continues.
 */
export function appraiseBoard(state: BattleState, side: Side): Winner | null {
  const other: Side = side === 'player' ? 'enemy' : 'player';
  return totalPoints(state, side) > totalPoints(state, other) ? side : null;
}

/**
 * Terminal comparison for resource and special settlement.
 * Higher total points wins. A points tie goes to the side with more cells.
 * If cells also tie, the side about to start loses.
 * A full board does not use this. See `appraiseBoard`.
 */
export function judgeWinner(state: BattleState, sideAboutToStart: Side): Winner {
  const playerPoints = totalPoints(state, 'player');
  const enemyPoints = totalPoints(state, 'enemy');
  if (playerPoints !== enemyPoints) return playerPoints > enemyPoints ? 'player' : 'enemy';
  const playerCells = occupiedCount(state, 'player');
  const enemyCells = occupiedCount(state, 'enemy');
  if (playerCells !== enemyCells) return playerCells > enemyCells ? 'player' : 'enemy';
  // TODO 【建议默认】点数与占格都相同：当前即将开始回合的一方判负。
  return sideAboutToStart === 'player' ? 'enemy' : 'player';
}
