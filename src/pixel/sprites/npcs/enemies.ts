import type { ShapeIcon, Op } from '../../shapes'

function npc(id: string, ops: Op[]): ShapeIcon {
  return { id, size: [24, 24], ops, shadow: true }
}

/** 锈门层敌卡。下层先定外形。 */
export const ENEMY_ICONS: Record<string, ShapeIcon> = {
  ec01: npc('npc.ec01', [
    { c: 'ell', x: 11, y: 15, rx: 8, ry: 7, f: 'ene' },
    { c: 'disc', x: 11, y: 7, r: 5, f: 'ene' },
    { c: 'rect', x: 17, y: 6, w: 4, h: 12, f: 'stone' },
    { c: 'rect', x: 16, y: 5, w: 6, h: 4, f: 'copperD' },
    { c: 'px', pts: [[9, 6], [13, 6]], f: 'redD' },
    { c: 'hl', x: 8, y: 4, w: 2 },
  ]),
  ec02: npc('npc.ec02', [
    { c: 'ell', x: 12, y: 13, rx: 7, ry: 6, f: 'ink' },
    { c: 'disc', x: 12, y: 9, r: 4, f: 'purpleD' },
    { c: 'line', x1: 4, y1: 8, x2: 8, y2: 12, f: 'ink', w: 2 },
    { c: 'line', x1: 20, y1: 8, x2: 16, y2: 12, f: 'ink', w: 2 },
    { c: 'line', x1: 3, y1: 16, x2: 8, y2: 16, f: 'ink', w: 2 },
    { c: 'line', x1: 21, y1: 16, x2: 16, y2: 16, f: 'ink', w: 2 },
    { c: 'px', pts: [[12, 18], [10, 20], [14, 20]], f: 'cream' },
  ]),
  ec03: npc('npc.ec03', [
    { c: 'ell', x: 12, y: 13, rx: 7, ry: 8, f: 'cream' },
    { c: 'ell', x: 12, y: 13, rx: 5, ry: 6, f: 'paperD' },
    { c: 'px', pts: [[12, 8], [10, 14], [14, 16]], f: 'leaf' },
    { c: 'hl', x: 9, y: 9, w: 2 },
  ]),
  ec04: npc('npc.ec04', [
    { c: 'disc', x: 12, y: 12, r: 7, f: 'purpleD' },
    { c: 'disc', x: 12, y: 12, r: 4, f: 'redD' },
    { c: 'disc', x: 12, y: 12, r: 2, f: 'ink' },
    { c: 'hl', x: 9, y: 9, w: 2 },
  ]),
  ec05: npc('npc.ec05', [
    { c: 'rect', x: 8, y: 3, w: 8, h: 18, f: 'stone' },
    { c: 'rect', x: 7, y: 3, w: 10, h: 3, f: 'stoneL' },
    { c: 'rect', x: 7, y: 18, w: 10, h: 3, f: 'gray1' },
    { c: 'hl', x: 9, y: 6, w: 2 },
  ]),
  ec06: npc('npc.ec06', [
    { c: 'rect', x: 10, y: 3, w: 4, h: 18, f: 'teal' },
    { c: 'rect', x: 11, y: 5, w: 2, h: 14, f: 'sprout' },
    { c: 'px', pts: [[12, 4], [9, 10], [15, 14]], f: 'leaf' },
  ]),
  ec07: npc('npc.ec07', [
    { c: 'rect', x: 9, y: 10, w: 7, h: 8, f: 'copperD' },
    { c: 'disc', x: 12, y: 7, r: 4, f: 'cream' },
    { c: 'rect', x: 16, y: 4, w: 2, h: 14, f: 'gray1' },
    { c: 'px', pts: [[10, 6], [14, 6]], f: 'lamp3' },
    { c: 'hl', x: 10, y: 5, w: 2 },
  ]),
  ec08: npc('npc.ec08', [
    { c: 'poly', pts: [[4, 12], [10, 8], [10, 14]], f: 'ink2' },
    { c: 'poly', pts: [[20, 12], [14, 8], [14, 14]], f: 'ink2' },
    { c: 'ell', x: 12, y: 12, rx: 5, ry: 4, f: 'pack' },
    { c: 'disc', x: 12, y: 12, r: 2, f: 'lamp2' },
    { c: 'hl', x: 10, y: 10, w: 2 },
  ]),
  ec09: npc('npc.ec09', [
    { c: 'poly', pts: [[8, 5], [16, 6], [18, 18], [6, 19], [5, 10]], f: 'fog' },
    { c: 'poly', pts: [[10, 8], [15, 9], [14, 16], [9, 15]], f: 'gray3' },
    { c: 'px', pts: [[11, 11], [13, 12]], f: 'dai' },
    { c: 'hl', x: 9, y: 8, w: 2 },
  ]),
  ec10: npc('npc.ec10', [
    { c: 'disc', x: 12, y: 14, r: 7, f: 'leaf' },
    { c: 'disc', x: 12, y: 13, r: 5, f: 'redD' },
    { c: 'px', pts: [[8, 10], [16, 11], [12, 8]], f: 'sprout' },
  ]),
  ec11: npc('npc.ec11', [
    { c: 'ell', x: 12, y: 14, rx: 7, ry: 4, f: 'gray1' },
    { c: 'disc', x: 7, y: 12, r: 3, f: 'gray1' },
    { c: 'rect', x: 14, y: 10, w: 6, h: 4, f: 'leaf' },
    { c: 'px', pts: [[5, 11], [18, 16]], f: 'cream' },
  ]),
  ec12: npc('npc.ec12', [
    { c: 'ell', x: 12, y: 16, rx: 8, ry: 6, f: 'fruR' },
    { c: 'disc', x: 12, y: 9, r: 5, f: 'redD' },
    { c: 'px', pts: [[10, 8], [14, 8]], f: 'ink' },
    { c: 'rect', x: 6, y: 14, w: 4, h: 5, f: 'fruR' },
    { c: 'rect', x: 14, y: 14, w: 4, h: 5, f: 'fruR' },
    { c: 'hl', x: 9, y: 7, w: 2 },
  ]),
  ec13: npc('npc.ec13', [
    { c: 'ell', x: 12, y: 13, rx: 7, ry: 8, f: 'ink2' },
    { c: 'line', x1: 8, y1: 8, x2: 16, y2: 18, f: 'leaf', w: 1 },
    { c: 'line', x1: 16, y1: 7, x2: 8, y2: 17, f: 'cream', w: 1 },
    { c: 'hl', x: 9, y: 9, w: 2 },
  ]),
  ec14: npc('npc.ec14', [
    { c: 'ell', x: 12, y: 14, rx: 8, ry: 4, f: 'cream' },
    { c: 'disc', x: 6, y: 14, r: 3, f: 'leaf' },
    { c: 'px', pts: [[5, 13], [18, 14], [12, 12]], f: 'ink' },
  ]),
  ec15: npc('npc.ec15', [
    { c: 'rect', x: 7, y: 8, w: 10, h: 12, f: 'wood1' },
    { c: 'rect', x: 7, y: 10, w: 10, h: 2, f: 'copperD' },
    { c: 'rect', x: 7, y: 16, w: 10, h: 2, f: 'copperD' },
    { c: 'line', x1: 12, y1: 4, x2: 12, y2: 8, f: 'lamp2', w: 1 },
    { c: 'px', pts: [[12, 3]], f: 'lamp1' },
  ]),
  ec16: npc('npc.ec16', [
    { c: 'ell', x: 12, y: 12, rx: 9, ry: 3, f: 'pack' },
    { c: 'disc', x: 5, y: 12, r: 2, f: 'cream' },
    { c: 'px', pts: [[8, 11], [14, 12], [18, 11]], f: 'leaf' },
  ]),
  ec17: npc('npc.ec17', [
    { c: 'rect', x: 8, y: 6, w: 8, h: 14, f: 'stone' },
    { c: 'disc', x: 12, y: 7, r: 4, f: 'stoneL' },
    { c: 'rect', x: 9, y: 10, w: 6, h: 3, f: 'gray1' },
    { c: 'hl', x: 9, y: 5, w: 2 },
  ]),
  ec18: npc('npc.ec18', [
    { c: 'ell', x: 12, y: 16, rx: 10, ry: 6, f: 'gray1' },
    { c: 'rect', x: 6, y: 8, w: 12, h: 8, f: 'ene' },
    { c: 'disc', x: 10, y: 6, r: 4, f: 'cream' },
    { c: 'px', pts: [[9, 5], [16, 14], [18, 18]], f: 'copperD' },
    { c: 'hl', x: 8, y: 4, w: 2 },
  ]),
  ec19: npc('npc.ec19', [
    { c: 'ell', x: 12, y: 15, rx: 9, ry: 6, f: 'teal' },
    { c: 'ell', x: 12, y: 14, rx: 7, ry: 4, f: 'leaf' },
    { c: 'rect', x: 10, y: 13, w: 5, h: 4, f: 'stone' },
    { c: 'hl', x: 8, y: 12, w: 3 },
  ]),
  ec20: npc('npc.ec20', [
    { c: 'poly', pts: [[12, 4], [14, 12], [20, 18], [12, 14], [4, 18], [10, 12]], f: 'cream' },
    { c: 'disc', x: 12, y: 13, r: 2, f: 'stone' },
  ]),
  ec21: npc('npc.ec21', [
    { c: 'poly', pts: [[4, 10], [10, 6], [10, 14]], f: 'purpleD' },
    { c: 'poly', pts: [[20, 10], [14, 6], [14, 14]], f: 'purpleD' },
    { c: 'ell', x: 12, y: 12, rx: 4, ry: 5, f: 'ink' },
    { c: 'px', pts: [[12, 16]], f: 'cream' },
  ]),
  ec22: npc('npc.ec22', [
    { c: 'rect', x: 11, y: 4, w: 2, h: 8, f: 'cream' },
    { c: 'rect', x: 4, y: 12, w: 7, h: 4, f: 'paper' },
    { c: 'rect', x: 13, y: 12, w: 7, h: 4, f: 'cream' },
    { c: 'line', x1: 7, y1: 12, x2: 12, y2: 8, f: 'gray1', w: 1 },
    { c: 'line', x1: 17, y1: 12, x2: 13, y2: 8, f: 'gray1', w: 1 },
  ]),
  ec23: npc('npc.ec23', [
    { c: 'rect', x: 6, y: 14, w: 12, h: 6, f: 'wood1' },
    { c: 'ell', x: 12, y: 10, rx: 8, ry: 6, f: 'redD' },
    { c: 'px', pts: [[8, 10], [10, 12], [14, 12], [16, 10]], f: 'cream' },
    { c: 'hl', x: 9, y: 7, w: 2 },
  ]),
}
