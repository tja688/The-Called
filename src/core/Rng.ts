/**
 * 可序列化的确定性随机数（mulberry32）。
 */
export interface RngState {
  s: number
}

export function seedRng(seed: number): RngState {
  return { s: (seed >>> 0) || 0x9e3779b9 }
}

export function nextFloat(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0
  let t = r.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function nextInt(r: RngState, maxExclusive: number): number {
  return Math.floor(nextFloat(r) * maxExclusive)
}

export function pick<T>(r: RngState, arr: readonly T[]): T {
  return arr[nextInt(r, arr.length)]
}

export function shuffle<T>(r: RngState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(r, i + 1)
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
