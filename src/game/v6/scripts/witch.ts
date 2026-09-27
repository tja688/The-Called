/**
 * Opcode scripts for 镜渊魔女.
 * A printed clause is scripted only when the kernel can run it.
 * 镜像反射 rides on the 双生镜 definition, which every witch fight loads.
 * It is a fight listener, not that card's printed aura.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, Reaction, RuleType } from '../rules';

export const WITCH_CARD_NAMES = ['双生镜', '黑镜', '夺舍者', '星盘', '亡者低语', '冥河摆渡人'] as const;

export type WitchCardName = (typeof WITCH_CARD_NAMES)[number];

export interface WitchScripted {
  status: 'script';
  name: WitchCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface WitchBlocked {
  status: 'blocked';
  name: WitchCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type WitchCard = WitchScripted | WitchBlocked;

/** Printed base is overwritten at spawn. 镜影 has no effect, burns out, and belongs to the enemy. */
function mirrorShadeToken(): CardDefinition {
  const card = getCardByName('镜影');
  if (!card) throw new Error('Missing content card: 镜影');
  return {
    id: card.id,
    name: '镜影',
    ruleType: 'field',
    basePoints: 0,
    effects: [],
    exhaust: true,
  };
}

const mirrorShade = mirrorShadeToken();

const mirrorReactions: Reaction[] = [
  {
    event: 'entered',
    subject: { owner: 'player' },
    effects: [
      {
        op: 'spawn',
        definitionId: mirrorShade.id,
        cell: 'mirrorOfSubject',
        owner: 'enemy',
        basePoints: 'halfSubjectBase',
      },
    ],
  },
];

/** Monster skill. 镜影's own enter is an enemy card, so this listener does not see it. */
export const mirrorReflection = {
  status: 'script' as const,
  name: '镜像反射' as const,
  reactions: mirrorReactions,
};

interface Printed {
  id: string;
  ruleType: RuleType;
  basePoints: number | null;
}

interface ScriptParts {
  effects: Opcode[];
  onTurnStart?: Opcode[];
  reactions?: Reaction[];
  presence?: NonNullable<CardDefinition['presence']>;
  spellTarget?: FieldQuery;
  blocked?: readonly string[];
}

function printed(name: WitchCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: WitchCardName, parts: ScriptParts): CardDefinition {
  const content = printed(name);
  const definition: CardDefinition = {
    id: content.id,
    name,
    ruleType: content.ruleType,
    basePoints: content.basePoints,
    effects: parts.effects,
  };
  if (parts.onTurnStart) definition.onTurnStart = parts.onTurnStart;
  if (parts.reactions) definition.reactions = parts.reactions;
  if (parts.presence) definition.presence = parts.presence;
  if (parts.spellTarget) definition.spellTarget = parts.spellTarget;
  return definition;
}

function script(name: WitchCardName, parts: ScriptParts): WitchScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

const twinMirror = script('双生镜', {
  effects: [],
  presence: [{ amount: 2, target: { owner: 'same', selfWhileAllyMirror: true } }],
});

export const witchCards: readonly WitchCard[] = [
  {
    ...twinMirror,
    definition: {
      ...twinMirror.definition,
      fightReactions: mirrorReactions,
      tokens: [mirrorShade],
    },
  },
  script('黑镜', {
    effects: [],
    reactions: [
      {
        event: 'played',
        onBoard: true,
        subject: { ownerRelation: 'opponent', mirrorOfSelf: true },
        effects: [{ op: 'modPermanent', amount: -2, target: { ref: 'eventSubject' } }],
      },
    ],
  }),
  script('夺舍者', {
    effects: [{ op: 'absorbAlly' }],
  }),
  script('星盘', {
    effects: [],
    presence: [{ amount: 2, target: { owner: 'same', mirroredAlly: true } }],
  }),
  script('亡者低语', {
    effects: [
      {
        op: 'modPermanent',
        amount: { perOwnDiscard: -1, cap: 5 },
        target: { ref: 'choice', index: 0 },
      },
    ],
    spellTarget: { owner: 'opponent' },
  }),
  script('冥河摆渡人', {
    effects: [],
    onTurnStart: [{ op: 'sacrifice', count: 1 }],
    presence: [{ amount: 1, perOwnDiscard: true, target: { owner: 'same', self: true } }],
  }),
];

const byName = new Map<WitchCardName, WitchCard>(witchCards.map((card) => [card.name, card]));

export function witchCard(name: WitchCardName): WitchCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown witch card: ${name}`);
  return card;
}

export function scriptedWitch(name: WitchCardName): WitchScripted {
  const card = witchCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
