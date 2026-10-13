import type { PcdOption, PcdView } from './types'

/** The kernel owns legality. This only maps an offered choice to a flat-board gesture. */
export function cellChoice(
    options: readonly PcdOption[],
    cell: number,
    instance: number | null,
    selected: number | null,
) {
    const target = options.find(
        (option) => option.kind === 'cell' && option.cell === cell,
    ) ?? options.find(
        (option) => option.kind === 'card' && instance !== null && option.instance === instance,
    )
    if (target) return target
    if (selected !== null)
        return options.find(
            (option) =>
                option.kind === 'play' &&
                option.instance === selected &&
                option.cell === cell,
        )
    return undefined
}

export function otherChoices(options: readonly PcdOption[], view: PcdView) {
    const visibleInstances = new Set(
        [
            ...view.hand,
            ...view.cells.flatMap((cell) => (cell.card ? [cell.card] : [])),
        ].map((card) => card.instance),
    )
    return options.filter(
        (option) =>
            !['play', 'cast', 'end-turn', 'cell'].includes(option.kind) &&
            (option.kind !== 'card' || !visibleInstances.has(option.instance)),
    )
}

export type CellEffect = {
    cell: number
    kind: 'enter' | 'leave' | 'points' | 'status'
    owner: string
    delta: number
}

export function cellEffects(before: PcdView, after: PcdView): CellEffect[] {
    return after.cells.flatMap((cell): CellEffect[] => {
        const previous = before.cells.find(
            (item) => item.cell === cell.cell,
        )?.card
        const next = cell.card
        if (next && next.instance !== previous?.instance)
            return [
                { cell: cell.cell, kind: 'enter', owner: next.owner, delta: 0 },
            ]
        if (!next && previous)
            return [
                {
                    cell: cell.cell,
                    kind: 'leave',
                    owner: previous.owner,
                    delta: 0,
                },
            ]
        if (next && previous && next.currentPoints !== previous.currentPoints)
            return [
                {
                    cell: cell.cell,
                    kind: 'points',
                    owner: next.owner,
                    delta: next.currentPoints - previous.currentPoints,
                },
            ]
        if (
            next &&
            previous &&
            next.statuses.join('|') !== previous.statuses.join('|')
        )
            return [
                {
                    cell: cell.cell,
                    kind: 'status',
                    owner: next.owner,
                    delta: 0,
                },
            ]
        return []
    })
}
