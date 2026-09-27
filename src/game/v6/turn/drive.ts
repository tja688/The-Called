import { chooseTarget, type TargetQuery } from '../enemy';
import { nextInt } from '../rules/rng';
import {
  HAND_LIMIT,
  advanceTurnEnd,
  advanceTurnStart,
  boardInstanceIds,
  checkZero,
  createBattle,
  currentPoints,
  evaluateForceSettlement,
  executeOpcodes,
  judgeWinner,
  legalPlayTargets,
  playCard as resolvePlay,
  resolveLeaveChoice,
  runEnemyTurnEndEffects,
  tickTimers,
  unseal,
  type BattleState,
  type CardInstance,
  type CellId,
  type Choice,
  type FieldQuery,
  type PlayRequest,
  type Side,
} from '../rules';
import { toIntentBoard } from './intentBoard';
import type {
  IntentSpec,
  LeaveGate,
  MatchHooks,
  MatchState,
  PlayOutcome,
  RevealedIntent,
  StartMatchInput,
  TurnPhase,
} from './types';

const OPENING_DRAW = 4;
const TURN_DRAW = 1;
const NON_SWIFT_PLAYS = 1;

/**
 * Level start through the eight phases.
 * Win, loss, cover, removal, and points stay in the battle kernel.
 * Monster placement is injected. This module does not search for a cell.
 */

export function startMatch(input: StartMatchInput, hooks: MatchHooks): MatchState {
  if (input.intents.length === 0) throw new Error('A match needs at least one intent');
  const intents = input.intents.map(normalizeIntent);
  let battle = createBattle({
    seed: input.seed,
    cards: input.cards,
    catalog: [...(input.catalog ?? []), ...intents.map((intent) => intent.definition)],
    polluted: input.polluted,
    faith: { player: 0, enemy: 0 },
  });
  battle = shuffleDeck(battle);
  battle = drawCards(battle, OPENING_DRAW);
  return openToAction({
    battle,
    phase: 'playerTurnStart',
    side: 'player',
    intentIndex: 1,
    revealed: null,
    playsRemaining: 0,
    over: false,
    winner: null,
    intents,
    hooks,
    pendingChoice: null,
    leaveGate: null,
    turnEndChoices: {},
    turnEndDone: [],
    turnStartChoices: {},
    turnStartDone: [],
  });
}

export function play(match: MatchState, request: PlayRequest): PlayOutcome {
  if (match.over) return { ok: false, reason: 'match-over', match };
  if (match.pendingChoice) return { ok: false, reason: 'wrong-phase', match };
  if (match.phase !== 'playerAction') return { ok: false, reason: 'wrong-phase', match };
  const card = match.battle.instances[request.instanceId];
  const inHand = Boolean(card && match.battle.hand.includes(request.instanceId));
  if (inHand && card && !card.swift && match.playsRemaining <= 0) {
    return { ok: false, reason: 'no-plays', match };
  }
  const result = resolvePlay(match.battle, request);
  if (!result.ok) return { ok: false, reason: result.reason, match };
  return {
    ok: true,
    match: withLeaveGate(
      {
        ...match,
        battle: result.state,
        playsRemaining: result.consumedPlay ? match.playsRemaining - 1 : match.playsRemaining,
      },
      'action',
    ),
  };
}

/** Leave player action, run both end pipelines, and stop on the next action or a judgment. */
export function endTurn(match: MatchState): MatchState {
  if (match.over) return match;
  if (match.pendingChoice) return match;
  if (match.phase !== 'playerAction') {
    throw new Error(`Cannot end the turn during ${match.phase}`);
  }
  const ending: MatchState = {
    ...match,
    phase: 'playerTurnEnd',
    side: 'player',
    playsRemaining: 0,
    pendingChoice: null,
    turnEndChoices: {},
    turnEndDone: [],
  };
  const playerEnd = applyTurnEnd(ending, 'player');
  if (playerEnd.over || playerEnd.pendingChoice) return playerEnd;
  const held = withLeaveGate(playerEnd, 'after-player-end');
  if (held.pendingChoice) return held;
  return finishEnemyAndOpen(held);
}

/**
 * Continue a player turn-end that stopped for a target.
 * A target outside the exposed list does not settle and does not move the turn.
 */
export function answerChoice(match: MatchState, targetId: string): MatchState {
  const pending = match.pendingChoice;
  if (!pending || match.over) return match;
  if (!pending.targets.includes(targetId)) return match;
  if (isLeaveHold(match)) return resumeLeave(match, targetId);
  if (match.phase === 'playerTurnStart') {
    const continued = finishTurnStart(
      {
        ...match,
        pendingChoice: null,
        turnStartChoices: { ...match.turnStartChoices, [pending.sourceId]: targetId },
      },
      'player',
    );
    if (continued.over || continued.pendingChoice) return continued;
    return revealAndDraw(continued);
  }
  const continued = applyTurnEnd(
    {
      ...match,
      pendingChoice: null,
      turnEndChoices: { ...match.turnEndChoices, [pending.sourceId]: targetId },
    },
    'player',
  );
  if (continued.over || continued.pendingChoice) return continued;
  const held = withLeaveGate(continued, 'after-player-end');
  if (held.pendingChoice) return held;
  return finishEnemyAndOpen(held);
}

function isLeaveHold(match: MatchState): boolean {
  const pending = match.pendingChoice;
  const prompt = match.battle.leavePrompts[0];
  if (!pending || !prompt) return false;
  return pending.sourceId === prompt.sourceId;
}

function withLeaveGate(match: MatchState, gate: LeaveGate): MatchState {
  if (match.over) return match;
  const prompt = match.battle.leavePrompts[0];
  if (!prompt || prompt.targets.length === 0) return { ...match, leaveGate: null };
  if (match.pendingChoice && !isLeaveHold(match)) return match;
  return {
    ...match,
    pendingChoice: { sourceId: prompt.sourceId, targets: [...prompt.targets] },
    leaveGate: gate,
  };
}

function resumeLeave(match: MatchState, targetId: string): MatchState {
  const gate = match.leaveGate;
  const cleared: MatchState = {
    ...match,
    battle: resolveLeaveChoice(match.battle, targetId),
    pendingChoice: null,
    leaveGate: null,
  };
  const held = withLeaveGate(cleared, gate ?? 'action');
  if (held.pendingChoice) return held;
  return continueAfterLeave(cleared, gate);
}

function continueAfterLeave(match: MatchState, gate: LeaveGate | null): MatchState {
  switch (gate) {
    case 'after-player-start':
      return withLeaveGate(revealAndDraw(match), 'action');
    case 'after-player-end':
      return finishEnemyAndOpen(match);
    case 'after-enemy-start':
      return continueAfterEnemyStart(match);
    case 'after-enemy-intent':
      return continueAfterEnemyIntent(match);
    case 'after-enemy-end':
      return openToAction(match);
    default:
      return match;
  }
}

function openToAction(match: MatchState): MatchState {
  const started = beginSide(match, 'player');
  if (started.over || started.pendingChoice) return started;
  return withLeaveGate(revealAndDraw(started), 'action');
}

function revealAndDraw(match: MatchState): MatchState {
  const revealed = reveal(match);
  const drawn = drawStep(revealed);
  return {
    ...drawn,
    phase: 'playerAction',
    side: 'player',
    playsRemaining: NON_SWIFT_PLAYS,
    pendingChoice: null,
    turnEndChoices: {},
    turnEndDone: [],
  };
}

function beginSide(match: MatchState, side: Side): MatchState {
  const phase: TurnPhase = side === 'player' ? 'playerTurnStart' : 'enemyTurnStart';
  let battle = unseal(match.battle, side);
  battle = tickTimers(battle, side);
  return finishTurnStart(
    {
      ...match,
      battle,
      phase,
      side,
      turnStartChoices: {},
      turnStartDone: [],
    },
    side,
  );
}

function finishTurnStart(match: MatchState, side: Side): MatchState {
  const phase: TurnPhase = side === 'player' ? 'playerTurnStart' : 'enemyTurnStart';
  const step = advanceTurnStart(match.battle, side, {
    choices: side === 'player' ? match.turnStartChoices : {},
    done: side === 'player' ? match.turnStartDone : [],
    fillChoice: side === 'enemy' ? fillEnemyTurnStart : undefined,
  });
  if (side === 'player' && step.pending) {
    return {
      ...match,
      battle: step.state,
      phase,
      side,
      playsRemaining: 0,
      pendingChoice: step.pending,
      turnStartDone: step.done,
    };
  }
  let battle = step.state;
  if (match.hooks.onSideTurnStart) battle = match.hooks.onSideTurnStart(battle, side);
  battle = checkZero(battle);
  if (!battle.forceSettlement) {
    return withLeaveGate(
      {
        ...match,
        battle,
        phase,
        side,
        pendingChoice: null,
        turnStartChoices: {},
        turnStartDone: [],
      },
      side === 'player' ? 'after-player-start' : 'after-enemy-start',
    );
  }
  return {
    ...match,
    battle,
    phase,
    side,
    playsRemaining: 0,
    over: true,
    winner: judgeWinner(battle, side),
    pendingChoice: null,
    turnStartChoices: {},
    turnStartDone: [],
  };
}

function finishEnemyAndOpen(match: MatchState): MatchState {
  const enemyStart = beginSide(match, 'enemy');
  if (enemyStart.over || enemyStart.pendingChoice) return enemyStart;
  return continueAfterEnemyStart(enemyStart);
}

function continueAfterEnemyStart(match: MatchState): MatchState {
  const enemyPlayed = enactIntent(match);
  const held = withLeaveGate(enemyPlayed, 'after-enemy-intent');
  if (held.pendingChoice) return held;
  return continueAfterEnemyIntent(held);
}

function continueAfterEnemyIntent(match: MatchState): MatchState {
  const enemyEnd = applyTurnEnd({ ...match, phase: 'enemyTurnEnd', side: 'enemy' }, 'enemy');
  if (enemyEnd.over || enemyEnd.pendingChoice) return enemyEnd;
  const held = withLeaveGate(enemyEnd, 'after-enemy-end');
  if (held.pendingChoice) return held;
  return openToAction(held);
}

function applyTurnEnd(match: MatchState, side: Side): MatchState {
  const step = advanceTurnEnd(match.battle, side, {
    choices: side === 'player' ? match.turnEndChoices : {},
    done: side === 'player' ? match.turnEndDone : [],
    fillChoice: side === 'enemy' ? fillEnemyChoice : undefined,
  });
  if (side === 'player' && step.pending) {
    return {
      ...match,
      battle: step.state,
      phase: 'playerTurnEnd',
      side: 'player',
      playsRemaining: 0,
      pendingChoice: step.pending,
      turnEndDone: step.done,
    };
  }
  let battle = step.state;
  if (side === 'enemy') {
    battle = runEnemyTurnEndEffects(battle);
    if (match.hooks.onEnemyTurnEnd) battle = match.hooks.onEnemyTurnEnd(battle);
  }
  battle = checkZero(battle);
  // Active end with a still-legal hand must not raise the resource flag.
  // An existing special flag is left in place; this call only adds reasons.
  battle = evaluateForceSettlement(battle, side === 'player' ? { voluntaryPass: true } : undefined);
  return {
    ...match,
    battle,
    pendingChoice: null,
    turnEndChoices: {},
    turnEndDone: [],
  };
}

function fillEnemyChoice(state: BattleState, sourceId: string, legalIds: string[]): string | null {
  const card = state.instances[sourceId];
  const query = card ? state.definitions[card.definitionId]?.turnEndTarget : undefined;
  if (!card || !query) return null;
  return pickEnemyTarget(state, card, legalIds, query);
}

function fillEnemyTurnStart(state: BattleState, sourceId: string, legalIds: string[]): string | null {
  const card = state.instances[sourceId];
  const query = card ? state.definitions[card.definitionId]?.turnStartTarget : undefined;
  if (!card || !query) return null;
  return pickEnemyTarget(state, card, legalIds, query);
}

function reveal(match: MatchState): MatchState {
  const count = match.intents.length;
  const cursor = (match.intentIndex - 1) % count;
  const spec = match.intents[cursor];
  return {
    ...match,
    phase: 'revealIntent',
    side: 'player',
    intentIndex: match.intentIndex >= count ? 1 : match.intentIndex + 1,
    revealed: showIntent(spec),
  };
}

function drawStep(match: MatchState): MatchState {
  return {
    ...match,
    phase: 'draw',
    side: 'player',
    battle: drawCards(match.battle, TURN_DRAW),
  };
}

function enactIntent(match: MatchState): MatchState {
  const revealed = match.revealed;
  if (!revealed) throw new Error('No revealed intent');
  const placement = match.hooks.placeIntent(match.battle, revealed);
  const battle = placement === 'skip' ? match.battle : playIntent(match.battle, revealed, placedCell(placement));
  return { ...match, battle, phase: 'enemyAction', side: 'enemy' };
}

function placedCell(placement: CellId | { cell: CellId; targets?: string[] }): CellId {
  return typeof placement === 'number' ? placement : placement.cell;
}

function showIntent(spec: IntentSpec): RevealedIntent {
  const definition = spec.definition;
  return {
    definitionId: definition.id,
    name: definition.name,
    owner: spec.owner ?? 'enemy',
    ruleType: definition.ruleType,
    basePoints: definition.basePoints,
    swift: Boolean(definition.swift),
    effects: definition.effects ? structuredClone(definition.effects) : undefined,
  };
}

function normalizeIntent(spec: IntentSpec): IntentSpec {
  return {
    definition: structuredClone(spec.definition),
    owner: spec.owner ?? 'enemy',
  };
}

/** Same Fisher-Yates the kernel uses. Discard is not shuffled back in. */
function shuffleDeck(state: BattleState): BattleState {
  const next = structuredClone(state);
  for (let index = next.deck.length - 1; index > 0; index -= 1) {
    const rolled = nextInt(next.rng, index + 1);
    next.rng = rolled.rng;
    const swap = next.deck[index];
    next.deck[index] = next.deck[rolled.n];
    next.deck[rolled.n] = swap;
  }
  return next;
}

function drawCards(state: BattleState, count: number): BattleState {
  if (count <= 0 || state.deck.length === 0 || state.hand.length >= HAND_LIMIT) return state;
  const selfId = state.deck[0] ?? state.hand[0] ?? boardInstanceIds(state)[0];
  if (!selfId) return state;
  return executeOpcodes(state, [{ op: 'draw', count }], { selfId, controller: 'player' });
}

/**
 * The kernel only plays cards that are already in hand, and spawning cannot cover.
 * Stage a fresh instance, then hand the play to the kernel. A rejected play
 * keeps the previous state, so the intent never enters and the index stays put.
 */
function playIntent(state: BattleState, intent: RevealedIntent, cell: CellId): BattleState {
  const definition = state.definitions[intent.definitionId];
  if (!definition) throw new Error(`Missing intent definition ${intent.definitionId}`);
  const staged = structuredClone(state);
  const instanceId = `i${staged.nextSerial++}`;
  const timerMax = definition.timer ?? null;
  const card: CardInstance = {
    instanceId,
    definitionId: definition.id,
    owner: intent.owner,
    zone: 'hand',
    cell: null,
    basePoints: definition.basePoints,
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
  staged.instances[instanceId] = card;
  staged.hand.push(instanceId);
  const choice = card.owner === 'enemy' ? enemyEnterChoice(staged, card, cell) : undefined;
  const result = resolvePlay(staged, { instanceId, cell, choice });
  return result.ok ? result.state : state;
}

function enemyEnterChoice(state: BattleState, card: CardInstance, cell: CellId): Choice | undefined {
  const legal = legalPlayTargets(state, card.instanceId);
  const definition = state.definitions[card.definitionId];
  const query = definition?.playTarget;
  if (!legal || !query || !definition) return undefined;
  const usable = legal.filter((id) => state.cells[cell] !== id);
  const count = definition.playTargetCount ?? 1;
  if (count <= 1) {
    const picked = pickEnemyTarget(state, card, usable, query);
    return picked ? { targets: [picked] } : undefined;
  }
  const picked = rankEnemyTargets(state, usable).slice(0, count);
  return picked.length > 0 ? { targets: picked } : undefined;
}

/** Highest current points, then the next. A tie keeps the smallest cell. */
function rankEnemyTargets(state: BattleState, legalIds: readonly string[]): string[] {
  return [...legalIds].sort((left, right) => {
    const byPoints = currentPoints(state, right) - currentPoints(state, left);
    if (byPoints !== 0) return byPoints;
    return (state.instances[left]?.cell ?? 9) - (state.instances[right]?.cell ?? 9);
  });
}

function pickEnemyTarget(
  state: BattleState,
  source: CardInstance,
  legalIds: readonly string[],
  query: FieldQuery,
): string | null {
  if (legalIds.length === 0) return null;
  const mapped = fieldQueryToTarget(source, query);
  if (mapped) {
    const cell = chooseTarget(toIntentBoard(state), mapped);
    if (cell !== null) {
      const id = state.cells[cell];
      if (id && legalIds.includes(id)) return id;
    }
  }
  let best: string | null = null;
  for (const id of legalIds) {
    const card = state.instances[id];
    if (!card?.cell) continue;
    if (!best) {
      best = id;
      continue;
    }
    const bestCard = state.instances[best];
    const points = currentPoints(state, id);
    const bestPoints = currentPoints(state, best);
    const bestCell = bestCard?.cell ?? 9;
    if (points > bestPoints || (points === bestPoints && card.cell < bestCell)) best = id;
  }
  return best;
}

function fieldQueryToTarget(source: CardInstance, query: FieldQuery): TargetQuery | null {
  const side =
    query.owner === 'same' ? source.owner : query.owner === 'opponent' ? (source.owner === 'player' ? 'enemy' : 'player') : null;
  if (!side) return null;
  const mapped: TargetQuery = { side };
  if (query.hasMark !== undefined) mapped.marked = query.hasMark;
  if (query.adjacentToSelf) {
    if (source.cell === null) return null;
    mapped.adjacentTo = source.cell;
  }
  return mapped;
}
