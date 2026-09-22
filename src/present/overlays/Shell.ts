/**
 * 全局壳：菜单 / 规则 / 放弃确认。Esc 打开；演出锁不挡住本层（z≥100）。
 */
import { PAL, rgba } from '../../pixel/palette'
import { panel } from '../../pixel/ui'
import type { TextLayer } from '../../pixel/text'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'
import { HELP_PAGES } from '../fiction'
import type { PresentApp } from '../PresentApp'
import { TitleScene } from '../scenes/TitleScene'

export type ShellKind = 'none' | 'menu' | 'help' | 'quit'

const Z = 110

export class Shell {
  kind: ShellKind = 'none'
  helpPage = 0
  /** 教程关上后回到哪一层。主菜单打开时回到标题，暂停菜单打开时回到菜单。 */
  private helpReturn: ShellKind = 'none'

  get open(): boolean { return this.kind !== 'none' }

  close(): void { this.kind = 'none' }

  openMenu(): void { this.kind = 'menu' }

  openHelp(back: ShellKind = 'none'): void {
    this.helpReturn = back === 'help' ? 'none' : back
    this.kind = 'help'
    this.helpPage = 0
  }

  /** @returns 是否已经消化这次 Esc */
  esc(): boolean {
    if (this.kind === 'help') {
      this.kind = this.helpReturn
      return true
    }
    if (this.kind === 'quit') {
      this.kind = 'menu'
      return true
    }
    if (this.kind === 'menu') {
      this.kind = 'none'
      return true
    }
    return false
  }

  toggleHelp(): void {
    if (this.kind === 'help') this.kind = 'none'
    else this.openHelp()
  }

  render(app: PresentApp, ui: CanvasRenderingContext2D, text: TextLayer): void {
    if (this.kind === 'none') return
    text.occlude(0, 0, 640, 360)
    ui.fillStyle = rgba(PAL.shadow, 0.62)
    ui.fillRect(0, 0, 640, 360)
    app.input.region({
      id: 'shell-block',
      rect: { x: 0, y: 0, w: 640, h: 360 },
      onClick: () => { /* swallow */ },
      z: 100,
    })
    if (this.kind === 'menu') this.drawMenu(app, ui, text)
    else if (this.kind === 'help') this.drawHelp(app, ui, text)
    else this.drawQuit(app, ui, text)
  }

  private drawMenu(app: PresentApp, ui: CanvasRenderingContext2D, text: TextLayer): void {
    const inRun = this.inRun(app)
    const quit = canQuitWindow()
    const rows = 4 + (inRun ? 1 : 0) + (quit ? 1 : 0)
    const x = 200, y = 52, w = 240, h = 88 + rows * 32
    panel(ui, x, y, w, h, 'stone')
    text.draw('菜单', x + w / 2, y + 14, { size: 16, bold: true, align: 'center', color: PAL.lamp1 })
    let by = y + 44
    const btn = (id: string, label: string, fn: () => void, extra: { danger?: boolean; primary?: boolean } = {}) => {
      app.ui.button(id, { x: x + 28, y: by, w: w - 56, h: 26 }, label, () => {
        audio.sfx('click')
        fn()
      }, { small: true, z: Z, ...extra })
      by += 32
    }
    btn('sh-resume', '继续', () => { this.kind = 'none' }, { primary: true })
    btn('sh-help', '规则说明', () => this.openHelp('menu'))
    btn('sh-mute', audio.muted ? '音效：关' : '音效：开', () => audio.toggle())
    if (inRun) {
      btn('sh-quit-run', '放弃本趟', () => { this.kind = 'quit' }, { danger: true })
    }
    btn('sh-title', '回标题', () => {
      this.kind = 'none'
      void app.go(new TitleScene(app))
    })
    if (quit) {
      btn('sh-exit', '退出游戏', () => window.close(), { danger: true })
    }
    text.draw('Esc 关上  ·  F1 规则  ·  M 音效', x + w / 2, y + h - 18, {
      size: 10, align: 'center', color: PAL.gray3,
    })
  }

  private drawHelp(app: PresentApp, ui: CanvasRenderingContext2D, text: TextLayer): void {
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'stone')
    const page = HELP_PAGES[this.helpPage] ?? HELP_PAGES[0]
    text.draw(page.title, x + 20, y + 14, { size: 18, bold: true, color: PAL.lamp1 })
    text.paragraph(page.body, x + 20, y + 44, w - 40, { size: 13, color: PAL.cream, lineHeight: 18 })
    app.ui.button('help-prev', { x: x + 20, y: y + h - 40, w: 88, h: 26 }, '上一页', () => {
      this.helpPage = (this.helpPage + HELP_PAGES.length - 1) % HELP_PAGES.length
    }, { small: true, z: Z, disabled: this.helpPage === 0 })
    text.draw(`${this.helpPage + 1} / ${HELP_PAGES.length}`, x + w / 2, y + h - 28, {
      size: 12, align: 'center', baseline: 'middle', color: PAL.gray3,
    })
    app.ui.button('help-next', { x: x + w - 216, y: y + h - 40, w: 88, h: 26 }, '下一页', () => {
      this.helpPage = Math.min(HELP_PAGES.length - 1, this.helpPage + 1)
    }, { small: true, z: Z, disabled: this.helpPage >= HELP_PAGES.length - 1 })
    app.ui.button('help-back', { x: x + w - 112, y: y + h - 40, w: 88, h: 26 }, '返回', () => {
      audio.sfx('click')
      this.kind = this.helpReturn
    }, { primary: true, small: true, z: Z })
  }

  private drawQuit(app: PresentApp, ui: CanvasRenderingContext2D, text: TextLayer): void {
    const x = 160, y = 110, w = 320, h = 140
    panel(ui, x, y, w, h, 'stone')
    text.draw('放弃这一趟？', x + w / 2, y + 18, { size: 16, bold: true, align: 'center', color: PAL.lamp1 })
    text.paragraph('血条按失败结算。可以再开一趟。', x + 24, y + 48, w - 48, { size: 12, color: PAL.cream, lineHeight: 16 })
    app.ui.button('quit-no', { x: x + 24, y: y + h - 42, w: 120, h: 26 }, '取消', () => {
      audio.sfx('click')
      this.kind = 'menu'
    }, { small: true, z: Z })
    app.ui.button('quit-yes', { x: x + w - 144, y: y + h - 42, w: 120, h: 26 }, '确定放弃', () => {
      audio.sfx('click')
      this.kind = 'none'
      app.send({ type: 'run.abandon' })
    }, { small: true, danger: true, z: Z })
  }

  private inRun(app: PresentApp): boolean {
    const n = app.scene?.name
    return n !== 'title' && n !== 'ending' && !!app.view()
  }
}

function canQuitWindow(): boolean {
  return typeof location !== 'undefined' && location.protocol === 'file:'
}
