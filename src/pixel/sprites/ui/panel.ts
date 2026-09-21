import type { ShapeIcon } from '../../shapes'

export const PANEL: ShapeIcon = {
  id: 'ui.panel',
  size: [24, 24],
  shadow: false,
  innerLines: true,
  ops: [
    { c: 'rect', x: 1, y: 1, w: 22, h: 22, f: 'tile1' },
    { c: 'rect', x: 2, y: 2, w: 20, h: 2, f: 'copperD' },
    { c: 'rect', x: 2, y: 20, w: 20, h: 2, f: 'ink2' },
    { c: 'rect', x: 2, y: 4, w: 1, h: 16, f: 'stone' },
  ],
}
