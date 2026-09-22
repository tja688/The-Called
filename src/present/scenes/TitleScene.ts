import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL, rgba, SCHOOL_COLOR } from '../../pixel/palette'
import { Scenery, GROUND_Y } from '../../pixel/scenery'
import { ASSETS } from '../../pixel/assets'
import { drawSprite, blit } from '../../pixel/dsl'
import { audio } from '../../audio/audio'
import { fictionName, avatarSpriteId, DECK_BLURB } from '../fiction'
import { bannerBg, panel } from '../../pixel/ui'
import { startingDeck } from '../../content/decks'
import type { DeckId } from '../../domain/types'
import {
  paintDeckCard,
  paintGateShaft,
  paintMenuButton,
  paintMenuCursor,
  paintMenuLights,
  paintWaxSeal,
  type MenuIcon,
} from '../menuPaint'

type Mode = 'menu' | 'deck'
type Overlay = 'none' | 'settings' | 'quit'

interface MenuRow {
  id: 'start' | 'settings' | 'help' | 'quit'
  label: string
  icon: MenuIcon
  x: number
  y: number
  w: number
  h: number
  primary?: boolean
}

const MENU: MenuRow[] = [
  { id: 'start', label: '开始游戏', icon: 'start', x: 392, y: 108, w: 220, h: 46, primary: true },
  { id: 'settings', label: '设置', icon: 'settings', x: 404, y: 164, w: 208, h: 36 },
  { id: 'help', label: '教程', icon: 'help', x: 404, y: 208, w: 208, h: 36 },
  { id: 'quit', label: '退出游戏', icon: 'quit', x: 404, y: 252, w: 208, h: 36 },
]

const DECKS: { id: DeckId; school: string; who: string }[] = [
  { id: 'DK.A', school: 'SYS.A', who: 'PC.A00' },
  { id: 'DK.B', school: 'SYS.B', who: 'PC.B00' },
  { id: 'DK.C', school: 'SYS.C', who: 'PC.C00' },
]

const CARD_W = 184
const CARD_H = 176
const CARD_Y = 70

function cardX(i: number): number {
  return 30 + i * (CARD_W + 14)
}

function signatureOf(id: DeckId): string[] {
  const seen: string[] = []
  for (const c of startingDeck(id).cards) {
    if (!seen.includes(c)) seen.push(c)
    if (seen.length === 3) break
  }
  return seen
}

export class TitleScene extends Scene {
  readonly name = 'title' as const
  private scenery = new Scenery('gate')
  private t = 0
  private seed = 1
  private deckId: DeckId = 'DK.A'
  private mode: Mode = 'menu'
  private focus = 0
  private overlay: Overlay = 'none'
  private quitPick = 0
  /** 切入选行囊后的一小段时间不吃 Enter，避免按键连发直接开局。 */
  private deckArm = 0
  /** 一次确认后短暂忽略下一次 Enter，按键连发不会把刚打开的层立刻关掉或跳过。 */
  private confirmArm = 0
  private seenHover: string | null = null
  /** 刚进入选行囊时指针还停在「开始游戏」上，先别把那一格当成选中。 */
  private deckHold: { x: number; y: number } | null = null

  enter(): void {
    audio.atmosphere(null)
  }

  update(dt: number): void {
    this.t += dt
    this.scenery.update(dt)
    const hover = this.app.input.hover
    if (this.deckArm > 0) this.deckArm = Math.max(0, this.deckArm - dt)
    if (this.confirmArm > 0) this.confirmArm = Math.max(0, this.confirmArm - dt)
    if (hover !== this.seenHover) {
      this.seenHover = hover
      if (this.mode === 'menu' && this.overlay === 'none') {
        const i = MENU.findIndex((row) => hover === `menu-${row.id}`)
        if (i >= 0) this.focus = i
      }
      if (this.mode === 'deck') {
        const hold = this.deckHold
        if (hold && Math.hypot(this.app.input.x - hold.x, this.app.input.y - hold.y) < 6) {
          /* 指针还没动 */
        } else {
          this.deckHold = null
          for (const d of DECKS) {
            if (hover === `deck-${d.id}`) this.chooseDeck(d.id, true)
          }
        }
      }
    }
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 48, this.t)
    paintGateShaft(world, this.t)
    this.scenery.drawFront(world, 48, this.t)
    if (this.mode === 'menu') this.drawParty(world)
    const row = this.mode === 'menu' ? MENU[this.focus] : undefined
    const deckI = DECKS.findIndex((d) => d.id === this.deckId)
    const glowAt = row
      ? { x: row.x + row.w / 2, y: row.y + row.h / 2 }
      : deckI >= 0
        ? { x: cardX(deckI) + CARD_W / 2, y: CARD_Y + 24 }
        : undefined
    paintMenuLights(world, this.t, glowAt)

    if (this.mode === 'menu') this.drawMenu(ui, text)
    else this.drawDeck(world, ui, text)
  }

  onConfirm(): void {
    if (this.confirmArm > 0) return
    if (this.overlay === 'settings') {
      this.overlay = 'none'
      return
    }
    if (this.overlay === 'quit') {
      if (this.quitPick === 0) this.overlay = 'none'
      else this.doQuit()
      return
    }
    if (this.mode === 'deck') {
      if (this.deckArm <= 0) this.startRun()
      return
    }
    this.activate(MENU[this.focus].id)
  }

  onCancel(): boolean {
    if (this.overlay !== 'none') {
      this.overlay = 'none'
      return true
    }
    if (this.mode === 'deck') {
      this.mode = 'menu'
      return true
    }
    return true
  }

  onKey(k: string): void {
    if (this.overlay === 'quit') {
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd') this.quitPick = this.quitPick ? 0 : 1
      return
    }
    if (this.overlay === 'settings') return
    if (this.mode === 'deck') {
      if (k === '1') this.chooseDeck('DK.A', true)
      else if (k === '2') this.chooseDeck('DK.B', true)
      else if (k === '3') this.chooseDeck('DK.C', true)
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.stepDeck(-1)
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.stepDeck(1)
      else if (k === '-' || k === '_') this.seed = Math.max(1, this.seed - 1)
      else if (k === '=' || k === '+') this.seed += 1
      return
    }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') this.focus = (this.focus + MENU.length - 1) % MENU.length
    if (k === 'ArrowDown' || k === 's' || k === 'S') this.focus = (this.focus + 1) % MENU.length
  }

  private chooseDeck(id: DeckId, sound: boolean): void {
    if (this.deckId === id) return
    this.deckId = id
    if (sound) audio.sfx('click')
  }

  private stepDeck(dir: number): void {
    const i = DECKS.findIndex((d) => d.id === this.deckId)
    const next = DECKS[(i + dir + DECKS.length) % DECKS.length]
    this.chooseDeck(next.id, true)
  }

  private activate(id: MenuRow['id']): void {
    audio.sfx('click')
    this.confirmArm = 0.4
    if (id === 'start') {
      this.mode = 'deck'
      this.deckArm = 0.45
      this.deckHold = { x: this.app.input.x, y: this.app.input.y }
    }
    else if (id === 'settings') this.overlay = 'settings'
    else if (id === 'help') this.app.shell.openHelp('none')
    else {
      this.quitPick = 0
      this.overlay = 'quit'
    }
  }

  private startRun(): void {
    audio.sfx('click')
    this.app.send({ type: 'run.start', seed: this.seed, deckId: this.deckId })
  }

  private doQuit(): void {
    audio.sfx('click')
    window.close()
    window.setTimeout(() => {
      this.app.toast('窗口还在。直接关掉这个页面即可。')
    }, 280)
  }

  private drawParty(world: CanvasRenderingContext2D): void {
    const spots = [168, 252, 336]
    spots.forEach((x, i) => {
      const sprite = ASSETS.sprite(avatarSpriteId(DECKS[i].who))
      if (!sprite) return
      const bob = Math.sin(this.t * 2.2 + i * 1.4)
      drawSprite(world, sprite, x, GROUND_Y + Math.round(bob), {
        anim: 'idle',
        t: this.t + i * 0.4,
        shadow: true,
        scale: 3.6,
        squash: [1 + bob * 0.03, 1 - bob * 0.05],
      })
    })
  }

  private drawMenu(ui: CanvasRenderingContext2D, text: TextLayer): void {
    if (this.overlay === 'none') {
      paintWaxSeal(ui, 268, 46, this.t)
      text.draw('锈门', 268, 38, {
        size: 13, bold: true, align: 'center', color: PAL.goldL, stroke: PAL.redD, strokeWidth: 3,
      })
    }

    text.draw('TheCall', 32, 16, {
      size: 40, bold: true, color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 5, shadow: true,
    })
    text.draw('深渊的呼唤', 34, 60, {
      size: 18, bold: true, color: PAL.cream, stroke: PAL.ink, strokeWidth: 3,
    })
    ui.fillStyle = PAL.copper
    ui.fillRect(34, 86, 148, 1)
    ui.fillStyle = PAL.lamp1
    ui.fillRect(34, 86, 36, 1)
    text.draw('灰石堡地下  ·  锈门层', 34, 94, { size: 12, color: PAL.tanL })

    MENU.forEach((row, i) => {
      const hot = i === this.focus && this.overlay === 'none'
      const pressed = hot && this.app.input.isPressed(`menu-${row.id}`)
      if (hot) paintMenuCursor(ui, row.x - 22, row.y + row.h / 2, this.t)
      const at = paintMenuButton(ui, row.x, row.y, row.w, row.h, {
        icon: row.icon,
        primary: row.primary,
        hot,
        pressed,
      })
      text.draw(row.label, at.x, at.y, {
        size: row.primary ? 16 : 14,
        bold: true,
        align: 'left',
        baseline: 'middle',
        color: PAL.ink,
      })
      if (this.overlay === 'none') {
        this.app.ui.hit(`menu-${row.id}`, { x: row.x, y: row.y, w: row.w, h: row.h }, () => this.activate(row.id), 12)
      }
    })

    if (this.overlay === 'none') {
      bannerBg(ui, 332, 28, 0.72)
      text.draw('↑ ↓ 选择    ·    Enter 确认', 320, 340, { size: 11, align: 'center', color: PAL.gray3 })
      return
    }

    text.occlude(0, 0, 640, 360)
    ui.fillStyle = rgba(PAL.shadow, 0.66)
    ui.fillRect(0, 0, 640, 360)
    this.app.ui.hit('ov-block', { x: 0, y: 0, w: 640, h: 360 }, () => { this.overlay = 'none' }, 40)
    if (this.overlay === 'settings') this.drawSettings(ui, text)
    else this.drawQuit(ui, text)
  }

  private drawSettings(ui: CanvasRenderingContext2D, text: TextLayer): void {
    const x = 168, y = 84, w = 304, h = 176
    this.app.ui.hit('ov-panel', { x, y, w, h }, () => {}, 45, 'default')
    panel(ui, x, y, w, h, 'stone')
    text.draw('设置', x + w / 2, y + 16, { size: 18, bold: true, align: 'center', color: PAL.lamp1 })
    text.draw('音效', x + 28, y + 58, { size: 14, color: PAL.cream, baseline: 'middle' })
    const on = !audio.muted
    this.app.ui.button('set-audio', { x: x + 148, y: y + 44, w: 124, h: 30 }, on ? '开着' : '关着', () => {
      audio.sfx('click')
      audio.toggle()
    }, { primary: on, z: 50 })
    text.draw('M 键同样能开关', x + w / 2, y + 96, { size: 11, align: 'center', color: PAL.gray3 })
    this.app.ui.button('set-done', { x: x + 88, y: y + h - 46, w: 128, h: 30 }, '完成', () => {
      audio.sfx('click')
      this.overlay = 'none'
    }, { primary: true, z: 50 })
  }

  private drawQuit(ui: CanvasRenderingContext2D, text: TextLayer): void {
    const x = 170, y = 104, w = 300, h = 140
    this.app.ui.hit('ov-panel', { x, y, w, h }, () => {}, 45, 'default')
    panel(ui, x, y, w, h, 'stone')
    text.draw('退出游戏？', x + w / 2, y + 18, { size: 16, bold: true, align: 'center', color: PAL.lamp1 })
    text.draw('窗口会关掉。', x + w / 2, y + 48, { size: 12, align: 'center', color: PAL.cream })
    const stayHot = this.quitPick === 0
    const quitHot = this.quitPick === 1
    this.app.ui.button('quit-stay', { x: x + 24, y: y + h - 48, w: 116, h: 30 }, '留下', () => {
      audio.sfx('click')
      this.overlay = 'none'
    }, { primary: stayHot, z: 50 })
    this.app.ui.button('quit-go', { x: x + w - 140, y: y + h - 48, w: 116, h: 30 }, '退出', () => this.doQuit(), {
      danger: quitHot, z: 50,
    })
  }

  private drawDeck(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    text.draw('选一套行囊', 320, 12, {
      size: 22, bold: true, align: 'center', color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 4,
    })
    text.draw('灰石堡地下。选一套，清掉垂死巨人。', 320, 40, {
      size: 12, align: 'center', color: PAL.cream,
    })

    this.app.ui.button('deck-back', { x: 16, y: 12, w: 72, h: 26 }, '返回', () => {
      audio.sfx('click')
      this.mode = 'menu'
    }, { small: true, z: 12 })

    DECKS.forEach((d, i) => {
      const x = cardX(i)
      const hot = this.deckId === d.id
      const color = SCHOOL_COLOR[d.school] ?? PAL.gold
      const top = paintDeckCard(ui, { x, y: CARD_Y, hot, color }, CARD_W, CARD_H)
      if (hot) {
        const pulse = 0.4 + 0.15 * Math.sin(this.t * 3)
        world.save()
        world.globalCompositeOperation = 'screen'
        world.fillStyle = rgba(color, pulse)
        world.fillRect(x + 8, top - 6, CARD_W - 16, 4)
        world.restore()
      }
      text.draw(fictionName(d.school), x + 12, top + 16, {
        size: 11, bold: true, color: hot ? color : PAL.gray3,
      })
      text.draw(String(i + 1), x + CARD_W - 16, top + 14, {
        size: 12, bold: true, align: 'center', color: hot ? PAL.lamp1 : PAL.gray2,
      })
      const sprite = ASSETS.sprite(avatarSpriteId(d.who))
      if (sprite) {
        const bob = hot ? Math.sin(this.t * 3) : 0
        drawSprite(ui, sprite, x + CARD_W / 2, top + CARD_H - 68 + Math.round(bob), {
          anim: 'idle',
          t: this.t + i,
          shadow: true,
          scale: hot ? 4 : 3.2,
        })
      }
      text.draw(fictionName(d.id), x + CARD_W / 2, top + CARD_H - 64, {
        size: 13, bold: true, align: 'center', color: hot ? PAL.cream : PAL.gray3,
        stroke: PAL.ink, strokeWidth: 3,
      })
      const icons = signatureOf(d.id)
      const rowW = icons.length * 24 + Math.max(0, icons.length - 1) * 8
      icons.forEach((id, k) => {
        const icon = ASSETS.card(id)
        const ix = x + Math.round((CARD_W - rowW) / 2) + k * 32
        blit(ui, icon, ix, top + CARD_H - 40, 1)
      })
      if (!hot) {
        ui.fillStyle = rgba(PAL.shadow, 0.16)
        ui.fillRect(x + 3, top + 3, CARD_W - 6, CARD_H - 6)
      }
      this.app.ui.hit(`deck-${d.id}`, { x, y: CARD_Y - (hot ? 8 : 0), w: CARD_W, h: CARD_H }, () => {
        this.chooseDeck(d.id, true)
      }, 12)
    })

    const blurb = DECK_BLURB[this.deckId] ?? ''
    bannerBg(ui, 254, 24, 0.78, 36, 568)
    text.draw(blurb, 320, 258, { size: 12, align: 'center', color: PAL.cream })

    this.app.ui.button('seed-', { x: 108, y: 290, w: 28, h: 28 }, '−', () => {
      this.seed = Math.max(1, this.seed - 1)
    }, { small: true })
    text.draw(`种子 ${this.seed}`, 196, 296, { size: 13, align: 'center', color: PAL.cream, bold: true })
    this.app.ui.button('seed+', { x: 248, y: 290, w: 28, h: 28 }, '+', () => {
      this.seed += 1
    }, { small: true })

    const go = paintMenuButton(ui, 360, 284, 220, 40, { icon: 'start', primary: true, hot: true })
    text.draw('开一趟', go.x, go.y, {
      size: 16, bold: true, align: 'left', baseline: 'middle', color: PAL.ink,
    })
    this.app.ui.hit('deck-go', { x: 360, y: 284, w: 220, h: 40 }, () => this.startRun(), 12)

    text.draw('1 2 3 选行囊    ·    Enter 开局    ·    Esc 返回', 320, 342, {
      size: 11, align: 'center', color: PAL.gray3,
    })
  }
}
