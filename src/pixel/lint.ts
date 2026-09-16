/**
 * 精灵硬规则校验（《像素资产DSL规范》第二节）。纯数据，不依赖 DOM，供 scripts/sprites-lint.ts 与编辑页共用。
 */
import type { SpriteDef, Rows, Frame } from './dsl'
import { MASTER } from './palette'

const PREFIXES = ['char.', 'npc.', 'card.', 'icon.', 'ui.', 'fx.', 'bg.', 'prop.']

function framesOf(p: SpriteDef['parts'][string]): { frames: Frame[]; offset: [number, number]; names: string[] } {
  if (Array.isArray(p)) return { frames: [p], offset: [0, 0], names: ['0'] }
  if (Array.isArray(p.frames)) return { frames: p.frames, offset: p.offset, names: p.frames.map((_, i) => String(i)) }
  return { frames: Object.values(p.frames), offset: p.offset, names: Object.keys(p.frames) }
}

export function lintSprite(def: SpriteDef): string[] {
  const errs: string[] = []
  const [W, H] = def.size
  if (!PREFIXES.some((p) => def.id.startsWith(p))) errs.push(`id 前缀不合法：${def.id}`)
  const used = new Set<string>()
  const colors = new Set<string>()
  for (const [k, hex] of Object.entries(def.palette)) {
    const h = hex.toLowerCase()
    if (h === '#000000' || h === '#ffffff') errs.push(`palette.${k} 使用纯黑/纯白`)
    if (!MASTER.has(h)) errs.push(`palette.${k}=${hex} 不在主色板`)
    colors.add(h)
  }
  if (!('o' in def.palette)) errs.push('缺少轮廓键 o')
  for (const [name, p] of Object.entries(def.parts)) {
    const { frames, offset, names } = framesOf(p)
    let base: Rows | null = null
    frames.forEach((f, i) => {
      const rows = Array.isArray(f) ? f : null
      if (rows) { if (!base) base = rows } else if (!base) errs.push(`${name}[${names[i]}] delta 帧前没有基帧`)
      const r = rows ?? (f as { delta: Rows }).delta
      if (r.length + offset[1] > H) errs.push(`${name}[${names[i]}] 行数 ${r.length}+${offset[1]} 超出高度 ${H}`)
      r.forEach((row, y) => {
        if (row.length + offset[0] > W) errs.push(`${name}[${names[i]}] 第 ${y} 行长 ${row.length}+${offset[0]} 超出宽度 ${W}`)
        for (const ch of row) {
          if (ch === '.' || ch === ' ') continue
          if (!rows && ch === '~') continue
          if (!(ch in def.palette)) errs.push(`${name}[${names[i]}] 第 ${y} 行未知字符 '${ch}'`)
          used.add(ch)
        }
      })
      if (!rows && base) {
        const b = base as Rows
        if (r.length > b.length) errs.push(`${name}[${names[i]}] delta 行数超过基帧`)
        r.forEach((row, y) => { if (b[y] !== undefined && row.length > b[y].length) errs.push(`${name}[${names[i]}] delta 第 ${y} 行长超过基帧`) })
      }
    })
  }
  if (!used.has('o')) errs.push('轮廓键 o 从未使用')
  const limit = def.id.startsWith('card.') ? 8 : def.id.startsWith('ui.symbol') || def.id.startsWith('ui.status') ? 5 : 16
  if (colors.size > limit) errs.push(`颜色数 ${colors.size} 超过上限 ${limit}`)
  if (def.animations) {
    for (const [an, a] of Object.entries(def.animations)) {
      for (const [part, v] of Object.entries(a)) {
        if (part === 'fps' || v === undefined) continue
        const p = def.parts[part]
        if (!p) { errs.push(`animations.${an} 引用不存在的部件 ${part}`); continue }
        const { frames, names } = framesOf(p)
        const keys = Array.isArray(v) ? v : [v]
        for (const k of keys) {
          const ok = typeof k === 'number' ? k < frames.length : names.includes(k)
          if (!ok) errs.push(`animations.${an}.${part} 引用不存在的帧 ${String(k)}`)
        }
      }
    }
  }
  return errs
}
