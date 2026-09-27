/**
 * Opcode scripts for the patrol swarm.
 * A printed clause is scripted only when the kernel can run it.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, RuleType } from '../rules';

export const PATROL_CARD_NAMES = ['蜂巢', '工蜂', '巡检探头', '测绘员', '收容钳', '定点清除'] as const;

export type PatrolCardName = (typeof PATROL_CARD_NAMES)[number];

export interface PatrolScripted {
  status: 'script';
  name: PatrolCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface PatrolBlocked {
  status: 'blocked';
  name: PatrolCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type PatrolCard = PatrolScripted | PatrolBlocked;

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
  onEnemyTurnEnd?: Opcode[];
  exhaust?: boolean;
  blocked?: readonly string[];
}

function printed(name: PatrolCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: PatrolCardName, parts: ScriptParts): CardDefinition {
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
  if (parts.onEnemyTurnEnd) definition.onEnemyTurnEnd = parts.onEnemyTurnEnd;
  if (parts.exhaust) definition.exhaust = true;
  return definition;
}

function script(name: PatrolCardName, parts: ScriptParts): PatrolScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

const workerId = printed('工蜂').id;

export const patrolCards: readonly PatrolCard[] = [
  script('蜂巢', {
    effects: [],
    onTurnEnd: [{ op: 'spawn', definitionId: workerId, cell: 'randomAdjacentEmpty' }],
  }),
  script('工蜂', { effects: [], exhaust: true }),
  script('巡检探头', {
    effects: [{ op: 'addMark', target: chosen }],
    playTarget: { owner: 'opponent' },
    onEnemyTurnEnd: [{ op: 'addMark', pick: 'random', target: { ref: 'query', owner: 'opponent', unmarked: true } }],
  }),
  script('测绘员', {
    effects: [
      { op: 'addMark', target: chosen },
      { op: 'addMark', target: { ref: 'query', owner: 'opponent', adjacentToChoice: true } },
    ],
    playTarget: { owner: 'opponent' },
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
  script('定点清除', {
    effects: [{ op: 'modPermanent', amount: -4, target: chosen, onLeft: [{ op: 'draw', count: 1 }] }],
    playTarget: { owner: 'opponent', hasMark: true },
  }),
];

const byName = new Map<PatrolCardName, PatrolCard>(patrolCards.map((card) => [card.name, card]));

export function patrolCard(name: PatrolCardName): PatrolCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown patrol card: ${name}`);
  return card;
}

export function scriptedPatrol(name: PatrolCardName): PatrolScripted {
  const card = patrolCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
