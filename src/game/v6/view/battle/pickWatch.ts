import type { PlayChoiceView } from './playChoice'

/** 上方浮出的那一句。出牌前选牌和效果停下来等选牌用同一句。 */
export const PICK_PROMPT = '请选择一张卡...'

export type PickPhase =
  | { kind: 'idle' }
  | {
      kind: 'picking'
      /** play：挂在举起的手牌上，放下这张牌就取消。effect：规则停住等一个目标，放下手牌取消不了。 */
      source: 'play' | 'effect'
      boardIds: string[]
      deckIds: string[]
      prompt: typeof PICK_PROMPT
    }

export function waitingPlayTargets(
  choice: PlayChoiceView | null,
  picked: readonly string[],
): { boardIds: string[]; deckIds: string[] } {
  const empty = { boardIds: [] as string[], deckIds: [] as string[] }
  if (!choice || choice.blocked || choice.limit <= 0 || choice.targets.length === 0) return empty
  if (picked.length >= choice.limit) return empty
  const boardIds: string[] = []
  const deckIds: string[] = []
  for (const target of choice.targets) {
    if (picked.includes(target.instanceId)) continue
    if (target.zone === 'board') boardIds.push(target.instanceId)
    else deckIds.push(target.instanceId)
  }
  return { boardIds, deckIds }
}

/**
 * 选牌只由三样东西决定：举起的手牌、这张牌还没点完的目标、规则正在等的目标。
 * 不另存一个「正在选」开关。滚轮向后、打出、结束回合都会清掉举起的牌，出牌前的选牌因此一起结束。
 * 规则停住等目标时，这句提示盖过出牌前的选牌；放下手牌只取消后者。
 */
export function pickPhase(input: {
  armedCardId: string | undefined
  playBoardIds: readonly string[]
  playDeckIds: readonly string[]
  /** 没有这场等待时传 null。空数组表示停了，但没有可点的牌。 */
  effectIds: readonly string[] | null
}): PickPhase {
  if (input.effectIds && input.effectIds.length > 0) {
    return {
      kind: 'picking',
      source: 'effect',
      boardIds: [...input.effectIds],
      deckIds: [],
      prompt: PICK_PROMPT,
    }
  }
  if (!input.armedCardId) return { kind: 'idle' }
  if (input.playBoardIds.length === 0 && input.playDeckIds.length === 0) return { kind: 'idle' }
  return {
    kind: 'picking',
    source: 'play',
    boardIds: [...input.playBoardIds],
    deckIds: [...input.playDeckIds],
    prompt: PICK_PROMPT,
  }
}
