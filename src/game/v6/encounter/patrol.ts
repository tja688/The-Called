/**
 * Science starter against the patrol swarm.
 * Placement is generic. 收容钳 asks chooseCardTarget. No search for a player play.
 */

import { getMonster, scienceStarter } from '../content';
import { chooseCardTarget, choosePlacement } from '../enemy';
import type { BattleState, CardDefinition, CellId, Opcode } from '../rules';
import {
  PATROL_CARD_NAMES,
  TUTORIAL_CARD_NAMES,
  patrolCard,
  scriptedCard,
  type PatrolCardName,
  type TutorialCardName,
} from '../scripts';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'patrol-swarm';

export function startPatrolEncounter(seed = 1): Encounter {
  const monster = getMonster(MONSTER_ID);
  if (!monster) throw new Error(`Missing monster ${MONSTER_ID}`);
  const match = startMatch(
    {
      seed,
      cards: [
        ...scienceStarter.map((name) => ({
          definition: scriptOf(name),
          owner: 'player' as const,
          zone: 'deck' as const,
        })),
        ...monster.presets.map((preset) => ({
          definition: scriptOf(preset.cardName),
          owner: 'enemy' as const,
          zone: 'board' as const,
          cell: preset.cell,
        })),
      ],
      catalog: [patrolCard('工蜂').definition],
      intents: monster.intents.map((name) => ({ definition: scriptOf(name), owner: 'enemy' as const })),
    },
    { placeIntent: placePatrolIntent },
  );
  return { match };
}

/** Generic placement. Skip when choosePlacement has no cell. 收容钳's target is chooseCardTarget. */
export function placePatrolIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  if (cell === null) return 'skip';
  if (intent.name === '收容钳') armClamp(battle, intent);
  return cell;
}

function armClamp(battle: BattleState, intent: RevealedIntent): void {
  const definition = battle.definitions[intent.definitionId];
  if (!definition) return;
  const canonical = structuredClone(intent.effects ?? []);
  const targetCell = chooseCardTarget(toIntentBoard(battle), '收容钳');
  const targetId = targetCell === null ? null : battle.cells[targetCell];
  definition.effects =
    targetId === null ? canonical.filter((opcode) => !aimsAtChoice(opcode)) : canonical.map((opcode) => aimAt(opcode, targetId));
}

function aimsAtChoice(opcode: Opcode): boolean {
  return 'target' in opcode && opcode.target.ref === 'choice';
}

function aimAt(opcode: Opcode, instanceId: string): Opcode {
  if (!aimsAtChoice(opcode)) return opcode;
  const next = structuredClone(opcode) as Opcode & { target: { ref: 'instance'; id: string } };
  next.target = { ref: 'instance', id: instanceId };
  return next;
}

function isPatrolName(name: string): name is PatrolCardName {
  return (PATROL_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isPatrolName(name)) return patrolCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Patrol encounter cannot script ${name}`);
}
