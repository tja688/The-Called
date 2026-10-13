// Run with both local servers running:
// playwright-cli open http://localhost:4174/
// playwright-cli run-code --filename=scripts/verify-2d.js
// Screenshots go to artifacts/visual. This exercises the real kernel through UI.
async (page) => {
    const base = await page.evaluate(() => location.origin)
    const originalBuild = await page.evaluate(() => localStorage.getItem('pcd-build'))
    const seedStart = async (route) => {
        const setup = route.request().postDataJSON()
        await route.continue({ postData: JSON.stringify({ ...setup, seed: 861 }) })
    }
    await page.route('**/api/start', seedStart)
    const errors = []
    const warnings = []
    const submitted = []
    const results = []
    const responseTraces = []
    const onError = (error) => errors.push(error.message)
    const onConsole = (message) => {
        if (message.type() === 'error') errors.push(message.text())
        if (message.type() === 'warning') warnings.push(message.text())
    }
    const onRequest = (request) => {
        if (request.url().endsWith('/api/answer'))
            submitted.push(JSON.parse(request.postData()).option)
    }
    page.on('pageerror', onError)
    page.on('console', onConsole)
    page.on('request', onRequest)
    const assert = (condition, message) => {
        if (!condition) throw new Error(message)
    }
    const stable = () =>
        page.waitForFunction(
            () =>
                document.querySelector('.battle-2d[data-ready="true"]') ||
                document.querySelector('.battle-result'),
            undefined,
            { timeout: 20000 },
        )
    const responseFor = () =>
        page.waitForResponse(
            (response) => response.url().endsWith('/api/answer'),
            { timeout: 15000 },
        )
    const catalog = await (await page.request.get(`${base}/api/catalog`)).json()
    const interactionDeck = {
        id: 'interaction-check',
        cards: [
            'card.c029', 'card.c029', 'card.c029',
            'card.c027', 'card.c027', 'card.c027',
            'card.c051', 'card.c051',
            'card.c001', 'card.c001', 'card.c001',
            'card.c002', 'card.c002', 'card.c002', 'card.c048',
        ],
    }
    const check = await (await page.request.post(`${base}/api/deck/validate`, {
        data: { cards: interactionDeck.cards, backs: interactionDeck.cards.map(() => '') },
    })).json()
    assert(check.ok, `Interaction deck is illegal: ${check.issues?.join(', ')}`)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(base)
    await page.getByRole('button', { name: /开始冒险/ }).waitFor()
    await page.screenshot({ path: 'artifacts/visual/home.png' })
    await page.getByRole('button', { name: /游戏说明/ }).click()
    await page.getByRole('dialog', { name: '九格之间' }).waitFor()
    await page.keyboard.press('Escape')
    assert(
        (await page.getByRole('dialog').count()) === 0,
        'Help did not close with Escape',
    )

    for (const deck of [...catalog.decks, interactionDeck]) {
    await page.evaluate(cards => {
        localStorage.setItem('pcd-build', JSON.stringify({ slots: cards.map(cardId => ({ cardId, backId: '' })) }))
    }, deck.cards)
    for (const monster of deck.id === interactionDeck.id ? ['失控机械'] : ['失控机械', '活数据库', '废燃泰坦']) {
        await page.goto(base)
        await page.getByRole('button', { name: /开始冒险/ }).click()
        await page.getByRole('button', { name: `走到${monster}` }).waitFor()
        if (monster === '失控机械')
            await page.screenshot({ path: 'artifacts/visual/map.png' })
        const started = page.waitForResponse((response) =>
            response.url().endsWith('/api/start'),
        )
        await page.getByRole('button', { name: `走到${monster}` }).click()
        let state = await (await started).json()
        responseTraces.push({ monster, kind: 'start', state })
        const eventSeqs = new Set(state.events.map(event => event.seq))
        await stable()
        await page.getByRole('button', { name: '▸ 常速', exact: true }).click()
        const firstHand = state.view.hand.find((card) =>
            state.pending.options.some(
                (option) =>
                    option.kind === 'play' && option.instance === card.instance,
            ),
        )
        if (monster === '失控机械' && firstHand) {
            await page
                .locator(`[data-hand-instance="${firstHand.instance}"]`)
                .click()
            const legal = await page
                .locator('[data-cell][data-legal="true"]')
                .evaluateAll((cells) =>
                    cells
                        .map((cell) => Number(cell.dataset.cell))
                        .sort((a, b) => a - b),
                )
            const offered = state.pending.options
                .filter(
                    (option) =>
                        option.kind === 'play' &&
                        option.instance === firstHand.instance,
                )
                .map((option) => option.cell)
                .sort((a, b) => a - b)
            assert(
                JSON.stringify(legal) === JSON.stringify(offered),
                'Highlighted cells differ from kernel offers',
            )
            await page.screenshot({
                path: 'artifacts/visual/battle-selected.png',
            })
            const illegal = state.view.cells.find(
                (cell) => !offered.includes(cell.cell),
            )
            if (illegal) {
                const count = submitted.length
                await page.locator(`[data-cell="${illegal.cell}"]`).click()
                assert(
                    submitted.length === count,
                    'An illegal cell was submitted to the kernel',
                )
            }
            await page.keyboard.press('Escape')
            await page.setViewportSize({ width: 1280, height: 720 })
            await page.waitForTimeout(160)
            await page.screenshot({ path: 'artifacts/visual/battle-1280.png' })
            await page.setViewportSize({ width: 390, height: 844 })
            await page.waitForTimeout(160)
            await page
                .locator(`[data-hand-instance="${firstHand.instance}"]`)
                .click()
            await page.screenshot({
                path: 'artifacts/visual/battle-mobile.png',
            })
            assert(
                await page.locator('.battle-mobile-detail').isVisible(),
                'Mobile cannot read full card rules',
            )
            await page.keyboard.press('Escape')
            await page.setViewportSize({ width: 1440, height: 900 })
            await page.getByRole('button', { name: /^牌组 \d+$/ }).click()
            await page
                .getByRole('dialog', { name: '牌组', exact: true })
                .waitFor()
            await page
                .getByRole('button', { name: '关闭', exact: true })
                .click()
        }
        const kinds = new Set()
        const decisions = new Set()
        let looseTargets = 0
        let dragged = false,
            captured = false
        for (let step = 0; step < 100 && !state.result; step++) {
            await stable()
            assert(
                state.pending?.actor === 'player',
                'No playable player decision',
            )
            const options = state.pending.options
            decisions.add(state.pending.type)
            let option
            if (state.pending.type !== 'play') option = options[0]
            else {
                const plays = options.filter((item) => item.kind === 'play')
                const casts = options.filter((item) => item.kind === 'cast')
                const score = (item) => {
                    const card = state.view.hand.find(
                        (hand) => hand.instance === item.instance,
                    )
                    const target = state.view.cells.find(
                        (cell) => cell.cell === item.cell,
                    )?.card
                    return (
                        (deck.id === interactionDeck.id && ['card.c029', 'card.c051'].includes(card?.cardId) ? 100 : 0) +
                        (card?.currentPoints ?? 0) +
                        (target?.owner === 'monster'
                            ? 8 + target.currentPoints
                            : 0)
                    )
                }
                option =
                    step % 3 === 1 && casts.length
                        ? casts[0]
                        : (plays.sort((a, b) => score(b) - score(a))[0] ??
                          casts[0] ??
                          options.find((item) => item.kind === 'end-turn') ??
                          options[0])
            }
            assert(option, 'The kernel gave no option')
            kinds.add(option.kind)
            const expected = option.id
            const beforeSubmissions = submitted.length
            const response = responseFor()
            if (option.kind === 'play') {
                const hand = page.locator(
                    `[data-hand-instance="${option.instance}"]`,
                )
                if (!dragged) {
                    const origin = await hand.boundingBox(),
                        destination = await page
                            .locator(`[data-cell="${option.cell}"]`)
                            .boundingBox()
                    assert(origin && destination, 'Drag target has no geometry')
                    await page.mouse.move(
                        origin.x + origin.width / 2,
                        origin.y + origin.height / 2,
                    )
                    await page.mouse.down()
                    await page.mouse.move(
                        destination.x + destination.width / 2,
                        destination.y + destination.height / 2,
                        { steps: 12 },
                    )
                    await page.mouse.up()
                    dragged = true
                } else {
                    await hand.click()
                    await page.locator(`[data-cell="${option.cell}"]`).click()
                }
            } else if (option.kind === 'cast') {
                await page
                    .locator(`[data-hand-instance="${option.instance}"]`)
                    .click()
                await page.getByRole('button', { name: /施放法术/ }).click()
            } else if (option.kind === 'end-turn')
                await page.getByRole('button', { name: /^结束回合/ }).click()
            else if (option.kind === 'cell')
                await page.locator(`[data-cell="${option.cell}"]`).click()
            else if (option.kind === 'card') {
                const board = state.view.cells.find(
                    (cell) => cell.card?.instance === option.instance,
                )
                if (board) {
                    const hand = state.view.hand.find(card => card.instance !== option.instance)
                    if (hand) {
                        await page.locator(`[data-hand-instance="${hand.instance}"]`).click()
                        assert(submitted.length === beforeSubmissions, 'Browsing hand answered an unrelated target choice')
                    }
                    assert(await page.locator(`[data-cell="${board.cell}"][data-legal="true"]`).count() === 1,
                        'Browsing hand disabled a legal board target')
                    await page.screenshot({ path: `artifacts/visual/target-${deck.id}-${monster}.png` })
                    await page.locator(`[data-cell="${board.cell}"]`).click()
                } else if (
                    state.view.hand.some(
                        (card) => card.instance === option.instance,
                    )
                )
                    await page
                        .locator(`[data-hand-instance="${option.instance}"]`)
                        .click()
                else {
                    looseTargets++
                    if (deck.id === interactionDeck.id) {
                        await page.setViewportSize({ width: 390, height: 844 })
                        await page.screenshot({ path: 'artifacts/visual/target-off-board-mobile.png' })
                    }
                    await page
                        .locator(`[data-option-id="${option.id}"]`)
                        .click()
                    await page.setViewportSize({ width: 1440, height: 900 })
                }
            } else await page.locator(`[data-option-id="${option.id}"]`).click()
            state = await (await response).json()
            assert(submitted.length === beforeSubmissions + 1, 'A gesture submitted more than one answer')
            assert(!state.error, state.error)
            for (const event of state.events) {
                assert(!eventSeqs.has(event.seq), `Repeated event ${event.seq} after a target answer`)
                eventSeqs.add(event.seq)
            }
            responseTraces.push({ monster, kind: expected, state })
            assert(
                submitted.at(-1) === expected,
                `UI submitted ${submitted.at(-1)} instead of ${expected}`,
            )
            await stable()
            if (
                !captured &&
                state.view.cells.filter((cell) => cell.card).length >= 4
            ) {
                await page.screenshot({
                    path: `artifacts/visual/battle-${monster}.png`,
                })
                captured = true
            }
        }
        assert(state.result, `${monster} did not reach a result`)
        if (deck.id === interactionDeck.id) {
            assert(decisions.has('play-card'), 'Extra-play decision was not exercised')
            assert(looseTargets > 0, 'Off-board target selection was not exercised')
        }
        await page.getByRole('dialog', { name: '对局结果' }).waitFor()
        assert(
            (await page.locator('.battle-result__score').innerText()) ===
                `${state.view.playerPoints}\n玩家\n:\n${state.view.monsterPoints}\n怪物`,
            'Result points disagree with kernel',
        )
        await page.screenshot({
            path: `artifacts/visual/result-${monster}.png`,
        })
        results.push({
            deck: deck.id,
            monster,
            winner: state.result.winner,
            rounds: state.view.round,
            points: [state.view.playerPoints, state.view.monsterPoints],
            choices: [...kinds],
            decisions: [...decisions],
            looseTargets,
            drag: dragged,
        })
        await page
            .getByRole('button', { name: '回到地图', exact: true })
            .click()
        await page.getByRole('region', { name: '遗迹地图' }).waitFor()
    }
    }
    page.off('pageerror', onError)
    page.off('console', onConsole)
    page.off('request', onRequest)
    await page.unroute('**/api/start', seedStart)
    await page.evaluate(saved => {
        if (saved === null) localStorage.removeItem('pcd-build')
        else localStorage.setItem('pcd-build', saved)
    }, originalBuild)
    const report = {
        status: errors.length ? 'failed' : 'passed',
        results,
        submittedChoices: submitted.length,
        errors,
        warnings,
        screenshotDirectory: 'artifacts/visual',
    }
    // Keep failed traces available for diagnosis without changing the product or kernel.
    await page.evaluate(
        (data) => {
            window.__visualVerification = data
        },
        { report, responseTraces },
    )
    assert(errors.length === 0, errors.join('\n'))
    return report
}
