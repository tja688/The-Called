/**
 * Opcode scripts for the first tutorial battle.
 * Targets that a player (or the enemy caller) already chose arrive as choice.targets.
 * This module does not pick cells or targets.
 */

import { getCardByName } from '../content';
import type { CardDefinition, FieldQuery, Opcode, Reaction } from '../rules';

export const TUTORIAL_CARD_NAMES = [
  '斥候',
  '钻心器',
  '弱点采样机',
  '勘验员',
  '解析仪',
  '攻击炮台',
  '科学研究器',
  '弱点攻击器',
  '失控机械',
] as const;

export type TutorialCardName = (typeof TUTORIAL_CARD_NAMES)[number];

export interface ScriptedCard {
  status: 'script';
  name: TutorialCardName;
  id: string;
  definition: CardDefinition;
}

export interface BlockedCard {
  status: 'blocked';
  name: TutorialCardName;
  id: string;
  /** Capability the battle kernel does not provide yet. */
  missing: string;
}

export type TutorialCard = ScriptedCard | BlockedCard;

const chosen = { ref: 'choice', index: 0 } as const;

interface ScriptBody {
  effects?: Opcode[];
  onTurnEnd?: Opcode[];
  turnEndTarget?: FieldQuery;
  /** Enter effect that reads `choice`. The enemy fills one legal id. */
  playTarget?: FieldQuery;
  reactions?: Reaction[];
}

function contentOf(name: TutorialCardName): { id: string; name: TutorialCardName; basePoints: number } {
  const card = getCardByName(name);
  if (!card) throw new Error(`Missing content card: ${name}`);
  if (card.ruleKind !== 'permanent' || card.basePower === null) {
    throw new Error(`Tutorial card ${name} is not a field card`);
  }
  return { id: card.id, name, basePoints: card.basePower };
}

function script(name: TutorialCardName, body: Opcode[] | ScriptBody): ScriptedCard {
  const content = contentOf(name);
  const parts: ScriptBody = Array.isArray(body) ? { effects: body } : body;
  const definition: CardDefinition = {
    id: content.id,
    name: content.name,
    ruleType: 'field',
    basePoints: content.basePoints,
    effects: parts.effects ?? [],
  };
  if (parts.onTurnEnd) definition.onTurnEnd = parts.onTurnEnd;
  if (parts.turnEndTarget) definition.turnEndTarget = parts.turnEndTarget;
  if (parts.playTarget) definition.playTarget = parts.playTarget;
  if (parts.reactions) definition.reactions = parts.reactions;
  return { status: 'script', name, id: content.id, definition };
}

export const tutorialCards: readonly TutorialCard[] = [
  script('斥候', []),
  script('钻心器', []),
  script('弱点采样机', {
    effects: [{ op: 'addMark', target: chosen }],
    playTarget: { owner: 'opponent' },
  }),
  script('勘验员', [
    { op: 'addMark', target: { ref: 'query', owner: 'opponent', adjacentToSelf: true } },
  ]),
  script('解析仪', [
    {
      op: 'when',
      query: { owner: 'opponent', adjacentToSelf: true, hasMark: true },
      effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
    },
  ]),
  script('攻击炮台', {
    turnEndTarget: { owner: 'opponent', hasMark: true },
    onTurnEnd: [{ op: 'modPermanent', amount: -2, target: chosen }],
  }),
  script('科学研究器', {
    turnEndTarget: { owner: 'opponent', adjacentToSelf: true },
    onTurnEnd: [{ op: 'addMark', target: chosen }],
  }),
  script('弱点攻击器', {
    effects: [{ op: 'modPermanent', amount: -2, target: chosen }],
    playTarget: { owner: 'opponent', hasMark: true },
  }),
  script('失控机械', {
    reactions: [
      {
        event: 'played',
        subject: { adjacentToSelf: true, owner: 'player' },
        effects: [{ op: 'addMark', target: { ref: 'eventSubject' } }],
      },
    ],
  }),
];

const byName = new Map<TutorialCardName, TutorialCard>(tutorialCards.map((card) => [card.name, card]));

export function tutorialCard(name: TutorialCardName): TutorialCard {
  const card = byName.get(name);
  if (!card) throw new Error(`Unknown tutorial card: ${name}`);
  return card;
}

export function scriptedCard(name: TutorialCardName): ScriptedCard {
  const card = tutorialCard(name);
  if (card.status !== 'script') throw new Error(`${name} is blocked: ${card.missing}`);
  return card;
}
