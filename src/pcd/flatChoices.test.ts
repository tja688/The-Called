import { describe, expect, it } from 'vitest'
import { cellChoice, otherChoices } from './flatChoices'
import opening from './fixtures/opening.json'
import type { PcdOption } from './types'

const target: PcdOption = { id: 'card:1', kind: 'card', instance: 1, cell: 5, cardId: 'card.c001' }

describe('二维目标交互', () => {
    it('浏览或选中手牌不阻挡待结算的场上目标', () => {
        expect(cellChoice([target], 5, 1, 4)).toEqual(target)
    })

    it('场上目标直接点击，区域外的目标仍有独立按钮', () => {
        const skip: PcdOption = { id: 'skip', kind: 'skip', instance: 0, cell: 0, cardId: null }
        const boardCard = opening.view.cells.flatMap(cell => cell.card ? [cell.card] : [])[0]
        if (!boardCard) throw new Error('开局场上没有卡牌')
        const visible = { ...target, instance: boardCard.instance }
        expect(otherChoices([visible, target, skip], opening.view)).toEqual([target, skip])
    })
})
