/**
 * Mystery fight against 镜中人.
 * Exclusive mirror cells come first. choosePlacement runs only when those cells are closed.
 * 镜匠's sacrifice is a kernel skip. The -3 is aimed at the player card on that mirror.
 */

import { getMonster, scienceStarter } from '../content';
import { choosePlacement } from '../enemy';
import type { BattleState, CardDefinition, CellId, Opcode } from '../rules';
import { mirrorCell } from '../rules';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import { MIRROR_CARD_NAMES, mirrorCard, type MirrorCardName } from '../scripts/mirror';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'mirror-person';

export function startMirrorEncounter(seed = 1): Encounter {
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
    { placeIntent: placeMirrorIntent },
  );
  return { match };
}

/**
 * 镜匠: empty mirror of the highest player card.
 * 银镜: empty mirror of the highest ally.
 * 双生子: empty mirror of any ally, smallest cell.
 * Otherwise the shared placer.
 */
export function placeMirrorIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const preferred = exclusiveCell(battle, intent.name);
  const cell =
    preferred ??
    choosePlacement(toIntentBoard(battle), {
      cardName: intent.name,
      monsterId: MONSTER_ID,
      currentPower: intent.basePoints ?? 0,
      occupies: intent.ruleType === 'field',
    });
  if (cell === null) return 'skip';
  if (intent.name === '镜匠') armMirrorWright(battle, intent, cell);
  return cell;
}

function exclusiveCell(battle: BattleState, name: string): CellId | undefined {
  const cells = toIntentBoard(battle).cells;
  if (name === '镜匠') return mirrorOfHighest(cells, 'player');
  if (name === '银镜') return mirrorOfHighest(cells, 'enemy');
  if (name === '双生子') return anyAllyMirror(cells);
  return undefined;
}

function mirrorOfHighest(
  cells: ReturnType<typeof toIntentBoard>['cells'],
  side: 'player' | 'enemy',
): CellId | undefined {
  const occupied = cells.filter((cell) => cell.owner === side && cell.cardName !== null);
  if (occupied.length === 0) return undefined;
  const max = Math.max(...occupied.map((cell) => cell.currentPower));
  const mirrors: CellId[] = [];
  for (const cell of occupied) {
    if (cell.currentPower !== max) continue;
    const mirror = mirrorCell(cell.index);
    if (mirror !== null && cells.some((entry) => entry.index === mirror && entry.owner === 'empty')) {
      mirrors.push(mirror);
    }
  }
  return minCell(mirrors);
}

function anyAllyMirror(cells: ReturnType<typeof toIntentBoard>['cells']): CellId | undefined {
  const mirrors: CellId[] = [];
  for (const cell of cells) {
    if (cell.owner !== 'enemy' || cell.cardName === null) continue;
    const mirror = mirrorCell(cell.index);
    if (mirror !== null && cells.some((entry) => entry.index === mirror && entry.owner === 'empty')) {
      mirrors.push(mirror);
    }
  }
  return minCell(mirrors);
}

function minCell(cells: readonly CellId[]): CellId | undefined {
  let best: CellId | undefined;
  for (const cell of cells) {
    if (best === undefined || cell < best) best = cell;
  }
  return best;
}

/** Keep the sacrifice opcode. Point the -3 at the player card on the mirror, or drop it. */
function armMirrorWright(battle: BattleState, intent: RevealedIntent, cell: CellId): void {
  const definition = battle.definitions[intent.definitionId];
  if (!definition) return;
  const canonical = structuredClone(intent.effects ?? []);
  const mirror = mirrorCell(cell);
  const targetId = mirror === null ? null : battle.cells[mirror];
  const target = targetId ? battle.instances[targetId] : undefined;
  const hit = target?.owner === 'player' ? targetId : null;
  definition.effects = hit === null ? canonical.filter((opcode) => !aimsAtChoice(opcode)) : canonical.map((opcode) => aimAt(opcode, hit));
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

function isMirrorName(name: string): name is MirrorCardName {
  return (MIRROR_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isMirrorName(name)) return mirrorCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Mirror encounter cannot script ${name}`);
}
