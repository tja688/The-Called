/**
 * Opcode scripts for 锈蚀巨像.
 * A printed clause is scripted only when the kernel can run it.
 * 调取图纸 takes one field card whose printed base is at least 8 from the deck into the hand.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, RuleType } from '../rules';

export const RUST_CARD_NAMES = ['钻心器', '霸占者', '过载电池', '调取图纸'] as const;

export type RustCardName = (typeof RUST_CARD_NAMES)[number];

export interface RustScripted {
  status: 'script';
  name: RustCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface RustBlocked {
  status: 'blocked';
  name: RustCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type RustCard = RustScripted | RustBlocked;

const chosen = { ref: 'choice', index: 0 } as const;

interface Printed {
  id: string;
  ruleType: RuleType;
  basePoints: number | null;
}

interface ScriptParts {
  effects: Opcode[];
  playTarget?: FieldQuery;
  onTurnEnd?: Opcode[];
  blocked?: readonly string[];
}

function printed(name: RustCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: RustCardName, parts: ScriptParts): CardDefinition {
  const content = printed(name);
  const definition: CardDefinition = {
    id: content.id,
    name,
    ruleType: content.ruleType,
    basePoints: content.basePoints,
    effects: parts.effects,
  };
  if (parts.playTarget) definition.playTarget = parts.playTarget;
  if (parts.onTurnEnd) definition.onTurnEnd = parts.onTurnEnd;
  return definition;
}

function script(name: RustCardName, parts: ScriptParts): RustScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

function blocked(name: RustCardName, missing: string): RustBlocked {
  return {
    status: 'blocked',
    name,
    id: printed(name).id,
    missing,
    definition: body(name, { effects: [] }),
  };
}

export const rustCards: readonly RustCard[] = [
  script('钻心器', { effects: [] }),
  script('霸占者', {
    effects: [{ op: 'modPermanent', amount: -2, target: chosen }],
    playTarget: { owner: 'same', adjacentToSelf: true },
  }),
  script('过载电池', {
    effects: [],
    onTurnEnd: [{ op: 'modPermanent', amount: -1, target: { ref: 'self' } }],
  }),
  script('调取图纸', {
    effects: [{ op: 'search', minBase: 8 }],
  }),
];

const byName = new Map<RustCardName, RustCard>(rustCards.map((card) => [card.name, card]));

export function rustCard(name: RustCardName): RustCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown rust card: ${name}`);
  return card;
}

export function scriptedRust(name: RustCardName): RustScripted {
  const card = rustCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
