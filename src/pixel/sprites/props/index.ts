import type { ShapeIcon } from '../../shapes'

export const PROPS: Record<string, ShapeIcon> = {
  desk: {
    id: 'prop.desk',
    size: [32, 20],
    ops: [
      { c: 'rect', x: 2, y: 6, w: 28, h: 5, f: 'wood2' },
      { c: 'rect', x: 3, y: 7, w: 26, h: 1, f: 'wood3' },
      { c: 'rect', x: 5, y: 11, w: 3, h: 7, f: 'wood1' },
      { c: 'rect', x: 24, y: 11, w: 3, h: 7, f: 'wood1' },
      { c: 'hl', x: 4, y: 7, w: 4 },
    ],
  },
}
