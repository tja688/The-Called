/**
 * Opcode scripts for 缄默修会.
 * A printed clause is scripted only when the kernel can run it.
 * 缄默刑柱 hears an opponent become sealed. Transferring owner is not a seal.
 * 大审判长 seals one opponent at its controller's turn start.
 * 庇佑祷词 protects allies and clears one negative. Faith at 3 covers every ally.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, Reaction, RuleType } from '../rules';

export const SILENT_CARD_NAMES = ['缄默刑柱', '告解神父', '驱魔人', '大审判长', '庇佑祷词'] as const;

export type SilentCardName = (typeof SILENT_CARD_NAMES)[number];

export interface SilentScripted {
  status: 'script';
  name: SilentCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface SilentBlocked {
  status: 'blocked';
  name: SilentCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type SilentCard = SilentScripted | SilentBlocked;

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
  turnStartTarget?: FieldQuery;
  reactions?: Reaction[];
  spellNeeds?: 'enemy' | 'ally' | 'any';
  spellTarget?: FieldQuery;
  spellTargetBelowFaith?: number;
  blocked?: readonly string[];
}

function printed(name: SilentCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: SilentCardName, parts: ScriptParts): CardDefinition {
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
  if (parts.turnStartTarget) definition.turnStartTarget = parts.turnStartTarget;
  if (parts.reactions) definition.reactions = parts.reactions;
  if (parts.spellNeeds) definition.spellNeeds = parts.spellNeeds;
  if (parts.spellTarget) definition.spellTarget = parts.spellTarget;
  if (parts.spellTargetBelowFaith !== undefined) definition.spellTargetBelowFaith = parts.spellTargetBelowFaith;
  return definition;
}

function script(name: SilentCardName, parts: ScriptParts): SilentScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

const ally: FieldQuery = { owner: 'same' };

const blessOne: Opcode[] = [
  { op: 'giveProtect', target: chosen },
  { op: 'clearNegative', target: chosen },
];

const blessAll: Opcode[] = [
  {
    op: 'forEach',
    query: ally,
    effects: [
      { op: 'giveProtect', target: { ref: 'each' } },
      { op: 'clearNegative', target: { ref: 'each' } },
    ],
  },
];

export const silentCards: readonly SilentCard[] = [
  script('缄默刑柱', {
    effects: [],
    reactions: [
      {
        event: 'sealed',
        onBoard: true,
        subject: { ownerRelation: 'opponent' },
        effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
      },
    ],
  }),
  script('告解神父', {
    effects: [{ op: 'seal', target: chosen }],
    playTarget: { owner: 'opponent', adjacentToSelf: true },
  }),
  script('驱魔人', {
    effects: [{ op: 'remove', target: chosen, when: [{ kind: 'pointsAtMost', max: 3 }] }],
    playTarget: { owner: 'opponent' },
  }),
  script('大审判长', {
    effects: [],
    onTurnStart: [{ op: 'seal', target: chosen }],
    turnStartTarget: { owner: 'opponent' },
  }),
  script('庇佑祷词', {
    effects: [{ op: 'ifFaith', atLeast: 3, then: blessAll, else: blessOne }],
    spellNeeds: 'ally',
    spellTarget: ally,
    spellTargetBelowFaith: 3,
  }),
];

const byName = new Map<SilentCardName, SilentCard>(silentCards.map((card) => [card.name, card]));

export function silentCard(name: SilentCardName): SilentCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown silent card: ${name}`);
  return card;
}

export function scriptedSilent(name: SilentCardName): SilentScripted {
  const card = silentCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
