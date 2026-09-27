import type { CueKind, EffectCue } from './types';

/** How long the picture stays up before the next one may start. */
export function cueMs(kind: CueKind): number {
  switch (kind) {
    case 'mark':
    case 'unmark':
      return 300;
    case 'protect':
    case 'guard':
      return 420;
    case 'remove':
      return 760;
    case 'spawn':
      return 620;
    case 'draw':
    case 'search':
      return 780;
    case 'cast':
      return 280;
    case 'cover':
      return 360;
    default:
      return 420;
  }
}

export function appendCue(state: { cues: EffectCue[] }, cue: Omit<EffectCue, 'seq'>): void {
  const last = state.cues.length > 0 ? state.cues[state.cues.length - 1].seq : 0;
  state.cues.push({ ...cue, seq: last + 1 });
}

/** Cues appended since `before`. Order is the kernel's settlement order. */
export function freshCues(before: readonly EffectCue[], after: readonly EffectCue[]): EffectCue[] {
  const seq = before.length > 0 ? before[before.length - 1].seq : 0;
  return after.filter((cue) => cue.seq > seq);
}

/**
 * A cover that is immediately followed by the arriving card on that cell
 * is the landing itself. The landing picture carries it.
 */
export function presentCues(cues: readonly EffectCue[]): EffectCue[] {
  const kept: EffectCue[] = [];
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    const next = cues[index + 1];
    if (cue.kind === 'cover' && next?.kind === 'arrive' && next.cell !== null && next.cell === cue.cell) continue;
    kept.push(cue);
  }
  return kept;
}
