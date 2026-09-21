import type { ShapeIcon } from '../../shapes'

export const PROPS: Record<string, ShapeIcon> = {
  gate: {
    id: 'prop.gate',
    size: [32, 24],
    ops: [
      { c: 'rect', x: 4, y: 2, w: 4, h: 20, f: 'copperD' },
      { c: 'rect', x: 10, y: 2, w: 4, h: 20, f: 'gray1' },
      { c: 'rect', x: 16, y: 2, w: 4, h: 20, f: 'copperD' },
      { c: 'rect', x: 22, y: 2, w: 4, h: 20, f: 'copperD' },
      { c: 'rect', x: 3, y: 8, w: 24, h: 3, f: 'copper' },
      { c: 'hl', x: 6, y: 4, w: 2 },
    ],
  },
  chest: {
    id: 'prop.chest',
    size: [32, 20],
    ops: [
      { c: 'rect', x: 4, y: 8, w: 24, h: 10, f: 'wood1' },
      { c: 'rect', x: 4, y: 4, w: 24, h: 6, f: 'wood2' },
      { c: 'rect', x: 4, y: 10, w: 24, h: 2, f: 'copperD' },
      { c: 'px', pts: [[16, 12]], f: 'gold' },
    ],
  },
  well: {
    id: 'prop.well',
    size: [32, 20],
    ops: [
      { c: 'rect', x: 4, y: 8, w: 24, h: 8, f: 'stone' },
      { c: 'rect', x: 8, y: 10, w: 16, h: 4, f: 'river2' },
      { c: 'px', pts: [[4, 8], [26, 8], [6, 15]], f: 'leaf' },
    ],
  },
  anvil: {
    id: 'prop.anvil',
    size: [32, 20],
    ops: [
      { c: 'rect', x: 6, y: 6, w: 18, h: 5, f: 'gray1' },
      { c: 'rect', x: 11, y: 11, w: 8, h: 6, f: 'gray1' },
      { c: 'rect', x: 22, y: 3, w: 3, h: 8, f: 'copper' },
    ],
  },
  shield: {
    id: 'prop.shield',
    size: [32, 20],
    ops: [
      { c: 'poly', pts: [[4, 8], [28, 8], [24, 16], [8, 16]], f: 'gray1' },
      { c: 'ell', x: 16, y: 6, rx: 5, ry: 4, f: 'pack' },
      { c: 'px', pts: [[14, 5], [18, 5]], f: 'cream' },
    ],
  },
}
