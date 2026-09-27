/**
 * 可复现随机。禁止 Math.random。
 * mulberry32，同一个种子会走出同一串 [0, 1) 小数。
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    const current = copy[index]
    const next = copy[swapIndex]
    if (current === undefined || next === undefined) throw new Error('洗牌下标越界')
    copy[index] = next
    copy[swapIndex] = current
  }
  return copy
}

export function pick<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) throw new Error('候选是空的')
  const chosen = items[Math.floor(rng() * items.length)]
  if (chosen === undefined) throw new Error('候选是空的')
  return chosen
}
