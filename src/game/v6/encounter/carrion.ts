/**
 * Mystery fight against 食腐鸦群.
 * Placement is generic. Leave-time spawn and leave-time choice stay blocked.
 */

import { getMonster, scienceStarter } from '../content';
import { choosePlacement } from '../enemy';
import type { BattleState, CardDefinition, CellId } from '../rules';
import { CARRION_CARD_NAMES, carrionCard, type CarrionCardName } from '../scripts/carrion';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'carrion-crows';

export function startCarrionEncounter(seed = 1): Encounter {
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
    { placeIntent: placeCarrionIntent },
  );
  return { match };
}

/** Generic placement. Skip when choosePlacement has no cell. */
export function placeCarrionIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  return cell ?? 'skip';
}

function isCarrionName(name: string): name is CarrionCardName {
  return (CARRION_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isCarrionName(name)) return carrionCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Carrion encounter cannot script ${name}`);
}
