/**
 * Opcode scripts for 钟楼守望者.
 * A printed clause is scripted only when the kernel can run it.
 * 发条卫兵's cover on 大钟 is bound by instance at level start: presets skip enter,
 * and a field query cannot name a card.
 * 穿甲钻头 marks up to two different opponents. The enemy takes the highest
 * current points, the smallest cell on a tie, then the next card.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, RuleType } from '../rules';

export const BELL_CARD_NAMES = ['大钟', '发条卫兵', '圣殿守卫', '计时器', '穿甲钻头', '圣杯'] as const;

export type BellCardName = (typeof BELL_CARD_NAMES)[number];

export interface BellScripted {
  status: 'script';
  name: BellCardName;
  id: string;
  definition: CardDefinition;
  /** Printed clauses omitted because no opcode can run them. */
  blocked: readonly string[];
}

export interface BellBlocked {
  status: 'blocked';
  name: BellCardName;
  id: string;
  missing: string;
  /** Playable body. Effects stay empty so the text is not faked. */
  definition: CardDefinition;
}

export type BellCard = BellScripted | BellBlocked;

/** 发条卫兵: 大钟不能被点数小于 10 的牌覆盖. Source is the guard. */
export function clockworkCover(bellId: string): Opcode {
  return { op: 'grantCoverThreshold', min: 10, target: { ref: 'instance', id: bellId } };
}

interface Printed {
  id: string;
  ruleType: RuleType;
  basePoints: number | null;
}

interface ScriptParts {
  effects: Opcode[];
  playTarget?: FieldQuery;
  playTargetCount?: number;
  timer?: number;
  onTimer?: Opcode[];
  blocked?: readonly string[];
}

function printed(name: BellCardName): Printed {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind === 'spell') {
    if (card.basePower !== null) throw new Error(`Spell ${name} cannot have base points`);
    return { id: card.id, ruleType: 'spell', basePoints: null };
  }
  if (card.basePower === null) throw new Error(`Field card ${name} needs base points`);
  return { id: card.id, ruleType: 'field', basePoints: card.basePower };
}

function body(name: BellCardName, parts: ScriptParts): CardDefinition {
  const content = printed(name);
  const definition: CardDefinition = {
    id: content.id,
    name,
    ruleType: content.ruleType,
    basePoints: content.basePoints,
    effects: parts.effects,
  };
  if (parts.playTarget) definition.playTarget = parts.playTarget;
  if (parts.playTargetCount !== undefined) definition.playTargetCount = parts.playTargetCount;
  if (parts.timer !== undefined) definition.timer = parts.timer;
  if (parts.onTimer) definition.onTimer = parts.onTimer;
  return definition;
}

function script(name: BellCardName, parts: ScriptParts): BellScripted {
  const content = printed(name);
  return {
    status: 'script',
    name,
    id: content.id,
    definition: body(name, parts),
    blocked: parts.blocked ?? [],
  };
}

export const bellCards: readonly BellCard[] = [
  script('大钟', {
    effects: [],
    timer: 3,
    onTimer: [{ op: 'forceSettlement' }],
  }),
  script('发条卫兵', { effects: [] }),
  script('圣殿守卫', {
    effects: [{ op: 'grantCoverThreshold', min: 8, target: { ref: 'self' } }],
  }),
  script('计时器', {
    effects: [],
    timer: 2,
    onTimer: [
      { op: 'modPermanent', amount: -4, target: { ref: 'query', owner: 'opponent', mirrorOfSource: true } },
      { op: 'addMark', target: { ref: 'query', owner: 'opponent', mirrorOfSource: true } },
    ],
  }),
  script('穿甲钻头', {
    effects: [
      { op: 'addMark', target: { ref: 'choice', index: 0 } },
      { op: 'addMark', target: { ref: 'choice', index: 1 } },
    ],
    playTarget: { owner: 'opponent' },
    playTargetCount: 2,
  }),
  script('圣杯', {
    effects: [{ op: 'doubleFaith' }],
  }),
];

const byName = new Map<BellCardName, BellCard>(bellCards.map((card) => [card.name, card]));

export function bellCard(name: BellCardName): BellCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown bell card: ${name}`);
  return card;
}

export function scriptedBell(name: BellCardName): BellScripted {
  const card = bellCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
