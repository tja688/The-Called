/** Mulberry32. Battle code must not call Math.random. */

export function mixSeed(seed: number): number {
  return seed >>> 0;
}

export function nextUnit(rng: number): { rng: number; value: number } {
  let t = (rng + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const mixed = (t ^ (t >>> 14)) >>> 0;
  return { rng: t >>> 0, value: mixed / 4294967296 };
}

export function nextInt(rng: number, maxExclusive: number): { rng: number; n: number } {
  if (maxExclusive <= 0) return { rng, n: 0 };
  const rolled = nextUnit(rng);
  return { rng: rolled.rng, n: Math.floor(rolled.value * maxExclusive) };
}
