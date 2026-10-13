// With start-game.bat running:
// playwright-cli open http://localhost:4174/
// playwright-cli run-code --filename=scripts/verify-drag-cancel.js
async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message) }
  const base = await page.evaluate(() => location.origin)
  await page.goto(base)
  await page.getByRole('button', { name: /开始冒险/ }).click()
  const started = page.waitForResponse(response => response.url().endsWith('/api/start'))
  await page.getByRole('button', { name: '走到失控机械' }).click()
  const state = await (await started).json()
  await page.waitForSelector('.battle-2d[data-ready="true"]')
  const play = state.pending.options.find(option => option.kind === 'play')
  assert(play, 'No playable card')
  const hand = page.locator(`[data-hand-instance="${play.instance}"]`)
  const origin = await hand.boundingBox()
  const target = await page.locator(`[data-cell="${play.cell}"]`).boundingBox()
  const requests = []
  const watch = request => { if (request.url().endsWith('/api/answer')) requests.push(request.url()) }
  page.on('request', watch)
  await page.mouse.move(origin.x + origin.width / 2, origin.y + origin.height / 2)
  await page.mouse.down()
  await page.mouse.move(origin.x + origin.width / 2, origin.y - 25, { steps: 5 })
  assert(await page.locator('.battle-drag-card').count() === 1, 'Drag did not start')
  await page.keyboard.press('Escape')
  assert(await page.locator('.battle-drag-card').count() === 0, 'Escape left a ghost card')
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(150)
  assert(requests.length === 0, 'Cancelled drag still played a card')
  assert(await page.locator('.battle-drag-card').count() === 0, 'Pointer movement resurrected cancelled drag')
  const response = page.waitForResponse(response => response.url().endsWith('/api/answer'))
  await hand.click()
  await page.locator(`[data-cell="${play.cell}"]`).click()
  const after = await (await response).json()
  assert(!after.error, 'Play after cancellation failed')
  assert(requests.length === 1, 'Cancellation prevented the next normal play')
  page.off('request', watch)
  return { status: 'passed', cancelledDragSubmissions: 0, nextNormalPlaySubmissions: 1 }
}
