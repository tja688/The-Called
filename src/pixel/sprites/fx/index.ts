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
  pressure: {
    id: 'fx.pressure',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'poly', pts: [[12, 4], [18, 12], [14, 12], [14, 20], [10, 20], [10, 12], [6, 12]], f: 'lamp3' },
      { c: 'rect', x: 5, y: 20, w: 14, h: 2, f: 'ink2' },
    ],
  },
}
