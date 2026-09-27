/**
 * Science starter against the preaching band.
 * Placement is generic. 审判官 asks chooseCardTarget. No search for a player play.
 */

import { getMonster, scienceStarter } from '../content';
import { chooseCardTarget, choosePlacement } from '../enemy';
import type { BattleState, CardDefinition, CellId, Opcode } from '../rules';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import { PREACHING_CARD_NAMES, preachingCard, type PreachingCardName } from '../scripts/preaching';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'preaching-band';

export function startPreachingEncounter(seed = 1): Encounter {
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
    { placeIntent: placePreachingIntent },
  );
  return { match };
}

/** Generic placement. Skip when choosePlacement has no cell. 审判官's target is chooseCardTarget. */
export function placePreachingIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  if (cell === null) return 'skip';
  if (intent.name === '审判官') armInquisitor(battle);
  return cell;
}

/**
 * chooseCardTarget already names 审判官: highest current points among unprotected player cards.
 * No such card means the spend and the remove both stay off. The card still occupies.
 */
function armInquisitor(battle: BattleState): void {
  const script = preachingCard('审判官');
  const definition = battle.definitions[script.id];
  if (!definition || script.status !== 'script') return;
  const canonical = structuredClone(script.definition.effects ?? []);
  const targetCell = chooseCardTarget(toIntentBoard(battle), '审判官');
  const targetId = targetCell === null ? null : battle.cells[targetCell];
  definition.effects = targetId === null ? [] : canonical.map((opcode) => aimAt(opcode, targetId));
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

function isPreachingName(name: string): name is PreachingCardName {
  return (PREACHING_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isPreachingName(name)) return preachingCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Preaching encounter cannot script ${name}`);
}
