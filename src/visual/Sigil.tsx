type Shape = Array<[number, number, number, number, string]>

function artwork(id: string): Shape {
    const n = Number(id.match(/\d+$/)?.[0] ?? 0)
    const pixels: Shape = []
    const rect = (
        x: number,
        y: number,
        w: number,
        h: number,
        color = 'currentColor',
    ) => pixels.push([x, y, w, h, color])
    const dark = '#4a4a51',
        light = '#f0efe8'
    const robot =
        id.includes('monster') || id.includes('.m') || [2, 19, 21].includes(n)
    if (robot) {
        rect(10, 4, 12, 3, dark)
        rect(8, 7, 16, 10, light)
        rect(10, 17, 12, 8, dark)
        rect(4, 11, 4, 10, light)
        rect(24, 11, 4, 10, light)
        rect(8, 25, 6, 3, light)
        rect(18, 25, 6, 3, light)
        rect(10, 10, 12, 5, '#09090a')
        rect(11, 11, 3, 2)
        rect(18, 11, 3, 2)
        rect(13, 19, 6, 3)
        rect(15, 2, 2, 3)
        if (n === 3 || n === 21) {
            rect(2, 9, 4, 3)
            rect(26, 9, 4, 3)
            rect(11, 22, 10, 2, light)
        }
    } else if ([7, 30, 32, 35, 36, 49, 50, 51].includes(n)) {
        rect(12, 5, 8, 2, dark)
        rect(10, 7, 12, 8, light)
        rect(8, 15, 16, 9, dark)
        rect(6, 17, 3, 9, light)
        rect(23, 17, 3, 9, light)
        rect(10, 24, 4, 4, light)
        rect(18, 24, 4, 4, light)
        rect(11, 9, 3, 3, '#09090a')
        rect(18, 9, 3, 3, '#09090a')
        rect(14, 13, 4, 2)
        rect(12, 17, 8, 3)
        rect(15, 21, 2, 3, light)
    } else if ([11, 12, 13, 40, 41, 42, 43, 44].includes(n)) {
        rect(14, 5, 4, 2)
        rect(12, 7, 8, 6, light)
        rect(11, 13, 10, 4, dark)
        rect(10, 17, 12, 3, light)
        rect(8, 20, 16, 3, light)
        rect(6, 23, 20, 4, dark)
        rect(15, 14, 2, 10)
        rect(12, 17, 8, 2)
        rect(4, 12, 2, 15, light)
        rect(2, 10, 6, 2)
    } else if ([8, 9, 14, 28, 37, 38, 48].includes(n)) {
        rect(8, 26, 16, 2, dark)
        rect(10, 23, 12, 3, light)
        rect(12, 8, 8, 15, dark)
        rect(10, 6, 12, 4, light)
        rect(14, 3, 4, 3)
        rect(14, 12, 4, 7, light)
        rect(8, 13, 4, 2)
        rect(20, 13, 4, 2)
        rect(15, 19, 2, 4)
    } else if ([3, 17, 18, 23, 24].includes(n)) {
        rect(7, 24, 18, 3, dark)
        rect(12, 18, 8, 6, light)
        rect(10, 13, 12, 5, dark)
        rect(16, 8, 13, 5, light)
        rect(26, 8, 3, 5)
        rect(12, 10, 5, 8, light)
        rect(3, 6, 3, 2)
        rect(6, 3, 2, 3)
        rect(3, 3, 2, 2)
        rect(15, 20, 2, 3)
    } else if (n === 25) {
        rect(8, 4, 16, 3, light)
        rect(8, 25, 16, 3, light)
        for (let i = 0; i < 8; i++) {
            rect(9 + i, 7 + i, 1, 1, dark)
            rect(22 - i, 7 + i, 1, 1, dark)
            rect(9 + i, 24 - i, 1, 1, dark)
            rect(22 - i, 24 - i, 1, 1, dark)
        }
        rect(14, 12, 4, 3)
        rect(15, 15, 2, 7)
        rect(12, 22, 8, 2)
    } else {
        // Scanner, eye, prism or spell. Each content ID has a fixed silhouette.
        const eye = [1, 5, 16, 22, 26, 29, 45, 47].includes(n)
        if (eye) {
            rect(7, 12, 18, 2, light)
            rect(4, 14, 24, 4, light)
            rect(7, 18, 18, 2, light)
            rect(10, 10, 12, 2, dark)
            rect(10, 20, 12, 2, dark)
            rect(12, 12, 8, 8, '#09090a')
            rect(14, 14, 4, 4)
            rect(15, 4, 2, 4, dark)
            rect(15, 24, 2, 4, dark)
            rect(2, 15, 2, 2)
            rect(28, 15, 2, 2)
            if (n === 26) {
                rect(10, 22, 3, 4, light)
                rect(7, 26, 16, 2, dark)
            }
        } else {
            for (let row = 0; row < 20; row++) {
                const span = Math.max(1, 9 - Math.abs(row - 9))
                rect(16 - span, row + 5, span, 1, row < 10 ? light : dark)
                rect(
                    16,
                    row + 5,
                    span,
                    1,
                    row < 10 ? 'currentColor' : '#5d354c',
                )
            }
            rect(6, 26, 20, 2, dark)
            rect(15, 5, 1, 20, light)
        }
    }
    return pixels
}

export function Sigil({
    id,
    className = '',
}: {
    id: string
    className?: string
}) {
    return (
        <svg
            viewBox="0 0 32 32"
            className={`sigil ${className}`}
            aria-hidden="true"
            shapeRendering="crispEdges"
        >
            {artwork(id).map(([x, y, w, h, color], index) => (
                <rect
                    key={index}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={color}
                />
            ))}
        </svg>
    )
}
