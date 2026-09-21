/**
 * dev-only 编辑页：左侧资产列表；中间画廊 / 网格画布（铅笔 / 橡皮 / 取色）；右侧色板、帧、导出 TS、校验。
 * 不写文件：导出到剪贴板，开发者粘回源文件。
 */
import { ASSETS } from '../assets'
import { bake, bakeRows, drawSprite, type SpriteDef, type Rows } from '../dsl'
import { PAL, MASTER } from '../palette'
import { lintSprite } from '../lint'
import { Scenery, SCENE_SETS, GROUND_Y } from '../scenery'
import { bakeTable } from '../terrain'
import { content } from '../../content'

content()
const list = document.getElementById('list')!
const main = document.getElementById('main')!
const side = document.getElementById('side')!

function canvasOf(img: HTMLCanvasElement, scale = 4): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.className = 'px'
  c.width = img.width * scale
  c.height = img.height * scale
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(img, 0, 0, c.width, c.height)
  return c
}
function cell(label: string, img: HTMLCanvasElement, scale = 4): HTMLElement {
  const d = document.createElement('div')
  d.className = 'cell'
  d.append(canvasOf(img, scale), document.createElement('br'), label)
  return d
}
function section(title: string): HTMLElement {
  const h = document.createElement('h3')
  h.textContent = title
  main.append(h)
  const row = document.createElement('div')
  row.className = 'row'
  main.append(row)
  return row
}

function gallery(): void {
  main.replaceChildren()
  side.replaceChildren()
  let row = section('化身（ASCII）')
  for (const id of ['char.pca00', 'char.pcb00', 'char.pcc00']) {
    const b = ASSETS.sprite(id)
    if (!b) continue
    for (const anim of Object.keys(b.def.animations ?? { idle: {} })) {
      const c = document.createElement('canvas')
      c.className = 'px'
      c.width = b.w * 4
      c.height = b.h * 4
      const g = c.getContext('2d')!
      g.imageSmoothingEnabled = false
      g.scale(4, 4)
      drawSprite(g, b, b.anchor[0], b.anchor[1], { anim, t: 0.2 })
      const d = document.createElement('div')
      d.className = 'cell'
      d.append(c, document.createElement('br'), `${id} ${anim}`)
      row.append(d)
    }
  }
  row = section('敌方')
  for (const [k, s] of Object.entries(ASSETS.all.shapes)) {
    if (k.startsWith('npc.')) row.append(cell(k, ASSETS.icon(s.id), 3))
  }
  row = section('卡面')
  for (const c of Object.values(content().cards)) {
    row.append(cell(`${c.id}`, ASSETS.card(c.id), 3))
  }
  row = section('图标 / 特效 / 道具 / UI')
  for (const [k, s] of Object.entries(ASSETS.all.shapes)) {
    if (/^(icon|fx|prop|ui)\./.test(k)) row.append(cell(k, ASSETS.icon(s.id), k.startsWith('prop.') ? 2 : 4))
  }
  row = section('地砖')
  for (const k of ['corridor', 'foyer', 'nest', 'boss'] as const) row.append(cell(k, bakeTable(k), 0.5))
  row = section('锈门层房间')
  for (const key of ['gate', 'corridor', 'boss', 'shop'] as const) {
    const sc = new Scenery(key)
    const c = document.createElement('canvas')
    c.className = 'px'
    c.width = 640
    c.height = 360
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    sc.drawBack(g, 200, 1.2)
    const ranger = ASSETS.sprite('char.pca00')
    if (ranger) drawSprite(g, ranger, 220, GROUND_Y, { anim: 'idle', t: 0.2, shadow: true })
    sc.drawFront(g, 200, 1.2)
    const d = document.createElement('div')
    d.className = 'cell'
    d.append(c, document.createElement('br'), key)
    row.append(d)
  }
  const lintOut = document.createElement('pre')
  lintOut.className = 'lint'
  const errs: string[] = []
  for (const d of Object.values(ASSETS.all.ascii)) errs.push(...lintSprite(d).map((e) => `${d.id}: ${e}`))
  lintOut.textContent = errs.length ? errs.join('\n') : 'sprites lint: 全部通过'
  side.append(lintOut)
}

interface EditState { def: SpriteDef; part: string; frame: string | number; color: string; tool: 'pen' | 'eraser' | 'pick' }
let ed: EditState | null = null

function rowsOf(def: SpriteDef, part: string, frame: string | number): Rows {
  const p = def.parts[part]
  if (Array.isArray(p)) return p
  const f = Array.isArray(p.frames) ? p.frames[frame as number] : p.frames[frame as string]
  if (Array.isArray(f)) return f
  const base = Array.isArray(p.frames) ? (p.frames[0] as Rows) : (Object.values(p.frames).find((x) => Array.isArray(x)) as Rows)
  return base.map((r, y) => {
    const o = f.delta[y] ?? ''
    let s = ''
    for (let x = 0; x < r.length; x++) {
      const ch = o[x] ?? ' '
      s += ch === ' ' ? r[x] : ch === '~' ? '.' : ch
    }
    return s
  })
}
function setRows(def: SpriteDef, part: string, frame: string | number, rows: Rows): void {
  const p = def.parts[part]
  if (Array.isArray(p)) { def.parts[part] = rows; return }
  if (Array.isArray(p.frames)) p.frames[frame as number] = rows
  else p.frames[frame as string] = rows
}

function editor(def: SpriteDef): void {
  const parts = Object.keys(def.parts)
  const p0 = def.parts[parts[0]]
  const frame0 = Array.isArray(p0) ? 0 : Array.isArray(p0.frames) ? 0 : Object.keys(p0.frames)[0]
  ed = { def: structuredClone(def), part: parts[0], frame: frame0, color: Object.keys(def.palette)[0], tool: 'pen' }
  renderEditor()
}

function renderEditor(): void {
  if (!ed) return
  const { def } = ed
  main.replaceChildren()
  side.replaceChildren()
  const rows = rowsOf(def, ed.part, ed.frame)
  const p = def.parts[ed.part]
  const off: [number, number] = Array.isArray(p) ? [0, 0] : p.offset
  const S = 14
  const c = document.createElement('canvas'); c.className = 'px'; c.width = def.size[0] * S; c.height = def.size[1] * S
  const g = c.getContext('2d')!
  const paint = () => {
    g.clearRect(0, 0, c.width, c.height)
    g.globalAlpha = 0.35
    const baked = bake({ ...def, id: def.id + ':edit:' + Math.random() })
    g.imageSmoothingEnabled = false
    g.drawImage(baked.still, 0, 0, c.width, c.height)
    g.globalAlpha = 1
    const img = bakeRows(rows, def.palette)
    g.drawImage(img, off[0] * S, off[1] * S, img.width * S, img.height * S)
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    for (let x = 0; x <= def.size[0]; x++) { g.beginPath(); g.moveTo(x * S, 0); g.lineTo(x * S, c.height); g.stroke() }
    for (let y = 0; y <= def.size[1]; y++) { g.beginPath(); g.moveTo(0, y * S); g.lineTo(c.width, y * S); g.stroke() }
  }
  paint()
  let drawing = false
  const apply = (e: MouseEvent) => {
    const r = c.getBoundingClientRect()
    const x = Math.floor((e.clientX - r.left) / S) - off[0], y = Math.floor((e.clientY - r.top) / S) - off[1]
    if (y < 0 || y >= rows.length) return
    const row = rows[y].padEnd(def.size[0] - off[0], '.')
    if (x < 0 || x >= row.length) return
    if (ed!.tool === 'pick') { const ch = row[x]; if (ch !== '.') ed!.color = ch; renderSide(); return }
    const ch = ed!.tool === 'eraser' ? '.' : ed!.color
    rows[y] = row.slice(0, x) + ch + row.slice(x + 1)
    setRows(def, ed!.part, ed!.frame, rows)
    paint()
  }
  c.addEventListener('mousedown', (e) => { drawing = true; apply(e) })
  c.addEventListener('mousemove', (e) => { if (drawing) apply(e) })
  window.addEventListener('mouseup', () => { drawing = false })
  const title = document.createElement('h3'); title.textContent = `${def.id} · ${ed.part} · 帧 ${ed.frame}`
  main.append(title, c)
  renderSide()

  function renderSide(): void {
    side.replaceChildren()
    const tools = document.createElement('div'); tools.className = 'tools'
    for (const t of ['pen', 'eraser', 'pick'] as const) {
      const b = document.createElement('button'); b.textContent = t === 'pen' ? '铅笔' : t === 'eraser' ? '橡皮' : '取色'; b.className = ed!.tool === t ? 'on' : ''
      b.onclick = () => { ed!.tool = t; renderSide() }
      tools.append(b)
    }
    const back = document.createElement('button'); back.textContent = '← 画廊'; back.onclick = () => { ed = null; gallery() }
    tools.append(back)
    side.append(tools)
    const pf = document.createElement('div'); pf.className = 'tools'
    for (const part of Object.keys(def.parts)) {
      const pp = def.parts[part]
      const frames: (string | number)[] = Array.isArray(pp) ? [0] : Array.isArray(pp.frames) ? pp.frames.map((_, i) => i) : Object.keys(pp.frames)
      for (const f of frames) {
        const b = document.createElement('button'); b.textContent = `${part}[${f}]`; b.className = ed!.part === part && ed!.frame === f ? 'on' : ''
        b.onclick = () => { ed!.part = part; ed!.frame = f; renderEditor() }
        pf.append(b)
      }
    }
    side.append(pf)
    const pal = document.createElement('div'); pal.className = 'pal'
    for (const [k, hex] of Object.entries(def.palette)) {
      const s = document.createElement('span'); s.style.background = hex; s.title = `${k} ${hex}`; s.className = ed!.color === k ? 'on' : ''
      s.onclick = () => { ed!.color = k; ed!.tool = 'pen'; renderSide() }
      pal.append(s)
    }
    side.append(pal)
    const ex = document.createElement('button'); ex.textContent = '导出 TS（复制到剪贴板）'
    ex.onclick = () => { const ts = exportTs(def); void navigator.clipboard.writeText(ts); ta.value = ts }
    const lt = document.createElement('button'); lt.textContent = '校验'
    const lintOut = document.createElement('pre'); lintOut.className = 'lint'
    lt.onclick = () => { const errs = lintSprite(def); lintOut.textContent = errs.length ? errs.join('\n') : '通过' }
    const ta = document.createElement('textarea')
    side.append(ex, lt, lintOut, ta)
    const baked = bake({ ...def, id: def.id + ':prev:' + Math.random() })
    const pv = document.createElement('canvas'); pv.className = 'px'; pv.width = baked.w * 4; pv.height = baked.h * 4
    const pg = pv.getContext('2d')!; pg.imageSmoothingEnabled = false; pg.scale(4, 4)
    drawSprite(pg, baked, baked.anchor[0], baked.anchor[1], { anim: 'idle' })
    side.append(pv)
  }
}

function exportTs(def: SpriteDef): string {
  const rows = (r: Rows, ind: string) => r.map((s) => `${ind}'${s}',`).join('\n')
  const parts = Object.entries(def.parts).map(([k, p]) => {
    if (Array.isArray(p)) return `    ${k}: [\n${rows(p, '      ')}\n    ],`
    const frames = Array.isArray(p.frames)
      ? `[\n${p.frames.map((f) => Array.isArray(f) ? `        [\n${rows(f, '          ')}\n        ],` : `        { delta: [\n${rows(f.delta, '          ')}\n        ] },`).join('\n')}\n      ]`
      : `{\n${Object.entries(p.frames).map(([n, f]) => Array.isArray(f) ? `        ${n}: [\n${rows(f, '          ')}\n        ],` : `        ${n}: { delta: [\n${rows(f.delta, '          ')}\n        ] },`).join('\n')}\n      }`
    return `    ${k}: {\n      offset: [${p.offset[0]}, ${p.offset[1]}],\n      frames: ${frames},\n    },`
  }).join('\n')
  return `export const SPRITE: SpriteDef = {\n  id: '${def.id}',\n  size: [${def.size[0]}, ${def.size[1]}],\n  anchor: [${(def.anchor ?? [0, 0]).join(', ')}],\n  palette: ${JSON.stringify(def.palette)},\n  parts: {\n${parts}\n  },\n  compose: ${JSON.stringify(def.compose ?? Object.keys(def.parts))},\n  animations: ${JSON.stringify(def.animations ?? {})},\n}\n`
}

function buildList(): void {
  const h = document.createElement('h4'); h.textContent = '画廊'
  const all = document.createElement('button'); all.textContent = '全部资产一览'; all.onclick = () => { ed = null; gallery() }
  list.append(h, all)
  const h2 = document.createElement('h4'); h2.textContent = 'ASCII 精灵（可编辑）'
  list.append(h2)
  for (const [id, def] of Object.entries(ASSETS.all.ascii)) {
    const b = document.createElement('button'); b.textContent = id; b.onclick = () => editor(def)
    list.append(b)
  }
  const h3 = document.createElement('h4'); h3.textContent = `主色板 ${MASTER.size} 色`
  list.append(h3)
  const pal = document.createElement('div'); pal.className = 'pal'
  for (const [k, hex] of Object.entries(PAL)) { const s = document.createElement('span'); s.style.background = hex; s.title = `${k} ${hex}`; pal.append(s) }
  list.append(pal)
}

buildList()
gallery()
