import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL } from '../../pixel/palette'
import { bakeSky } from '../../pixel/sky'
import { nightWash, vignette } from '../../pixel/light'
import { audio } from '../../audio/audio'
import { TitleScene } from './TitleScene'

export class EndingScene extends Scene {
  readonly name = 'ending' as const
  private sky = bakeSky('night', 640, 240)
  private played = false

  enter(): void {
    const run = this.app.view()
    if (!this.played) {
      audio.sfx(run?.ended === 'victory' ? 'win' : 'lose')
      this.played = true
    }
    audio.atmosphere(null)
  }

  render(world: CanvasRenderingContext2D, _ui: CanvasRenderingContext2D, text: TextLayer): void {
    world.drawImage(this.sky, 0, 0)
    nightWash(world, 0.28)
    vignette(world, 0.4)
    const run = this.app.view()
    const win = run?.ended === 'victory'
    text.draw(win ? '通关' : '失败', 320, 110, { size: 32, bold: true, align: 'center', color: win ? PAL.lamp1 : PAL.fruR, stroke: PAL.ink, strokeWidth: 4 })
    text.draw(`血 ${run?.hp ?? 0}/${run?.hpMax ?? 30}`, 320, 160, { size: 14, align: 'center', color: PAL.cream })
    this.app.ui.button('again', { x: 248, y: 210, w: 144, h: 32 }, '再开一趟', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.start', seed: (run?.seed ?? 0) + 1 })
    }, { primary: true })
    this.app.ui.button('title', { x: 248, y: 250, w: 144, h: 26 }, '回标题', () => {
      audio.sfx('click')
      void this.app.go(new TitleScene(this.app))
    }, { small: true })
  }

  onConfirm(): void {
    const run = this.app.view()
    this.app.send({ type: 'run.start', seed: (run?.seed ?? 0) + 1 })
  }
}
