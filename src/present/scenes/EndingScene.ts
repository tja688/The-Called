import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL } from '../../pixel/palette'
import { Scenery } from '../../pixel/scenery'
import { audio } from '../../audio/audio'
import { TitleScene } from './TitleScene'

export class EndingScene extends Scene {
  readonly name = 'ending' as const
  private scenery = new Scenery('boss')
  private t = 0
  private played = false

  enter(): void {
    const run = this.app.view()
    if (!this.played) {
      audio.sfx(run?.ended === 'victory' ? 'win' : 'lose')
      this.played = true
    }
    audio.atmosphere(null)
    this.scenery = new Scenery(run?.ended === 'victory' ? 'gate' : 'boss')
  }

  update(dt: number): void { this.t += dt }

  render(world: CanvasRenderingContext2D, _ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 20, this.t)
    this.scenery.drawFront(world, 20, this.t)
    const run = this.app.view()
    const win = run?.ended === 'victory'
    text.draw(win ? '锈门开了' : '没能出去', 320, 110, { size: 32, bold: true, align: 'center', color: win ? PAL.lamp1 : PAL.fruR, stroke: PAL.ink, strokeWidth: 4 })
    text.draw(`血 ${run?.hp ?? 0}/${run?.hpMax ?? 30}`, 320, 160, { size: 14, align: 'center', color: PAL.cream })
    this.app.ui.button('again', { x: 248, y: 210, w: 144, h: 32 }, '再开一趟', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.start', seed: (run?.seed ?? 0) + 1, deckId: run?.deckId ?? 'DK.A' })
    }, { primary: true })
    this.app.ui.button('title', { x: 248, y: 250, w: 144, h: 26 }, '回标题', () => {
      audio.sfx('click')
      void this.app.go(new TitleScene(this.app))
    }, { small: true })
  }

  onConfirm(): void {
    const run = this.app.view()
    this.app.send({ type: 'run.start', seed: (run?.seed ?? 0) + 1, deckId: run?.deckId ?? 'DK.A' })
  }
}
