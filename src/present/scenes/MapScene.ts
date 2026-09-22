import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL, rgba } from '../../pixel/palette'
import { vignette, glow } from '../../pixel/light'
import { ASSETS } from '../../pixel/assets'
import { blit, drawSprite } from '../../pixel/dsl'
import { panel } from '../../pixel/ui'
import { audio } from '../../audio/audio'
import { drawHpBar, drawHint } from '../widgets'
import { DeckEditor } from '../overlays/DeckEditor'
import { fictionName, avatarHeadId, NODE_HINT } from '../fiction'
import type { DomainEvent } from '../../core/messages'
import type { MapNodeView, RunView } from '../../application/readmodels/RunView'
import { edgeBow, layoutMesh, type Mesh, type MeshPoint } from '../../pixel/mapMesh'
import { drawLink, drawVein, drawVeil, mapFloor, type LightHole } from '../../pixel/mapGround'
import { ease, tw } from '../../pixel/tween'

const NODE_ICON: Record<string, string> = {
  normal: 'icon.normal',
  elite: 'icon.elite',
  boss: 'icon.boss',
  event: 'icon.event',
  shop: 'icon.shop',
  chest: 'icon.chest',
  rest: 'icon.rest',
  forge: 'icon.forge',
  nextFloor: 'icon.next',
  unknown: 'icon.unknown',
}

type Rank = 'hidden' | 'revealed' | 'visited'

interface Walk {
  from: MeshPoint
  to: MeshPoint
  t: number
  dur: number
  nodeId: string
  flip: boolean
}

function rankOf(n: MapNodeView): Rank {
  if (n.visited) return 'visited'
  if (n.type !== 'unknown') return 'revealed'
  return 'hidden'
}

function linkKind(a: Rank, b: Rank): 'dim' | 'seen' | 'walked' {
  if (a === 'visited' && b === 'visited') return 'walked'
  if (a !== 'hidden' || b !== 'hidden') return 'seen'
  return 'dim'
}

function fit(cam: number, min: number, max: number, view: number, padStart: number, padEnd: number): number {
  const lo = max - (view - padEnd)
  const hi = min - padStart
  if (lo > hi) return (min + max) / 2 - (padStart + view - padEnd) / 2
  return Math.min(hi, Math.max(lo, cam))
}

export class MapScene extends Scene {
  readonly name = 'map' as const
  private t = 0
  private deck = new DeckEditor(this.app)
  private openDeck = false
  private camX = 0
  private camY = 0
  private camReady = false
  private velX = 0
  private velY = 0
  private grab: { x: number; y: number; camX: number; camY: number } | null = null
  private walk: Walk | null = null
  private faceLeft = false

  enter(): void {
    audio.atmosphere(null)
  }

  blocksInput(): boolean {
    return this.walk !== null
  }

  update(dt: number): void {
    this.t += dt
    const run = this.app.view()
    if (!run || run.screen !== 'map') return
    const mesh = layoutMesh(run.nodes, run.seed)
    if (!this.camReady) {
      const p = this.anchorOf(run, mesh)
      this.camX = p.x - 320
      this.camY = p.y - 168
      this.camReady = true
    }
    if (this.walk) {
      this.grab = null
      this.velX = 0
      this.velY = 0
      this.walk.t += dt * tw.speed
      const k = Math.min(1, this.walk.t / this.walk.dur)
      const e = ease.inOutSine(k)
      const x = this.walk.from.x + (this.walk.to.x - this.walk.from.x) * e
      const y = this.walk.from.y + (this.walk.to.y - this.walk.from.y) * e
      this.glide(x, y, dt, 5)
      this.clamp(mesh)
      if (k >= 1) {
        const id = this.walk.nodeId
        this.walk = null
        this.app.send({ type: 'run.enterNode', node: id })
      }
      return
    }
    if (this.openDeck || this.app.input.locked) {
      this.grab = null
      this.clamp(mesh)
      return
    }
    this.pan(dt)
    this.clamp(mesh)
  }

  async handle(e: DomainEvent): Promise<void> {
    if (e.type === 'run.deckChanged') this.app.toast('牌组已改', 52)
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    world.fillStyle = PAL.shadow
    world.fillRect(0, 0, 640, 360)

    const run = this.app.view()
    if (!run) return
    const mesh = layoutMesh(run.nodes, run.seed)
    const spots = this.spots(run, mesh)
    const edges = this.edges(spots, run.seed)

    const floor = mapFloor(run.seed, spots.map((s) => ({ id: s.id, x: s.wx, y: s.wy })), edges.map((e) => ({
      a: e.a.id, b: e.b.id, bow: e.bow,
    })))
    world.drawImage(floor.canvas, Math.round(floor.ox - this.camX), Math.round(floor.oy - this.camY))

    for (const e of edges) {
      drawLink(world, e.ax, e.ay, e.bx, e.by, e.bow, linkKind(e.a.rank, e.b.rank))
    }

    const holes: LightHole[] = []
    let hover: { n: MapNodeView; x: number; y: number } | null = null

    const hub = spots[0]
    this.drawMarker(world, 'icon.hub', hub.sx, hub.sy, 'visited')
    holes.push({ x: hub.sx, y: hub.sy, r: 54, k: 1 })
    if (hub.sy > 48 && hub.sy < 292) {
      text.draw('内厅', hub.sx, hub.sy + 16, { size: 8, align: 'center', color: PAL.cream, bold: true })
    }

    for (const s of spots) {
      if (s.id === 'hub' || !s.node) continue
      const n = s.node
      this.drawMarker(world, NODE_ICON[n.type] ?? 'icon.unknown', s.sx, s.sy, s.rank)
      if (n.lost && s.rank === 'visited') {
        world.fillStyle = PAL.redD
        world.fillRect(s.sx - 7, s.sy + 8, 14, 2)
      }
      if (n.adjacent && !n.current) this.torch(world, s.sx, s.sy)
      if (s.rank === 'visited') holes.push({ x: s.sx, y: s.sy, r: 50, k: 1 })
      else if (s.rank === 'revealed') holes.push({ x: s.sx, y: s.sy, r: 26, k: 0.95 })
      if (s.rank !== 'hidden' && s.sy > 48 && s.sy < 292 && s.sx > 4 && s.sx < 636) {
        text.draw(n.label, s.sx, s.sy + 16, {
          size: 8,
          align: 'center',
          color: s.rank === 'visited' ? PAL.cream : PAL.gray2,
          bold: s.rank === 'visited',
        })
      }
      const hit = { x: s.sx - 16, y: s.sy - 16, w: 32, h: 32 }
      const can = n.adjacent && !this.openDeck && !this.walk
      this.app.ui.hit(`node-${n.id}`, hit, () => this.go(run, mesh, n), can ? 4 : 2, can ? 'pointer' : 'grab')
      if (this.app.input.isHover(`node-${n.id}`)) hover = { n, x: s.sx, y: s.sy }
    }

    const tok = this.token(run, mesh)
    const tsx = Math.round(tok.x - this.camX + tok.sway)
    const tsy = Math.round(tok.y - this.camY - tok.bob)
    holes.push({ x: tsx, y: tsy, r: 36, k: 1 })

    drawVeil(world, holes)
    world.save()
    world.globalAlpha = 0.45
    for (const e of edges) drawVein(world, e.ax, e.ay, e.bx, e.by, e.bow)
    world.restore()

    for (const s of spots) {
      if (s.rank !== 'visited') continue
      glow(world, s.sx, s.sy, 20, PAL.lamp2, 0.22 + 0.06 * Math.sin(this.t * 2 + s.sx * 0.05), false)
    }
    glow(world, tsx, tsy, 14, PAL.lamp1, 0.4, false)

    const head = ASSETS.sprite(avatarHeadId(run.avatarDefId))
    if (head) {
      drawSprite(world, head, tsx, tsy - 28, {
        anim: this.walk ? 'walk' : 'idle',
        t: this.t,
        shadow: true,
        scale: 2,
        flip: tok.flip,
      })
    }
    if (this.walk) {
      world.fillStyle = PAL.stoneL
      world.fillRect(tsx - 6, tsy + 2, 2, 1)
      world.fillRect(tsx + 4, tsy + 3, 2, 1)
    }

    vignette(world, 0.42)

    if (!this.openDeck) {
      this.app.ui.hit('map-drag', { x: 0, y: 0, w: 640, h: 360 }, () => {}, 0, 'grab')
    }

    panel(ui, 8, 6, 420, 36, 'stone')
    text.occlude(8, 6, 420, 36)
    drawHpBar(ui, text, 16, 18, 90, run.hp, run.hpMax)
    text.draw(`${run.gold}金`, 170, 16, { size: 11, color: PAL.gold, bold: true })
    const me = ASSETS.icon(`icon.${run.floorEffect.toLowerCase().replace('.', '')}`, 16, 16)
    blit(ui, me, 220, 14)
    text.draw(fictionName(run.floorEffect), 240, 16, { size: 10, color: PAL.gray3 })
    if (run.relics.length) text.draw(run.relics.map(fictionName).join('、'), 320, 16, { size: 10, color: PAL.copperL, maxWidth: 100 })

    text.occlude(200, 296, 240, 16)
    text.draw('拖动查看走廊', 320, 300, { size: 9, align: 'center', color: PAL.gray2 })

    this.app.ui.button('open-deck', { x: 520, y: 318, w: 104, h: 26 }, '打开卡盒', () => {
      audio.sfx('click')
      this.openDeck = true
    }, { primary: true, small: true })
    this.app.ui.button('abandon', { x: 16, y: 318, w: 72, h: 26 }, '放弃', () => {
      audio.sfx('click')
      this.app.shell.kind = 'quit'
    }, { danger: true, small: true })

    if (this.openDeck) this.deck.render(ui, text, run, () => { this.openDeck = false })
    else if (hover && !this.walk) {
      const title = hover.n.type === 'unknown' ? '？' : hover.n.label
      drawHint(ui, text, title, NODE_HINT[hover.n.type] ?? '', hover.x + 18, hover.y - 36)
    }
  }

  onCancel(): boolean {
    if (this.openDeck) {
      this.openDeck = false
      return true
    }
    return false
  }

  private go(run: RunView, mesh: Mesh, n: MapNodeView): void {
    if (!n.adjacent || this.openDeck || this.walk) return
    const from = this.anchorOf(run, mesh)
    const to = mesh.at(n.id)
    audio.sfx('click')
    if (Math.hypot(to.x - from.x, to.y - from.y) < 2) {
      this.app.send({ type: 'run.enterNode', node: n.id })
      return
    }
    this.faceLeft = to.x < from.x
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    this.walk = {
      from, to, t: 0,
      dur: Math.min(0.9, 0.4 + dist / 240),
      nodeId: n.id,
      flip: to.x < from.x,
    }
  }

  private spots(run: RunView, mesh: Mesh): Spot[] {
    const hubP = mesh.at('hub')
    const out: Spot[] = [{
      id: 'hub', x: 0, y: 0, rank: 'visited', node: null,
      wx: hubP.x, wy: hubP.y,
      sx: Math.round(hubP.x - this.camX), sy: Math.round(hubP.y - this.camY),
    }]
    for (const n of run.nodes) {
      const p = mesh.at(n.id)
      out.push({
        id: n.id, x: n.x, y: n.y, rank: rankOf(n), node: n,
        wx: p.x, wy: p.y,
        sx: Math.round(p.x - this.camX), sy: Math.round(p.y - this.camY),
      })
    }
    return out
  }

  private edges(spots: Spot[], seed: number): Edge[] {
    const out: Edge[] = []
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i], b = spots[j]
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) continue
        const bow = edgeBow(seed, a.id, b.id)
        out.push({
          a, b, bow,
          ax: a.sx, ay: a.sy, bx: b.sx, by: b.sy,
        })
      }
    }
    return out
  }

  private anchorOf(run: RunView, mesh: Mesh): MeshPoint {
    const n = run.nodes.find((node) => node.x === run.player.x && node.y === run.player.y)
    return n ? mesh.at(n.id) : mesh.at('hub')
  }

  private token(run: RunView, mesh: Mesh): { x: number; y: number; sway: number; bob: number; flip: boolean } {
    if (!this.walk) return { ...this.anchorOf(run, mesh), sway: 0, bob: 0, flip: this.faceLeft }
    const k = Math.min(1, this.walk.t / this.walk.dur)
    const e = ease.inOutSine(k)
    const env = Math.sin(k * Math.PI)
    return {
      x: this.walk.from.x + (this.walk.to.x - this.walk.from.x) * e,
      y: this.walk.from.y + (this.walk.to.y - this.walk.from.y) * e,
      sway: Math.round(Math.sin(this.t * 13) * 3 * env),
      bob: Math.round(Math.abs(Math.sin(this.t * 13)) * 2 * env),
      flip: this.walk.flip,
    }
  }

  private drawMarker(world: CanvasRenderingContext2D, id: string, sx: number, sy: number, rank: Rank): void {
    world.fillStyle = rgba(PAL.ink, rank === 'visited' ? 0.35 : 0.6)
    world.fillRect(sx - 8, sy + 7, 16, 3)
    const icon = ASSETS.icon(id)
    const ix = sx - (icon.width >> 1)
    const iy = sy - (icon.height >> 1)
    const alpha = rank === 'visited' ? 1 : rank === 'revealed' ? 0.88 : 0.62
    blit(world, icon, ix, iy, 1, alpha)
  }

  private torch(world: CanvasRenderingContext2D, sx: number, sy: number): void {
    const flicker = Math.sin(this.t * 9 + sx) > 0 ? 0 : 1
    world.fillStyle = PAL.copperD
    world.fillRect(sx - 1, sy - 16, 2, 4)
    world.fillStyle = PAL.lamp2
    world.fillRect(sx - 2, sy - 19 + flicker, 4, 3)
    world.fillStyle = PAL.lamp1
    world.fillRect(sx - 1, sy - 18 + flicker, 2, 1)
  }

  private glide(x: number, y: number, dt: number, rate: number): void {
    const k = 1 - Math.exp(-dt * rate)
    this.camX += (x - 320 - this.camX) * k
    this.camY += (y - 168 - this.camY) * k
  }

  private pan(dt: number): void {
    const inp = this.app.input
    const step = Math.min(2, dt * 60)
    if (inp.down) {
      const h = inp.hover
      const onMap = h === 'map-drag' || !!h?.startsWith('node-')
      if (!this.grab && onMap) {
        this.grab = { x: inp.x, y: inp.y, camX: this.camX, camY: this.camY }
        this.velX = 0
        this.velY = 0
      }
      if (this.grab) {
        const dx = inp.x - this.grab.x
        const dy = inp.y - this.grab.y
        if (dx * dx + dy * dy > 36) {
          const nx = this.grab.camX - dx
          const ny = this.grab.camY - dy
          this.velX = (nx - this.camX) / Math.max(0.35, step)
          this.velY = (ny - this.camY) / Math.max(0.35, step)
          this.camX = nx
          this.camY = ny
        }
      }
      return
    }
    this.grab = null
    if (Math.abs(this.velX) > 0.4 || Math.abs(this.velY) > 0.4) {
      this.camX += this.velX * step
      this.camY += this.velY * step
      const damp = Math.pow(0.84, step)
      this.velX *= damp
      this.velY *= damp
    } else {
      this.velX = 0
      this.velY = 0
    }
  }

  private clamp(mesh: Mesh): void {
    const b = mesh.bounds
    this.camX = fit(this.camX, b.minX, b.maxX, 640, 36, 36)
    this.camY = fit(this.camY, b.minY, b.maxY, 360, 84, 84)
  }
}

interface Spot {
  id: string
  x: number
  y: number
  rank: Rank
  node: MapNodeView | null
  wx: number
  wy: number
  sx: number
  sy: number
}

interface Edge {
  a: Spot
  b: Spot
  bow: number
  ax: number
  ay: number
  bx: number
  by: number
}
