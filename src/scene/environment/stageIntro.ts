/** Shared timing for the battle-table assembly. All values are seconds. */
export const STAGE_INTRO = {
  floorStart: 0,
  floorDuration: 1.15,
  monsterStart: 0.78,
  monsterDuration: 0.9,
  boardStart: 1.48,
  boardStep: 0.09,
  boardCellDuration: 0.48,
  propsStart: 2.55,
  propsDuration: 0.58,
  handStart: 2.78,
  handStep: 0.105,
  handCardDuration: 0.62,
  complete: 3.65,
} as const

export function stageProgress(elapsed: number, start: number, duration: number) {
  const linear = Math.max(0, Math.min(1, (elapsed - start) / duration))
  return 1 - Math.pow(1 - linear, 3)
}

let activeBattleKey = Number.NaN
let stageOrigin = 0

/** Elapsed time since this battle's table was assembled, not since the canvas was created. */
export function stageNow(battleKey: number, elapsedTime: number) {
  if (activeBattleKey !== battleKey || elapsedTime < stageOrigin) {
    activeBattleKey = battleKey
    stageOrigin = elapsedTime
  }
  return Math.max(0, elapsedTime - stageOrigin)
}
