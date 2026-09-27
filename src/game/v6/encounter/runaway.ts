/**
 * One runaway-machine fight, assembled from the science starter and the monster row.
 * No view. The caller reads a snapshot and sends plays, an end, or a target id.
 */

import { choosePlacement } from '../enemy';
import { getCardByName, getMonster, scienceStarter } from '../content';
import { scriptedCard, TUTORIAL_CARD_NAMES, type TutorialCardName } from '../scripts';
import { toIntentBoard } from '../turn/intentBoard';
import {
  answerChoice,
  endTurn,
  play,
  startMatch,
  type MatchState,
  type RevealedIntent,
} from '../turn';
import {
  currentPoints,
  totalPoints,
  type BattleState,
  type CardDefinition,
  type CellId,
  type PlayRequest,
  type Side,
} from '../rules';
import type { TurnRejection } from '../turn';

const MONSTER_ID = 'runaway-machine';

export interface Encounter {
  match: MatchState;
}

export interface EncounterCell {
  cell: CellId;
  instanceId: string | null;
  name: string | null;
  owner: Side | null;
  points: number | null;
  analyzed: boolean;
}

export interface EncounterHandCard {
  instanceId: string;
  name: string;
  points: number;
}

export interface EncounterTarget {
  instanceId: string;
  cell: CellId;
  name: string;
}

export interface EncounterSnapshot {
  cells: EncounterCell[];
  hand: EncounterHandCard[];
  intent: { name: string; effectText: string } | null;
  points: { player: number; enemy: number };
  waitingForPlayer: boolean;
  /** Set while a turn-end effect is waiting. Null during ordinary play. */
  choiceSource: { instanceId: string; name: string } | null;
  legalTargets: EncounterTarget[] | null;
}

export type EncounterPlay =
  | { ok: true; encounter: Encounter }
  | { ok: false; reason: TurnRejection; encounter: Encounter };

export function startRunawayEncounter(seed = 1): Encounter {
  const monster = getMonster(MONSTER_ID);
  if (!monster) throw new Error(`Missing monster ${MONSTER_ID}`);
  const preset = monster.presets[0];
  if (!preset) throw new Error(`${MONSTER_ID} has no preset`);
  const match = startMatch(
    {
      seed,
      cards: [
        ...scienceStarter.map((name) => ({
          definition: scriptOf(name),
          owner: 'player' as const,
          zone: 'deck' as const,
        })),
        {
          definition: scriptOf(preset.cardName),
          owner: 'enemy' as const,
          zone: 'board' as const,
          cell: preset.cell,
        },
      ],
      intents: monster.intents.map((name) => ({ definition: scriptOf(name), owner: 'enemy' as const })),
    },
    { placeIntent: placeRunawayIntent },
  );
  return { match };
}

/** Map the live board into the enemy package and place, or skip when it has no cell. */
export function placeRunawayIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  return cell ?? 'skip';
}

export function playEncounterCard(encounter: Encounter, request: PlayRequest): EncounterPlay {
  const result = play(encounter.match, request);
  if (!result.ok) return { ok: false, reason: result.reason, encounter };
  return { ok: true, encounter: { match: result.match } };
}

export function endEncounterTurn(encounter: Encounter): Encounter {
  return { match: endTurn(encounter.match) };
}

export function answerEncounterChoice(encounter: Encounter, targetId: string): Encounter {
  return { match: answerChoice(encounter.match, targetId) };
}

export function snapshotEncounter(encounter: Encounter): EncounterSnapshot {
  const { match } = encounter;
  const battle = match.battle;
  const pending = match.pendingChoice;
  const choosing = Boolean(pending && pending.targets.length > 0 && !match.over);
  return {
    cells: ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((cell) => viewCell(battle, cell)),
    hand: battle.hand.map((id) => ({
      instanceId: id,
      name: battle.definitions[battle.instances[id].definitionId]?.name ?? id,
      points: currentPoints(battle, id),
    })),
    intent: match.revealed
      ? {
          name: match.revealed.name,
          effectText: getCardByName(match.revealed.name)?.effectText ?? '',
        }
      : null,
    points: { player: totalPoints(battle, 'player'), enemy: totalPoints(battle, 'enemy') },
    waitingForPlayer: !match.over && (match.phase === 'playerAction' || choosing),
    choiceSource: choosing && pending ? { instanceId: pending.sourceId, name: sourceName(battle, pending.sourceId) } : null,
    legalTargets: choosing && pending ? pending.targets.flatMap((id) => viewTarget(battle, id)) : null,
  };
}

function viewCell(battle: BattleState, cell: CellId): EncounterCell {
  const id = battle.cells[cell];
  if (!id) {
    return { cell, instanceId: null, name: null, owner: null, points: null, analyzed: false };
  }
  const card = battle.instances[id];
  return {
    cell,
    instanceId: id,
    name: battle.definitions[card.definitionId]?.name ?? card.definitionId,
    owner: card.owner,
    points: currentPoints(battle, id),
    analyzed: card.analyzed,
  };
}

function viewTarget(battle: BattleState, id: string): EncounterTarget[] {
  const card = battle.instances[id];
  if (!card?.cell) return [];
  return [
    {
      instanceId: id,
      cell: card.cell,
      name: battle.definitions[card.definitionId]?.name ?? card.definitionId,
    },
  ];
}

function sourceName(battle: BattleState, id: string): string {
  const card = battle.instances[id];
  if (!card) return id;
  return battle.definitions[card.definitionId]?.name ?? card.definitionId;
}

function scriptOf(name: string): CardDefinition {
  if (!(TUTORIAL_CARD_NAMES as readonly string[]).includes(name)) {
    throw new Error(`Runaway encounter cannot script ${name}`);
  }
  return scriptedCard(name as TutorialCardName).definition;
}
