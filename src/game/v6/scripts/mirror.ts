/**
 * Opcode scripts for 镜中人.
 * A printed clause is scripted only when the kernel can run it.
 * Enemy sacrifice is skipped by the kernel; the mirror -3 stays an opcode.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, Reaction, RuleType } from '../rules';

export const MIRROR_CARD_NAMES = ['古镜', '镜匠', '银镜', '双生子', '镜面翻转'] as const;

export type MirrorCardName = (typeof MIRROR_CARD_NAMES)[number];

export interface MirrorScripted {
  status: 'script';
  name: MirrorCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface MirrorBlocked {
  status: 'blocked';
  name: MirrorCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type MirrorCard = MirrorScripted | MirrorBlocked;

const chosen = { ref: 'choice', index: 0 } as const;

interface Printed {
  id: string;
  ruleType: RuleType;
  basePoints: number | null;
}

interface ScriptParts {
  effects: Opcode[];
  reactions?: Reaction[];
  spellTarget?: FieldQuery;
  blocked?: readonly string[];
}

function printed(name: MirrorCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: MirrorCardName, parts: ScriptParts): CardDefinition {
  const content = printed(name);
  const definition: CardDefinition = {
    id: content.id,
    name,
    ruleType: content.ruleType,
    basePoints: content.basePoints,
    effects: parts.effects,
  };
  if (parts.reactions) definition.reactions = parts.reactions;
  if (parts.spellTarget) definition.spellTarget = parts.spellTarget;
  return definition;
}

function script(name: MirrorCardName, parts: ScriptParts): MirrorScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

function blocked(name: MirrorCardName, missing: string): MirrorBlocked {
  const content = printed(name);
  return {
    status: 'blocked',
    name,
    id: content.id,
    missing,
    definition: body(name, { effects: [] }),
  };
}

export const mirrorCards: readonly MirrorCard[] = [
  script('古镜', {
    effects: [],
    reactions: [
      {
        event: 'played',
        subject: { ownerRelation: 'same', onMirrorOf: 'opponent' },
        effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'eventSubject' } }],
      },
    ],
  }),
  script('镜匠', {
    effects: [
      { op: 'sacrifice', count: 1 },
      { op: 'modPermanent', amount: -3, target: chosen },
    ],
  }),
  script('银镜', {
    effects: [{ op: 'grantAura', amount: 2, target: { ref: 'query', owner: 'same', mirrorOfSource: true } }],
  }),
  script('双生子', {
    effects: [
      {
        op: 'when',
        query: { owner: 'same', mirrorOfSource: true },
        effects: [
          { op: 'modPermanent', amount: 2, target: { ref: 'query', owner: 'same', mirrorOfSource: true } },
          { op: 'modPermanent', amount: 2, target: { ref: 'self' } },
        ],
      },
    ],
  }),
  script('镜面翻转', {
    spellTarget: { owner: 'same', emptyMirror: true },
    effects: [
      { op: 'moveToMirror', target: chosen },
      { op: 'draw', count: 1 },
    ],
  }),
];

const byName = new Map<MirrorCardName, MirrorCard>(mirrorCards.map((card) => [card.name, card]));

export function mirrorCard(name: MirrorCardName): MirrorCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown mirror card: ${name}`);
  return card;
}

export function scriptedMirror(name: MirrorCardName): MirrorScripted {
  const card = mirrorCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
