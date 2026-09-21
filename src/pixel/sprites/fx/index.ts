import type { ShapeIcon } from '../../shapes'

export const FX: Record<string, ShapeIcon> = {
  cover: {
    id: 'fx.cover',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'poly', pts: [[12, 3], [14, 10], [21, 12], [14, 14], [12, 21], [10, 14], [3, 12], [10, 10]], f: 'lamp2' },
      { c: 'disc', x: 12, y: 12, r: 2, f: 'lamp1' },
    ],
  },
  mark: {
    id: 'fx.mark',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'px', pts: [[6, 8], [10, 6], [14, 10], [8, 12], [16, 14], [12, 18], [18, 9]], f: 'gold' },
    ],
  },
  oil: {
    id: 'fx.oil',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'disc', x: 12, y: 13, r: 5, f: 'gold' },
      { c: 'px', pts: [[12, 6], [11, 9], [14, 8]], f: 'goldL' },
    ],
  },
}
