import type { ShapeIcon } from '../../shapes'

export const ICONS: Record<string, ShapeIcon> = {
  mana: {
    id: 'icon.mana',
    size: [16, 16],
    ops: [
      { c: 'poly', pts: [[8, 2], [13, 8], [8, 14], [3, 8]], f: 'dai' },
      { c: 'poly', pts: [[8, 4], [11, 8], [8, 12], [5, 8]], f: 'blueL' },
      { c: 'hl', x: 7, y: 5, w: 1 },
    ],
  },
  seal: {
    id: 'icon.seal',
    size: [16, 16],
    ops: [
      { c: 'ring', x: 8, y: 8, r: 5, f: 'gray2' },
      { c: 'rect', x: 7, y: 3, w: 2, h: 10, f: 'gray1' },
      { c: 'rect', x: 3, y: 7, w: 10, h: 2, f: 'gray1' },
    ],
  },
  lead: {
    id: 'icon.lead',
    size: [16, 16],
    ops: [
      { c: 'poly', pts: [[8, 2], [14, 8], [11, 8], [11, 14], [5, 14], [5, 8], [2, 8]], f: 'sta' },
      { c: 'hl', x: 7, y: 5, w: 2 },
    ],
  },
}
