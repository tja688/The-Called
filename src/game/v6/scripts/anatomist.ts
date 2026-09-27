/**
 * Opcode scripts for 解剖学家.
 * A printed clause is scripted only when the kernel can run it.
 * 标本柜 grows when a marked enemy leaves, and the listener reads the mark from that instant.
 * 逆向解析 adds 4 to an ally or subtracts 4 from an enemy, then strips the mark only if that card stayed.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, Reaction, RuleType } from '../rules';

export const ANATOMIST_CARD_NAMES = ['解剖台', '收容钳', '攻击炮台', '标本柜', '激光扫描仪', '逆向解析'] as const;

export type AnatomistCardName = (typeof ANATOMIST_CARD_NAMES)[number];

export interface AnatomistScripted {
  status: 'script';
  name: AnatomistCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface AnatomistBlocked {
  status: 'blocked';
  name: AnatomistCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type AnatomistCard = AnatomistScripted | AnatomistBlocked;

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
  turnEndTarget?: FieldQuery;
  reactions?: Reaction[];
  spellTarget?: FieldQuery;
  blocked?: readonly string[];
}

function printed(name: AnatomistCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: AnatomistCardName, parts: ScriptParts): CardDefinition {
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
  if (parts.turnEndTarget) definition.turnEndTarget = parts.turnEndTarget;
  if (parts.reactions) definition.reactions = parts.reactions;
  if (parts.spellTarget) definition.spellTarget = parts.spellTarget;
  return definition;
}

function script(name: AnatomistCardName, parts: ScriptParts): AnatomistScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

function blocked(name: AnatomistCardName, missing: string): AnatomistBlocked {
  return {
    status: 'blocked',
    name,
    id: printed(name).id,
    missing,
    definition: body(name, { effects: [] }),
  };
}

export const anatomistCards: readonly AnatomistCard[] = [
  script('解剖台', {
    effects: [],
    reactions: [
      {
        event: 'gainedMark',
        subject: { owner: 'player' },
        effects: [{ op: 'modPermanent', amount: 1, target: { ref: 'self' } }],
      },
    ],
  }),
  script('收容钳', {
    effects: [
      {
        op: 'remove',
        target: chosen,
        when: [{ kind: 'hasMark' }, { kind: 'pointsAtMost', max: 3 }],
      },
    ],
    playTarget: { owner: 'opponent', hasMark: true },
  }),
  script('攻击炮台', {
    effects: [],
    turnEndTarget: { owner: 'opponent', hasMark: true },
    onTurnEnd: [{ op: 'modPermanent', amount: -2, target: chosen }],
  }),
  script('标本柜', {
    effects: [],
    reactions: [
      {
        event: 'left',
        onBoard: true,
        subject: { ownerRelation: 'opponent', hasMark: true },
        effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
      },
    ],
  }),
  script('激光扫描仪', {
    effects: [],
    onTurnEnd: [
      {
        op: 'forEach',
        query: { owner: 'opponent', hasMark: true },
        effects: [{ op: 'modPermanent', amount: -1, target: { ref: 'each' } }],
      },
    ],
  }),
  script('逆向解析', {
    effects: [
      {
        op: 'ifOwner',
        target: chosen,
        same: [{ op: 'modPermanent', amount: 4, target: chosen, onStayed: [{ op: 'removeMark', target: chosen }] }],
        opponent: [{ op: 'modPermanent', amount: -4, target: chosen, onStayed: [{ op: 'removeMark', target: chosen }] }],
      },
    ],
    spellTarget: { owner: 'any', hasMark: true },
  }),
];

const byName = new Map<AnatomistCardName, AnatomistCard>(anatomistCards.map((card) => [card.name, card]));

export function anatomistCard(name: AnatomistCardName): AnatomistCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown anatomist card: ${name}`);
  return card;
}

export function scriptedAnatomist(name: AnatomistCardName): AnatomistScripted {
  const card = anatomistCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
