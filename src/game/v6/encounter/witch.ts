/**
 * Mystery fight against 镜渊魔女.
 * Cells 2 and 8 start as 双生镜. Printed base is 3; the standing aura shows 5.
 * 黑镜, 夺舍者, and 星盘 go through choosePlacement. 镜像反射 does not spawn.
 */

import { getMonster, scienceStarter } from '../content';
import { choosePlacement } from '../enemy';
import type { BattleState, CardDefinition, CellId } from '../rules';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import { WITCH_CARD_NAMES, witchCard, type WitchCardName } from '../scripts/witch';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'mirror-witch';

export function startWitchEncounter(seed = 1): Encounter {
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
    { placeIntent: placeWitchIntent },
  );
  return { match };
}

/**
 * 黑镜: empty cell whose mirror is also empty, most player neighbors, smallest cell.
 * 夺舍者: highest friendly 镜影, else the shared placer.
 * 星盘: empty mirror of any ally, else the shared placer.
 * choosePlacement already applies those three for monsterId mirror-witch.
 */
export function placeWitchIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  return cell ?? 'skip';
}

function isWitchName(name: string): name is WitchCardName {
  return (WITCH_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isWitchName(name)) return witchCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Witch encounter cannot script ${name}`);
}
