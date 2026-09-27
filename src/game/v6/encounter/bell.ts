/**
 * Science starter against 钟楼守望者.
 * Cell 2 is 大钟. Cell 8 is 发条卫兵. Presets do not enter.
 * 封锁 seals one random player card at the enemy turn-start skill step.
 * 圣殿守卫, 计时器, and 穿甲钻头 go through choosePlacement for bell-warden.
 * 巨大卡背 stays on the monster reward. This fight does not equip it.
 */

import { getMonster, scienceStarter } from '../content';
import { choosePlacement } from '../enemy';
import { boardInstanceIds, executeOpcodes, type BattleState, type CardDefinition, type CellId, type Side } from '../rules';
import { nextInt } from '../rules/rng';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import { BELL_CARD_NAMES, bellCard, clockworkCover, type BellCardName } from '../scripts/bell';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'bell-warden';

export function startBellEncounter(seed = 1): Encounter {
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
    { placeIntent: placeBellIntent, onSideTurnStart: bellBlockade },
  );
  return { match: { ...match, battle: armClockwork(match.battle) } };
}

/**
 * 圣殿守卫 prefers an empty cell orthogonal to 大钟.
 * 计时器 prefers the empty mirror of the highest player card.
 * 穿甲钻头 covers first.
 * choosePlacement already falls back to generic placement. Skip when it has no cell.
 */
export function placeBellIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  return cell ?? 'skip';
}

/** Enemy turn-start skill step. One uniform player card. None means the battle is unchanged. */
export function bellBlockade(battle: BattleState, side: Side): BattleState {
  if (side !== 'enemy') return battle;
  const ids = boardInstanceIds(battle).filter((id) => battle.instances[id]?.owner === 'player');
  if (ids.length === 0) return battle;
  const rolled = nextInt(battle.rng, ids.length);
  const picked = ids[rolled.n];
  if (!picked) return battle;
  const prepared = structuredClone(battle);
  prepared.rng = rolled.rng;
  return executeOpcodes(prepared, [{ op: 'seal', target: { ref: 'instance', id: picked } }], {
    selfId: picked,
    controller: 'enemy',
  });
}

/** Presets skip enter, so the guard's cover on 大钟 is granted once the two cards exist. */
function armClockwork(battle: BattleState): BattleState {
  const bellId = instanceNamed(battle, '大钟');
  const guardId = instanceNamed(battle, '发条卫兵');
  if (!bellId || !guardId) return battle;
  return executeOpcodes(battle, [clockworkCover(bellId)], { selfId: guardId, controller: 'enemy' });
}

function instanceNamed(battle: BattleState, name: string): string | null {
  for (const id of boardInstanceIds(battle)) {
    const card = battle.instances[id];
    if (battle.definitions[card.definitionId]?.name === name) return id;
  }
  return null;
}

function isBellName(name: string): name is BellCardName {
  return (BELL_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isBellName(name)) return bellCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Bell encounter cannot script ${name}`);
}
