/**
 * Final fight against 呼唤者.
 * Cell 5 is 应召之核. Presets do not enter, so the cover threshold is applied once here.
 * 测绘员 and 数据核心 use generic choosePlacement. 彼岸花 and 圣女 use the
 * the-caller branch: fewest orthogonal player neighbors.
 * 呼唤 ticks on the enemy skill step. 呓语 shuffles in at the enemy turn end.
 */

import { getMonster, scienceStarter } from '../content';
import { choosePlacement } from '../enemy';
import { executeOpcodes, type BattleState, type CardDefinition, type CellId } from '../rules';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import {
  CALL_INSTANCE_ID,
  CALLER_CARD_NAMES,
  callTimerDefinition,
  callerCard,
  shuffleMurmur,
  tickCall,
  type CallerCardName,
} from '../scripts/caller';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'the-caller';

export function startCallerEncounter(seed = 1): Encounter {
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
        {
          definition: callTimerDefinition,
          owner: 'enemy' as const,
          zone: 'exile' as const,
          instanceId: CALL_INSTANCE_ID,
        },
      ],
      intents: monster.intents.map((name) => ({ definition: scriptOf(name), owner: 'enemy' as const })),
    },
    { placeIntent: placeCallerIntent, onSideTurnStart: tickCall, onEnemyTurnEnd: shuffleMurmur },
  );
  return { match: { ...match, battle: armCore(match.battle) } };
}

/**
 * 测绘员 and 数据核心 fall through to generic placement.
 * 彼岸花 and 圣女 are already special-cased for monsterId the-caller.
 */
export function placeCallerIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  return cell ?? 'skip';
}

/** Standing cover rule. The preset never enters, so the printed opcode has to run once. */
function armCore(battle: BattleState): BattleState {
  const id = battle.cells[5];
  const card = id ? battle.instances[id] : undefined;
  const script = callerCard('应召之核');
  if (!id || !card || script.status !== 'script') return battle;
  return executeOpcodes(battle, script.definition.effects ?? [], { selfId: id, controller: 'enemy' });
}

function isCallerName(name: string): name is CallerCardName {
  return (CALLER_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isCallerName(name)) return callerCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Caller encounter cannot script ${name}`);
}
