/**
 * Science starter against 锈蚀巨像.
 * No presets. 钻心器、霸占者、过载电池 cover first via choosePlacement.
 * 霸占者 drops the -2 when the landing cell has no orthogonal ally.
 */

import { getMonster, scienceStarter } from '../content';
import { choosePlacement } from '../enemy';
import { currentPoints, orthogonalNeighbors, type BattleState, type CardDefinition, type CellId, type Opcode } from '../rules';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import { RUST_CARD_NAMES, rustCard, type RustCardName } from '../scripts/rust';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'rust-colossus';

export function startRustEncounter(seed = 1): Encounter {
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
      intents: monster.intents.map((name) => ({ definition: scriptOf(name), owner: 'enemy' as const })),
    },
    { placeIntent: placeRustIntent },
  );
  return { match };
}

/**
 * Cover first, then an empty cell, then skip.
 * choosePlacement already treats these three names as cover-first.
 */
export function placeRustIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  if (cell === null) return 'skip';
  if (intent.name === '霸占者') armUsurper(battle, intent, cell);
  return cell;
}

/** Highest adjacent ally, smallest cell on a tie. No ally means the -2 is not played. */
function armUsurper(battle: BattleState, intent: RevealedIntent, cell: CellId): void {
  const definition = battle.definitions[intent.definitionId];
  if (!definition) return;
  const canonical = structuredClone(intent.effects ?? []);
  const targetId = adjacentAlly(battle, cell);
  definition.effects =
    targetId === null ? canonical.filter((opcode) => !aimsAtChoice(opcode)) : canonical.map((opcode) => aimAt(opcode, targetId));
}

function adjacentAlly(battle: BattleState, cell: CellId): string | null {
  let best: string | null = null;
  for (const neighbor of orthogonalNeighbors(cell)) {
    const id = battle.cells[neighbor];
    if (!id) continue;
    const card = battle.instances[id];
    if (!card || card.owner !== 'enemy' || card.cell === null) continue;
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

function aimsAtChoice(opcode: Opcode): boolean {
  return 'target' in opcode && opcode.target.ref === 'choice';
}

function aimAt(opcode: Opcode, instanceId: string): Opcode {
  if (!aimsAtChoice(opcode)) return opcode;
  const next = structuredClone(opcode) as Opcode & { target: { ref: 'instance'; id: string } };
  next.target = { ref: 'instance', id: instanceId };
  return next;
}

function isRustName(name: string): name is RustCardName {
  return (RUST_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isRustName(name)) return rustCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Rust encounter cannot script ${name}`);
}
