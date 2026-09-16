import { GameService } from './application/GameService'
import { content } from './content'

content()

const game = new GameService()
const params = new URLSearchParams(location.search)
const present = params.get('present') ?? 'pixel'

async function boot(): Promise<void> {
  if (present === 'dom') {
    await import('./shell/theme.css')
    const { App } = await import('./shell/App')
    const app = new App(game)
    ;(window as unknown as { called: { game: GameService; app: unknown } }).called = { game, app }
    return
  }
  const host = document.getElementById('stage')
  if (!host) {
    console.warn('没有 #stage，回落到白模')
    await import('./shell/theme.css')
    const { App } = await import('./shell/App')
    const app = new App(game)
    ;(window as unknown as { called: { game: GameService; app: unknown } }).called = { game, app }
    return
  }
  host.style.display = 'block'
  host.replaceChildren()
  document.getElementById('app')?.remove()
  try { await document.fonts?.ready } catch { /* ignore */ }
  const { PresentApp } = await import('./present/PresentApp')
  const app = new PresentApp(game, host)
  ;(window as unknown as { called: { game: GameService; app: unknown } }).called = { game, app }
}

void boot()
