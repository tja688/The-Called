/**
 * 结算插槽用的像素火花。光效可以半透明；图标走 ShapeIcon。
 */
import { ASSETS } from '../../pixel/assets'
import { glow } from '../../pixel/light'
import { PAL, rgba } from '../../pixel/palette'
import type { Sfx } from '../../audio/audio'

export type SparkKind =
  | 'paw' | 'club' | 'arrow' | 'net' | 'blade' | 'shield'
  | 'seal' | 'mark' | 'boom' | 'buff' | 'fuse' | 'whiff' | 'link'

export interface Spark {
  kind: SparkKind
  x: number
  y: number
  t: number
  life: number
}

const ICON: Partial<Record<SparkKind, string>> = {
  paw: 'fx.paw',
  club: 'fx.club',
  arrow: 'fx.arrow',
  net: 'fx.net',
  shield: 'fx.shield',
  boom: 'fx.boom',
  fuse: 'fx.fuse',
  mark: 'fx.mark',
}

export function strikeKind(defId?: string, op?: string): SparkKind {
  if (op === 'mark' || defId === 'PC.A01' || defId === 'PC.A04' || defId === 'PC.A14') return 'paw'
  if (defId === 'EC.01') return 'club'
  if (defId === 'PC.A02' || defId === 'PC.A13') return 'arrow'
  if (defId === 'PC.A03') return 'net'
  if (defId === 'EC.03' || op === 'timerBlast') return 'boom'
  if (op === 'buff') return 'buff'
  return 'blade'
}

export function sfxForKind(kind: SparkKind): Sfx {
  if (kind === 'paw' || kind === 'mark') return 'mark'
  if (kind === 'club' || kind === 'boom') return 'cover'
  if (kind === 'arrow' || kind === 'blade' || kind === 'net') return 'play'
  if (kind === 'buff') return 'buff'
  if (kind === 'shield') return 'seal'
  if (kind === 'whiff') return 'whiff'
  if (kind === 'fuse') return 'pressure'
  return 'click'
}

export function statusWord(status: string, add: boolean): string {
  const name = status === 'marked' ? '猎印'
    : status === 'vulnerable' ? '易伤'
    : status === 'sealed' ? '封印'
    : status === 'protected' ? '保护'
    : status === 'rebirth' ? '返魂'
    : status
  if (!add && status === 'marked') return '揭印'
  if (!add && status === 'sealed') return '解封'
  if (!add && status === 'rebirth') return '返魂'
  return add ? name : `-${name}`
}

type G = CanvasRenderingContext2D

export function drawSparks(g: G, sparks: Spark[]): void {
  for (const s of sparks) {
    const k = Math.max(0, 1 - s.t / s.life)
    const x = Math.round(s.x)
    const y = Math.round(s.y)
    const id = ICON[s.kind]
    if (id) {
      const icon = ASSETS.icon(id, 24, 24)
      g.save()
      g.globalAlpha *= k
      g.drawImage(icon, x - 12, y - 12)
      g.restore()
    }
    if (s.kind === 'paw' || s.kind === 'mark') glow(g, x, y, 10, PAL.gold, k * 0.7, false)
    else if (s.kind === 'boom' || s.kind === 'fuse') glow(g, x, y, 16, PAL.lamp2, k * 0.85, true)
    else if (s.kind === 'shield') glow(g, x, y, 12, PAL.dai, k * 0.6, false)
    else if (s.kind === 'buff') glow(g, x, y, 10, PAL.sta, k * 0.65, false)
    else if (s.kind === 'whiff') {
      g.fillStyle = rgba(PAL.gray3, k * 0.8)
      g.fillRect(x - 2, y - 1, 2, 1)
      g.fillRect(x + 2, y + 1, 2, 1)
      g.fillRect(x, y - 3, 1, 2)
    } else if (s.kind === 'link') {
      g.fillStyle = rgba(PAL.sig, k)
      g.fillRect(x - 6, y, 12, 1)
    } else if (s.kind === 'blade' || s.kind === 'arrow' || s.kind === 'club') {
      glow(g, x, y, 8, s.kind === 'club' ? PAL.stone : PAL.lamp3, k * 0.55, false)
    }
    if (s.kind === 'seal') {
      g.strokeStyle = rgba(PAL.gray2, k)
      g.strokeRect(x - 8, y - 8, 16, 16)
    }
  }
}
