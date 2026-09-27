export type MarkRing = { radius: number; x: number; y: number; tube: number }

export type MonsterMark = {
  rings: MarkRing[]
  slash: boolean
  stem: boolean
}

export function stageMotif(monsterId: string): 'eclipse' | 'split' | 'crescent' {
  if (
    monsterId === 'rahu-ketu'
    || monsterId === 'rust-colossus'
    || monsterId === 'bell-warden'
    || monsterId === 'silent-order'
  ) return 'split'
  if (
    monsterId === 'moon'
    || monsterId === 'mirror-person'
    || monsterId === 'mirror-witch'
    || monsterId === 'preaching-band'
  ) return 'crescent'
  return 'eclipse'
}

export function monsterMark(monsterId: string, radius: number): MonsterMark {
  if (monsterId === 'moon' || monsterId === 'mirror-person' || monsterId === 'mirror-witch') {
    return {
      slash: false,
      stem: false,
      rings: [
        { radius: radius * 1.15, x: 0, y: 0, tube: radius * 0.035 },
        { radius: radius * 0.72, x: radius * 0.38, y: 0, tube: radius * 0.5 },
        { radius: radius * 0.22, x: -radius * 0.55, y: radius * 0.35, tube: radius * 0.02 },
      ],
    }
  }
  if (monsterId === 'rahu-ketu' || monsterId === 'rust-colossus') {
    return {
      slash: true,
      stem: false,
      rings: [
        { radius: radius * 0.48, x: -radius * 0.72, y: radius * 0.42, tube: radius * 0.045 },
        { radius: radius * 0.48, x: radius * 0.72, y: -radius * 0.42, tube: radius * 0.045 },
        { radius: radius * 0.2, x: -radius * 0.72, y: radius * 0.42, tube: radius * 0.02 },
        { radius: radius * 0.2, x: radius * 0.72, y: -radius * 0.42, tube: radius * 0.02 },
      ],
    }
  }
  if (monsterId === 'patrol-swarm' || monsterId === 'carrion-crows') {
    return {
      slash: false,
      stem: false,
      rings: [
        { radius: radius * 0.28, x: 0, y: radius * 0.15, tube: radius * 0.03 },
        { radius: radius * 0.22, x: -radius * 0.42, y: -radius * 0.22, tube: radius * 0.025 },
        { radius: radius * 0.22, x: radius * 0.42, y: -radius * 0.22, tube: radius * 0.025 },
        { radius: radius * 0.16, x: -radius * 0.18, y: radius * 0.48, tube: radius * 0.02 },
        { radius: radius * 0.16, x: radius * 0.18, y: radius * 0.48, tube: radius * 0.02 },
      ],
    }
  }
  if (monsterId === 'bell-warden' || monsterId === 'preaching-band' || monsterId === 'silent-order') {
    return {
      slash: false,
      stem: true,
      rings: [
        { radius: radius * 0.72, x: 0, y: radius * 0.35, tube: radius * 0.04 },
        { radius: radius * 0.28, x: 0, y: radius * 0.35, tube: radius * 0.02 },
      ],
    }
  }
  if (monsterId === 'the-caller' || monsterId === 'anatomist') {
    return {
      slash: false,
      stem: false,
      rings: [
        { radius, x: 0, y: 0, tube: radius * 0.045 },
        { radius: radius * 0.62, x: 0, y: 0, tube: radius * 0.03 },
        { radius: radius * 0.18, x: 0, y: 0, tube: radius * 0.02 },
      ],
    }
  }
  return {
    slash: false,
    stem: false,
    rings: [
      { radius, x: 0, y: 0, tube: radius * 0.06 },
      { radius: radius * 0.62, x: 0, y: radius * 0.28, tube: radius * 0.04 },
    ],
  }
}
