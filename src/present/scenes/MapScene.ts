import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL, rgba } from '../../pixel/palette'
import { vignette, glow } from '../../pixel/light'
import { ASSETS } from '../../pixel/assets'
import { blit, drawSprite } from '../../pixel/dsl'
import { audio } from '../../audio/audio'
import { drawHpBar, drawHint } from '../widgets'
import { DeckEditor } from '../overlays/DeckEditor'
import { fictionName, avatarHeadId, NODE_HINT } from '../fiction'
import type { DomainEvent } from '../../core/messages'
import type { MapNodeView, RunView } from '../../application/readmodels/RunView'
import { edgeBow, layoutMesh, type Mesh, type MeshPoint } from '../../pixel/mapMesh'
import { drawIris, drawLink, drawVein, drawVeil, mapFloor, type LightHole } from '../../pixel/mapGround'
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

const VIEW_W = 640
const VIEW_H = 360
const PAD_X = 40
const PAD_TOP = 36
const PAD_BOT = 36

type Rank = 'hidden' | 'revealed' | 'visited'

interface Walk {
  from: MeshPoint
  to: MeshPoint
  t: number
  dur: number
  nodeId: string
  flip: boolean
  sent: boolean
}

interface EnterFx {
  nodeId: string
  t: number
  dur: number
  sent: boolean
}

interface Frame {
  scale: number
  x(wx: number): number
  y(wy: number): number
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

function frameOf(mesh: Mesh): Frame {
  const b = mesh.bounds
  const mw = Math.max(1, b.maxX - b.minX)
  const mh = Math.max(1, b.maxY - b.minY)
  const scale = Math.min(1, (VIEW_W - PAD_X * 2) / mw, (VIEW_H - PAD_TOP - PAD_BOT) / mh)
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const viewCx = VIEW_W / 2
  const viewCy = PAD_TOP + (VIEW_H - PAD_TOP - PAD_BOT) / 2
  return {
    scale,
    x: (wx) => (wx - cx) * scale + viewCx,
    y: (wy) => (wy - cy) * scale + viewCy,
  }
}

const READ = { stroke: PAL.ink, strokeWidth: 3 }

export class MapScene extends Scene {
  readonly name = 'map' as const
  private t = 0
  private deck = new DeckEditor(this.app)
  private openDeck = false
  private walk: Walk | null = null
  private enterFx: EnterFx | null = null
  private faceLeft = false

  enter(): void {
    audio.atmosphere(null)
  }

  blocksInput(): boolean {
    return this.walk !== null || this.enterFx !== null
  }

  coversChrome(): boolean {
    return this.enterFx !== null
  }

  update(dt: number): void {
    this.t += dt
    const run = this.app.view()
    if (!run || run.screen !== 'map') return
    if (this.enterFx) {
      if (!this.enterFx.sent) {
        this.enterFx.t += dt * tw.speed
        if (this.enterFx.t >= this.enterFx.dur) {
          this.enterFx.t = this.enterFx.dur
          this.enterFx.sent = true
          this.app.send({ type: 'run.enterNode', node: this.enterFx.nodeId })
        }
      } else {
        const landed = run.nodes.find((n) => n.id === this.enterFx!.nodeId)
        if (run.screen === 'map' && landed && !landed.interactive) {
          this.enterFx = null
          this.walk = null
        }
      }
      return
    }
    if (!this.walk) return
    this.walk.t += dt * tw.speed
    if (this.walk.t < this.walk.dur) return
    this.walk.t = this.walk.dur
    if (this.walk.nodeId === 'hub') {
      if (!this.walk.sent) {
        this.walk.sent = true
        this.app.send({ type: 'run.enterNode', node: 'hub' })
      }
      const now = this.app.view()
      if (now?.player.x === 0 && now.player.y === 0) this.walk = null
      return
    }
    const node = run.nodes.find((n) => n.id === this.walk!.nodeId)
    if (!node) {
      this.walk = null
      return
    }
    if (node.interactive) {
      this.enterFx = { nodeId: node.id, t: 0, dur: 0.78, sent: false }
      return
    }
    if (!this.walk.sent) {
      this.walk.sent = true
      this.app.send({ type: 'run.enterNode', node: node.id })
    }
    if (node.current) this.walk = null
  }

  async handle(e: DomainEvent): Promise<void> {
    if (e.type === 'run.deckChanged') this.app.toast('牌组已改', 52)
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    world.fillStyle = PAL.shadow
    world.fillRect(0, 0, VIEW_W, VIEW_H)

    const run = this.app.view()
    if (!run) return
    const mesh = layoutMesh(run.nodes, run.seed)
    const fr = frameOf(mesh)
    const spots = this.spots(run, mesh, fr)
    const edges = this.edges(spots, run.seed, fr.scale)

    const floor = mapFloor(run.seed, spots.map((s) => ({ id: s.id, x: s.sx, y: s.sy })), edges.map((e) => ({
      a: e.a.id, b: e.b.id, bow: e.bow,
    })), { cover: { x: 0, y: 0, w: VIEW_W, h: VIEW_H }, scale: fr.scale })
    world.drawImage(floor.canvas, Math.round(floor.ox), Math.round(floor.oy))

    for (const e of edges) {
      drawLink(world, e.ax, e.ay, e.bx, e.by, e.bow, linkKind(e.a.rank, e.b.rank))
    }

    const holes: LightHole[] = []
    let hover: { n: MapNodeView; x: number; y: number } | null = null
    const busy = this.openDeck || !!this.walk || !!this.enterFx

    const hub = spots[0]
    const hubOpen = run.availableNodes.includes('hub')
    this.drawMarker(world, 'icon.hub', hub.sx, hub.sy, 'visited')
    holes.push({ x: hub.sx, y: hub.sy, r: 54, k: 1 })
    if (hubOpen && !busy) this.torch(world, hub.sx, hub.sy)
    if (this.labelOk(hub.sx, hub.sy)) {
      text.draw('入口', hub.sx, hub.sy + 16, { size: 8, align: 'center', color: PAL.cream, bold: true, ...READ })
    }
    this.app.ui.hit('node-hub', { x: hub.sx - 16, y: hub.sy - 16, w: 32, h: 32 }, () => this.goHub(run, mesh), hubOpen && !busy ? 4 : 2, hubOpen && !busy ? 'pointer' : 'default')
    const hubHover = hubOpen && !busy && this.app.input.isHover('node-hub')

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
      if (s.rank !== 'hidden' && this.labelOk(s.sx, s.sy)) {
        text.draw(n.label, s.sx, s.sy + 16, {
          size: 8,
          align: 'center',
          color: s.rank === 'visited' ? PAL.cream : PAL.gray2,
          bold: s.rank === 'visited',
          ...READ,
        })
      }
      const hit = { x: s.sx - 16, y: s.sy - 16, w: 32, h: 32 }
      const can = n.adjacent && !busy
      this.app.ui.hit(`node-${n.id}`, hit, () => this.go(run, mesh, n), can ? 4 : 2, can ? 'pointer' : 'default')
      if (this.app.input.isHover(`node-${n.id}`)) hover = { n, x: s.sx, y: s.sy }
    }

    const tok = this.token(run, mesh)
    const tsx = Math.round(fr.x(tok.x) + tok.sway)
    const tsy = Math.round(fr.y(tok.y) - tok.bob)
    const bodyX = tsx
    const bodyY = tsy - 16
    holes.push({ x: bodyX, y: bodyY, r: 36, k: 1 })

    drawVeil(world, holes)
    world.save()
    world.globalAlpha = 0.45
    for (const e of edges) drawVein(world, e.ax, e.ay, e.bx, e.by, e.bow)
    world.restore()

    for (const s of spots) {
      if (s.rank !== 'visited') continue
      glow(world, s.sx, s.sy, 20, PAL.lamp2, 0.22 + 0.06 * Math.sin(this.t * 2 + s.sx * 0.05), false)
    }
    glow(world, bodyX, bodyY, this.enterFx ? 22 : 14, PAL.lamp1, this.enterFx ? 0.7 : 0.4, false)

    const stepping = !!this.walk && this.walk.t < this.walk.dur && !this.enterFx
    const head = ASSETS.sprite(avatarHeadId(run.avatarDefId))
    if (head) {
      drawSprite(world, head, tsx, tsy, {
        anim: stepping ? 'walk' : 'idle',
        t: this.t,
        shadow: true,
        scale: 2,
        flip: tok.flip,
      })
    }
    if (stepping) {
      world.fillStyle = PAL.stoneL
      world.fillRect(tsx - 6, tsy + 2, 2, 1)
      world.fillRect(tsx + 4, tsy + 3, 2, 1)
    }

    vignette(world, 0.42)

    text.occlude(6, 2, 520, 22)
    text.occlude(520, 270, 120, 90)
    this.drawHud(ui, text, run)
    if (!this.openDeck) this.drawCardBox(ui, text)

    if (this.openDeck) this.deck.render(ui, text, run, () => { this.openDeck = false })
    else if (hubHover && !busy) {
      drawHint(ui, text, '入口', '可以走回来。', hub.sx + 18, hub.sy - 36)
    } else if (hover && !busy) {
      const title = hover.n.type === 'unknown' ? '？' : hover.n.label
      drawHint(ui, text, title, NODE_HINT[hover.n.type] ?? '', hover.x + 18, hover.y - 36)
    }

    if (this.enterFx) {
      text.occlude(0, 0, VIEW_W, VIEW_H)
      const r = this.irisRadius()
      drawIris(ui, bodyX, bodyY, r)
      if (r > 6) glow(ui, bodyX, bodyY, Math.round(r), PAL.lamp1, 0.4, false)
    }
  }

  onCancel(): boolean {
    if (this.openDeck) {
      this.openDeck = false
      return true
    }
    return false
  }

  private drawHud(ui: CanvasRenderingContext2D, text: TextLayer, run: RunView): void {
    drawHpBar(ui, text, 10, 8, 78, run.hp, run.hpMax, { stroke: PAL.ink })
    text.draw(`${run.gold}金`, 168, 8, { size: 11, color: PAL.gold, bold: true, ...READ })
    const me = ASSETS.icon(`icon.${run.floorEffect.toLowerCase().replace('.', '')}`, 16, 16)
    blit(ui, me, 214, 6)
    text.draw(fictionName(run.floorEffect), 234, 8, { size: 10, color: PAL.cream, ...READ })
    if (run.relics.length) {
      text.draw(run.relics.map(fictionName).join('、'), 320, 8, { size: 10, color: PAL.copperL, maxWidth: 200, ...READ })
    }
  }

  private drawCardBox(ui: CanvasRenderingContext2D, text: TextLayer): void {
    const hover = this.app.input.isHover('open-deck')
    const x = 586
    const y = 318 + (hover ? -2 : 0)
    ui.fillStyle = rgba(PAL.ink, 0.55)
    ui.fillRect(x - 20, y + 10, 44, 5)
    ui.fillStyle = PAL.paperD
    ui.fillRect(x - 14, y - 16, 18, 8)
    ui.fillStyle = PAL.paper
    ui.fillRect(x - 10, y - 19, 18, 8)
    ui.fillStyle = PAL.cream
    ui.fillRect(x - 6, y - 22, 16, 8)
    ui.fillStyle = PAL.ink
    ui.fillRect(x - 6, y - 16, 16, 1)
    ui.fillStyle = PAL.wood1
    ui.fillRect(x - 22, y - 10, 44, 22)
    ui.fillStyle = PAL.wood3
    ui.fillRect(x - 21, y - 9, 42, 3)
    ui.fillStyle = PAL.wood2
    ui.fillRect(x - 22, y - 6, 44, 4)
    ui.fillStyle = PAL.copperD
    ui.fillRect(x - 22, y - 2, 44, 2)
    ui.fillStyle = hover ? PAL.goldL : PAL.gold
    ui.fillRect(x - 3, y, 6, 5)
    ui.fillStyle = PAL.ink
    ui.fillRect(x - 22, y - 10, 44, 1)
    ui.fillRect(x - 22, y + 11, 44, 1)
    ui.fillRect(x - 22, y - 10, 1, 22)
    ui.fillRect(x + 21, y - 10, 1, 22)
    text.draw('卡盒', x, y + 22, { size: 10, align: 'center', color: PAL.cream, bold: true, ...READ })
    this.app.ui.hit('open-deck', { x: x - 26, y: y - 26, w: 52, h: 58 }, () => {
      audio.sfx('click')
      this.openDeck = true
    }, 8, 'pointer')
  }

  private irisRadius(): number {
    if (!this.enterFx) return 0
    const t = this.enterFx.t / this.enterFx.dur
    if (t < 0.2) return 56
    if (t < 0.86) {
      const k = (t - 0.2) / 0.66
      return Math.round(56 * (1 - ease.inQuad(k)))
    }
    return 0
  }

  private labelOk(sx: number, sy: number): boolean {
    if (sy < 26 || sy > 332 || sx < 8 || sx > 632) return false
    if (sx > 540 && sy > 268) return false
    return true
  }

  private goHub(run: RunView, mesh: Mesh): void {
    if (!run.availableNodes.includes('hub') || this.openDeck || this.walk || this.enterFx) return
    const from = this.anchorOf(run, mesh)
    const to = mesh.at('hub')
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    if (dist < 2) return
    audio.sfx('click')
    this.faceLeft = to.x < from.x
    this.walk = {
      from, to, t: 0,
      dur: Math.min(0.9, 0.4 + dist / 240),
      nodeId: 'hub',
      flip: to.x < from.x,
      sent: false,
    }
  }

  private go(run: RunView, mesh: Mesh, n: MapNodeView): void {
    if (!n.adjacent || this.openDeck || this.walk || this.enterFx) return
    const from = this.anchorOf(run, mesh)
    const to = mesh.at(n.id)
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    if (dist < 2) {
      if (!n.interactive) return
      audio.sfx('click')
      this.enterFx = { nodeId: n.id, t: 0, dur: 0.78, sent: false }
      return
    }
    audio.sfx('click')
    this.faceLeft = to.x < from.x
    this.walk = {
      from, to, t: 0,
      dur: Math.min(0.9, 0.4 + dist / 240),
      nodeId: n.id,
      flip: to.x < from.x,
      sent: false,
    }
  }

  private spots(run: RunView, mesh: Mesh, fr: Frame): Spot[] {
    const hubP = mesh.at('hub')
    const out: Spot[] = [{
      id: 'hub', x: 0, y: 0, rank: 'visited', node: null,
      wx: hubP.x, wy: hubP.y,
      sx: Math.round(fr.x(hubP.x)), sy: Math.round(fr.y(hubP.y)),
    }]
    for (const n of run.nodes) {
      const p = mesh.at(n.id)
      out.push({
        id: n.id, x: n.x, y: n.y, rank: rankOf(n), node: n,
        wx: p.x, wy: p.y,
        sx: Math.round(fr.x(p.x)), sy: Math.round(fr.y(p.y)),
      })
    }
    return out
  }

  private edges(spots: Spot[], seed: number, scale: number): Edge[] {
    const out: Edge[] = []
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i], b = spots[j]
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) continue
        const bow = edgeBow(seed, a.id, b.id) * scale
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
