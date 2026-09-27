/**
 * Opcode scripts for 呼唤者.
 * A printed clause is scripted only when the kernel can run it.
 * 呼唤 keeps its counter off the board: card timers tick before the skill step.
 * 彼岸花 hears another allied field card leave, then spawns one 3-point 残影.
 * 呓语 is shuffled into the player deck at the enemy turn end, and resolves when drawn.
 * 圣女 grants protect at her side's turn start. Her aura stays the enter effect.
 */

import { getCardByName } from '../content';
import {
  CELL_IDS,
  cardsInZone,
  currentPoints,
  executeOpcodes,
  shufflePrintedIntoDeck,
  type BattleState,
  type CardDefinition,
  type FieldQuery,
  type Opcode,
  type Reaction,
  type RuleType,
  type Side,
} from '../rules';

export const CALLER_CARD_NAMES = ['应召之核', '测绘员', '数据核心', '彼岸花', '圣女', '呓语'] as const;

export type CallerCardName = (typeof CALLER_CARD_NAMES)[number];

export interface CallerScripted {
  status: 'script';
  name: CallerCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface CallerBlocked {
  status: 'blocked';
  name: CallerCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type CallerCard = CallerScripted | CallerBlocked;

/** Monster skill. Counter lives in exile so the board timer step does not tick it. */
export const call = {
  status: 'script' as const,
  name: '呼唤' as const,
};

export const CALL_SKILL_ID = 'skill.the-caller.call';
export const CALL_INSTANCE_ID = 'caller-call';

/** Not a printed card. Exile spell so tickTimers, which only sees the board, skips it. */
export const callTimerDefinition: CardDefinition = {
  id: CALL_SKILL_ID,
  name: '呼唤',
  ruleType: 'spell',
  basePoints: null,
  timer: 2,
  effects: [],
};

/** Monster skill. One curse, shuffled into the player deck. It has no spell points. */
export const murmur = {
  status: 'script' as const,
  name: '呓语' as const,
};

/** Enemy turn end. The new 呓语 is owned by the player, so drawing it hits the player's board. */
export function shuffleMurmur(battle: BattleState): BattleState {
  return shufflePrintedIntoDeck(battle, callerCard('呓语').definition, 'player');
}

/** Reward is recorded on the monster. The +2 is not applied in battle. */
export const hugeCardBack = {
  status: 'blocked' as const,
  name: '巨大卡背' as const,
  missing: '点数 +2。装配尚未开放，奖励只记账，战斗里不加',
};

const chosen = { ref: 'choice', index: 0 } as const;

interface Printed {
  id: string;
  ruleType: RuleType;
  basePoints: number | null;
}

interface ScriptParts {
  effects: Opcode[];
  playTarget?: FieldQuery;
  onTurnStart?: Opcode[];
  onDraw?: Opcode[];
  turnStartTarget?: FieldQuery;
  reactions?: Reaction[];
  tokens?: CardDefinition[];
  blocked?: readonly string[];
}

function printed(name: CallerCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: CallerCardName, parts: ScriptParts): CardDefinition {
  const content = printed(name);
  const definition: CardDefinition = {
    id: content.id,
    name,
    ruleType: content.ruleType,
    basePoints: content.basePoints,
    effects: parts.effects,
  };
  if (parts.playTarget) definition.playTarget = parts.playTarget;
  if (parts.onTurnStart) definition.onTurnStart = parts.onTurnStart;
  if (parts.onDraw) definition.onDraw = parts.onDraw;
  if (parts.turnStartTarget) definition.turnStartTarget = parts.turnStartTarget;
  if (parts.reactions) definition.reactions = parts.reactions;
  if (parts.tokens) definition.tokens = parts.tokens;
  return definition;
}

/** Printed base is overwritten by the spawn. 残影 has no effect and burns out. */
function afterimage(): CardDefinition {
  const card = getCardByName('残影');
  if (!card) throw new Error('Missing content card: 残影');
  return {
    id: card.id,
    name: '残影',
    ruleType: 'field',
    basePoints: 0,
    effects: [],
    exhaust: true,
  };
}

const shade = afterimage();

const bloomOnAllyLeave: Reaction[] = [
  {
    event: 'left',
    onBoard: true,
    subject: { ownerRelation: 'same' },
    effects: [{ op: 'spawn', definitionId: shade.id, cell: 'randomEmpty', owner: 'self', basePoints: 3 }],
  },
];

function script(name: CallerCardName, parts: ScriptParts): CallerScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

function blocked(name: CallerCardName, missing: string): CallerBlocked {
  const content = printed(name);
  return {
    status: 'blocked',
    name,
    id: content.id,
    missing,
    definition: body(name, { effects: [] }),
  };
}

export const callerCards: readonly CallerCard[] = [
  script('应召之核', {
    effects: [{ op: 'grantCoverThreshold', min: 14, target: { ref: 'self' } }],
    onTurnStart: [{ op: 'modPermanent', amount: 1, target: { ref: 'self' } }],
  }),
  script('测绘员', {
    effects: [
      { op: 'addMark', target: chosen },
      { op: 'addMark', target: { ref: 'query', owner: 'opponent', adjacentToChoice: true } },
    ],
    playTarget: { owner: 'opponent' },
  }),
  script('数据核心', {
    effects: [
      {
        op: 'forEach',
        query: { owner: 'any', hasMark: true },
        effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
      },
    ],
  }),
  script('彼岸花', {
    effects: [],
    reactions: bloomOnAllyLeave,
    tokens: [shade],
  }),
  script('圣女', {
    effects: [{ op: 'grantAura', amount: 1, target: { ref: 'query', owner: 'same', hasProtect: true } }],
    onTurnStart: [{ op: 'giveProtect', target: { ref: 'choice', index: 0 } }],
    turnStartTarget: { owner: 'same' },
  }),
  script('呓语', {
    effects: [],
    onDraw: [{ op: 'modPermanent', amount: -2, target: { ref: 'query', owner: 'same', highest: true } }],
  }),
];

const byName = new Map<CallerCardName, CallerCard>(callerCards.map((card) => [card.name, card]));

export function callerCard(name: CallerCardName): CallerCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown caller card: ${name}`);
  return card;
}

export function scriptedCaller(name: CallerCardName): CallerScripted {
  const card = callerCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}

/**
 * Skill step of the enemy turn start. First call goes 2 → 1 and does not transfer.
 * The next goes to 0, moves the lowest player field card to the enemy, then resets to 2.
 * No player field card still resets. transferOwner does not remove.
 */
export function tickCall(battle: BattleState, side: Side): BattleState {
  if (side !== 'enemy') return battle;
  const timerId = callTimerId(battle);
  if (!timerId) return battle;
  const next = structuredClone(battle);
  const timer = next.instances[timerId];
  if (!timer || timer.timer === null) return battle;
  timer.timer -= 1;
  if (timer.timer > 0) return next;
  timer.timer = timer.timerMax ?? 2;
  const target = lowestPlayerField(next);
  if (!target) return next;
  return executeOpcodes(
    next,
    [{ op: 'transferOwner', target: { ref: 'instance', id: target }, to: 'enemy' }],
    { selfId: timerId, controller: 'enemy' },
  );
}

function callTimerId(battle: BattleState): string | null {
  const found = cardsInZone(battle, 'exile').find((card) => card.definitionId === CALL_SKILL_ID);
  return found?.instanceId ?? null;
}

function lowestPlayerField(battle: BattleState): string | null {
  let bestId: string | null = null;
  let bestPoints = 0;
  let bestCell = 9;
  for (const cell of CELL_IDS) {
    const id = battle.cells[cell];
    if (!id) continue;
    const card = battle.instances[id];
    if (!card || card.owner !== 'player' || card.zone !== 'board') continue;
    const points = currentPoints(battle, id);
    if (!bestId || points < bestPoints || (points === bestPoints && cell < bestCell)) {
      bestId = id;
      bestPoints = points;
      bestCell = cell;
    }
  }
  return bestId;
}
