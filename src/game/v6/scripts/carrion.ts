/**
 * Opcode scripts for 食腐鸦群.
 * A printed clause is scripted only when the kernel can run it.
 * 提灯人 leaves after its own cell is already clear, then spawns one 2-point 残影.
 * 托孤者 gives +3 to another allied board card. 引魂铃 draws when another allied field card leaves.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, Reaction, RuleType } from '../rules';

export const CARRION_CARD_NAMES = ['鸦巢', '提灯人', '托孤者', '守墓人', '引魂铃', '骨匠'] as const;

export type CarrionCardName = (typeof CARRION_CARD_NAMES)[number];

export interface CarrionScripted {
  status: 'script';
  name: CarrionCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface CarrionBlocked {
  status: 'blocked';
  name: CarrionCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type CarrionCard = CarrionScripted | CarrionBlocked;

interface Printed {
  id: string;
  ruleType: RuleType;
  basePoints: number | null;
}

interface ScriptParts {
  effects: Opcode[];
  reactions?: Reaction[];
  onLeave?: Opcode[];
  leaveTarget?: FieldQuery;
  tokens?: CardDefinition[];
  blocked?: readonly string[];
}

function printed(name: CarrionCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: CarrionCardName, parts: ScriptParts): CardDefinition {
  const content = printed(name);
  const definition: CardDefinition = {
    id: content.id,
    name,
    ruleType: content.ruleType,
    basePoints: content.basePoints,
    effects: parts.effects,
  };
  if (parts.reactions) definition.reactions = parts.reactions;
  if (parts.onLeave) definition.onLeave = parts.onLeave;
  if (parts.leaveTarget) definition.leaveTarget = parts.leaveTarget;
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

function script(name: CarrionCardName, parts: ScriptParts): CarrionScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

const grewOnLeave: Reaction[] = [
  { event: 'left', effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }] },
];

export const carrionCards: readonly CarrionCard[] = [
  script('鸦巢', { effects: [], reactions: grewOnLeave }),
  script('提灯人', {
    effects: [],
    onLeave: [{ op: 'spawn', definitionId: shade.id, cell: 'randomEmpty', owner: 'self', basePoints: 2 }],
    tokens: [shade],
  }),
  script('托孤者', {
    effects: [],
    onLeave: [{ op: 'modPermanent', amount: 3, target: { ref: 'choice', index: 0 } }],
    leaveTarget: { owner: 'same' },
  }),
  script('守墓人', { effects: [], reactions: grewOnLeave }),
  script('引魂铃', {
    effects: [],
    reactions: [
      {
        event: 'left',
        onBoard: true,
        subject: { ownerRelation: 'same', field: true },
        effects: [{ op: 'draw', count: 1 }],
      },
    ],
  }),
  script('骨匠', {
    effects: [
      { op: 'sacrifice', count: 2 },
      { op: 'draw', count: 1 },
    ],
  }),
];

const byName = new Map<CarrionCardName, CarrionCard>(carrionCards.map((card) => [card.name, card]));

export function carrionCard(name: CarrionCardName): CarrionCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown carrion card: ${name}`);
  return card;
}

export function scriptedCarrion(name: CarrionCardName): CarrionScripted {
  const card = carrionCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
