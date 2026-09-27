/**
 * Opcode scripts for the preaching band.
 * A printed clause is scripted only when the kernel can run it.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, RuleType } from '../rules';

export const PREACHING_CARD_NAMES = ['讲经台', '辅祭', '神圣骑士', '审判官', '祷告灯'] as const;

export type PreachingCardName = (typeof PREACHING_CARD_NAMES)[number];

export interface PreachingScripted {
  status: 'script';
  name: PreachingCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface PreachingBlocked {
  status: 'blocked';
  name: PreachingCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type PreachingCard = PreachingScripted | PreachingBlocked;

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
  blocked?: readonly string[];
}

function printed(name: PreachingCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: PreachingCardName, parts: ScriptParts): CardDefinition {
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
  return definition;
}

function script(name: PreachingCardName, parts: ScriptParts): PreachingScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

function blocked(name: PreachingCardName, missing: string): PreachingBlocked {
  const content = printed(name);
  return {
    status: 'blocked',
    name,
    id: content.id,
    missing,
    definition: body(name, { effects: [] }),
  };
}

export const preachingCards: readonly PreachingCard[] = [
  script('讲经台', {
    effects: [],
    onTurnStart: [{ op: 'gainFaith', amount: 2 }],
  }),
  script('辅祭', {
    effects: [{ op: 'gainFaith', amount: 3 }],
  }),
  script('神圣骑士', {
    effects: [
      {
        op: 'ifFaith',
        atLeast: 4,
        then: [
          { op: 'giveProtect', target: { ref: 'self' } },
          { op: 'modPermanent', amount: 3, target: { ref: 'self' } },
        ],
        else: [{ op: 'gainFaith', amount: 1 }],
      },
    ],
  }),
  script('审判官', {
    effects: [
      { op: 'spendFaith', amount: 4 },
      { op: 'remove', target: chosen },
    ],
    playTarget: { owner: 'opponent' },
  }),
  script('祷告灯', {
    effects: [
      { op: 'giveProtect', target: chosen },
      { op: 'gainFaith', amount: 1 },
    ],
    playTarget: { owner: 'same' },
  }),
];

const byName = new Map<PreachingCardName, PreachingCard>(preachingCards.map((card) => [card.name, card]));

export function preachingCard(name: PreachingCardName): PreachingCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown preaching card: ${name}`);
  return card;
}

export function scriptedPreaching(name: PreachingCardName): PreachingScripted {
  const card = preachingCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
