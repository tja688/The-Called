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
  paw: {
    id: 'fx.paw',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'disc', x: 12, y: 14, r: 4, f: 'gold' },
      { c: 'disc', x: 7, y: 9, r: 2, f: 'sta' },
      { c: 'disc', x: 12, y: 7, r: 2, f: 'sta' },
      { c: 'disc', x: 17, y: 9, r: 2, f: 'sta' },
      { c: 'px', pts: [[12, 14]], f: 'ink' },
    ],
  },
  arrow: {
    id: 'fx.arrow',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'line', x1: 4, y1: 18, x2: 16, y2: 6, f: 'wood2', w: 2 },
      { c: 'poly', pts: [[16, 4], [20, 8], [14, 8]], f: 'gold' },
      { c: 'px', pts: [[6, 16], [5, 19], [8, 17]], f: 'cream' },
    ],
  },
  club: {
    id: 'fx.club',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'rect', x: 11, y: 10, w: 3, h: 10, f: 'wood2' },
      { c: 'ell', x: 12, y: 8, rx: 6, ry: 4, f: 'stone' },
      { c: 'px', pts: [[8, 6], [16, 7]], f: 'copper' },
    ],
  },
  shield: {
    id: 'fx.shield',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'poly', pts: [[12, 3], [19, 7], [17, 16], [12, 21], [7, 16], [5, 7]], f: 'dai' },
      { c: 'poly', pts: [[12, 6], [16, 9], [15, 14], [12, 17], [9, 14], [8, 9]], f: 'blueL' },
    ],
  },
  boom: {
    id: 'fx.boom',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'poly', pts: [[12, 2], [14, 9], [21, 8], [15, 13], [18, 21], [12, 16], [6, 21], [9, 13], [3, 8], [10, 9]], f: 'lamp2' },
      { c: 'disc', x: 12, y: 12, r: 3, f: 'lamp1' },
    ],
  },
  fuse: {
    id: 'fx.fuse',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'rect', x: 8, y: 10, w: 8, h: 10, f: 'wood1' },
      { c: 'rect', x: 7, y: 12, w: 10, h: 2, f: 'copperD' },
      { c: 'px', pts: [[12, 8], [12, 6], [13, 4]], f: 'lamp2' },
      { c: 'disc', x: 13, y: 3, r: 1, f: 'lamp1' },
    ],
  },
  net: {
    id: 'fx.net',
    size: [24, 24],
    shadow: false,
    ops: [
      { c: 'line', x1: 5, y1: 6, x2: 19, y2: 18, f: 'wood2', w: 1 },
      { c: 'line', x1: 19, y1: 6, x2: 5, y2: 18, f: 'wood2', w: 1 },
      { c: 'line', x1: 5, y1: 12, x2: 19, y2: 12, f: 'gray2', w: 1 },
      { c: 'line', x1: 12, y1: 5, x2: 12, y2: 19, f: 'gray2', w: 1 },
    ],
  },
}
