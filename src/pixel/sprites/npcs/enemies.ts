import type { ShapeIcon } from '../../shapes'

/** 敌方占场：桌上器物，压迫时会动。 */
export const ENEMY_ICONS: Record<string, ShapeIcon> = {
  e1a: {
    id: 'npc.e1a',
    ops: [
      { c: 'rect', x: 8, y: 5, w: 8, h: 15, f: 'wood2' },
      { c: 'rect', x: 9, y: 6, w: 2, h: 13, f: 'wood3' },
      { c: 'rect', x: 7, y: 18, w: 10, h: 2, f: 'wood1' },
      { c: 'hl', x: 10, y: 7, w: 2 },
    ],
  },
  e1b: {
    id: 'npc.e1b',
    ops: [
      { c: 'disc', x: 12, y: 13, r: 7, f: 'slate' },
      { c: 'ell', x: 12, y: 12, rx: 5, ry: 4, f: 'slateL' },
      { c: 'hl', x: 9, y: 10, w: 3 },
    ],
  },
  e2a: {
    id: 'npc.e2a',
    ops: [
      { c: 'ell', x: 12, y: 12, rx: 8, ry: 6, f: 'cream' },
      { c: 'disc', x: 12, y: 12, r: 4, f: 'river2' },
      { c: 'disc', x: 12, y: 12, r: 2, f: 'ink' },
      { c: 'hl', x: 10, y: 10, w: 2 },
    ],
  },
  e2b: {
    id: 'npc.e2b',
    ops: [
      { c: 'poly', pts: [[6, 18], [8, 8], [11, 11], [12, 6], [15, 11], [17, 7], [18, 18]], f: 'tan' },
      { c: 'rect', x: 7, y: 16, w: 10, h: 3, f: 'wood1' },
      { c: 'hl', x: 9, y: 10, w: 2 },
    ],
  },
  e3a: {
    id: 'npc.e3a',
    ops: [
      { c: 'rect', x: 9, y: 3, w: 6, h: 17, f: 'stone' },
      { c: 'rect', x: 8, y: 3, w: 8, h: 3, f: 'stoneL' },
      { c: 'rect', x: 8, y: 18, w: 8, h: 3, f: 'gray1' },
      { c: 'hl', x: 10, y: 5, w: 2 },
    ],
  },
  e3b: {
    id: 'npc.e3b',
    ops: [
      { c: 'rect', x: 2, y: 9, w: 20, h: 5, f: 'wood1' },
      { c: 'rect', x: 3, y: 10, w: 18, h: 2, f: 'wood3' },
      { c: 'rect', x: 4, y: 8, w: 2, h: 7, f: 'wood2' },
      { c: 'rect', x: 18, y: 8, w: 2, h: 7, f: 'wood2' },
    ],
  },
  e3c: {
    id: 'npc.e3c',
    ops: [
      { c: 'ell', x: 12, y: 10, rx: 7, ry: 6, f: 'slate' },
      { c: 'poly', pts: [[12, 14], [8, 20], [16, 20]], f: 'copper' },
      { c: 'disc', x: 10, y: 9, r: 1, f: 'lamp1' },
      { c: 'hl', x: 9, y: 7, w: 2 },
    ],
  },
}
