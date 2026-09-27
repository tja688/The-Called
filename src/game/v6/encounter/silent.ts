/**
 * Science starter against 缄默修会.
 * 干扰 is only cells 4 and 6, set once at level start.
 * 告解神父 and 驱魔人 aim their enter effects here. 大审判长 only places.
 */

import { getMonster, scienceStarter } from '../content';
import { chooseCardTarget, choosePlacement } from '../enemy';
import {
  CELL_IDS,
  adjacentFieldCards,
  currentPoints,
  isCellId,
  type BattleState,
  type CardDefinition,
  type CellId,
  type Opcode,
} from '../rules';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import { SILENT_CARD_NAMES, silentCard, type SilentCardName } from '../scripts/silent';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'silent-order';

export function startSilentEncounter(seed = 1): Encounter {
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
      polluted: monster.pollutedCells.filter(isCellId),
      intents: monster.intents.map((name) => ({ definition: scriptOf(name), owner: 'enemy' as const })),
    },
    { placeIntent: placeSilentIntent },
  );
  return { match };
}

/**
 * 告解神父 prefers an empty cell beside the highest player card.
 * 驱魔人 is generic. 大审判长 prefers the empty cell with the fewest player neighbors.
 * choosePlacement already falls back to generic placement. Skip when it has no cell.
 */
export function placeSilentIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  if (cell === null) return 'skip';
  if (intent.name === '告解神父') armConfessor(battle, intent, cell);
  if (intent.name === '驱魔人') armExorcist(battle, intent, cell);
  return cell;
}

/** Highest current points among player cards orthogonal to the landing cell. Tie: smallest cell. */
function armConfessor(battle: BattleState, intent: RevealedIntent, cell: CellId): void {
  const script = silentCard('告解神父');
  if (script.status !== 'script') return;
  aimEnter(battle, intent, script.definition.effects ?? [], adjacentPlayer(battle, cell));
}

/**
 * chooseCardTarget names 驱魔人: highest current points among player cards at 3 or below.
 * The card about to be covered is already gone when enter resolves, so it is not the target.
 * No remaining card means the remove stays off. The card still occupies.
 */
function armExorcist(battle: BattleState, intent: RevealedIntent, cell: CellId): void {
  const script = silentCard('驱魔人');
  if (script.status !== 'script') return;
  aimEnter(battle, intent, script.definition.effects ?? [], exorcistTarget(battle, cell));
}

function aimEnter(battle: BattleState, intent: RevealedIntent, canonical: readonly Opcode[], targetId: string | null): void {
  const definition = battle.definitions[intent.definitionId];
  if (!definition) return;
  const source = structuredClone(canonical);
  definition.effects =
    targetId === null ? source.filter((opcode) => !aimsAtChoice(opcode)) : source.map((opcode) => aimAt(opcode, targetId));
}

function adjacentPlayer(battle: BattleState, cell: CellId): string | null {
  let best: string | null = null;
  for (const id of adjacentFieldCards(battle, cell, 'player')) {
    const card = battle.instances[id];
    if (!card?.cell) continue;
    if (!best) {
      best = id;
      continue;
    }
    const points = currentPoints(battle, id);
    const bestPoints = currentPoints(battle, best);
    const bestCell = battle.instances[best]?.cell ?? 9;
    if (points > bestPoints || (points === bestPoints && card.cell < bestCell)) best = id;
  }
  return best;
}

function exorcistTarget(battle: BattleState, landing: CellId): string | null {
  const primary = chooseCardTarget(toIntentBoard(battle), '驱魔人');
  if (primary !== null && primary !== landing) return battle.cells[primary];
  let best: string | null = null;
  for (const cell of CELL_IDS) {
    if (cell === landing) continue;
    const id = battle.cells[cell];
    if (!id) continue;
    const card = battle.instances[id];
    if (!card || card.owner !== 'player') continue;
    const points = currentPoints(battle, id);
    if (points > 3) continue;
    if (!best) {
      best = id;
      continue;
    }
    const bestPoints = currentPoints(battle, best);
    const bestCell = battle.instances[best]?.cell ?? 9;
    if (points > bestPoints || (points === bestPoints && cell < bestCell)) best = id;
  }
  return best;
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

function isSilentName(name: string): name is SilentCardName {
  return (SILENT_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isSilentName(name)) return silentCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Silent encounter cannot script ${name}`);
}
