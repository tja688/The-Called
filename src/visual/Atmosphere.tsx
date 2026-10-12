import { useEffect, useRef } from 'react'

type Variant = 'home' | 'map' | 'battle' | 'deck'
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const GREYS = ['#09090a', '#101013', '#16161b', '#1c1c20', '#25252b']

function noise(x: number, y: number) {
    let n = Math.imul(x + 31, 374761393) ^ Math.imul(y + 7, 668265263)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function pixelLine(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    bx: number,
    by: number,
) {
    let x = Math.round(ax),
        y = Math.round(ay)
    const endX = Math.round(bx),
        endY = Math.round(by)
    const dx = Math.abs(endX - x),
        dy = -Math.abs(endY - y)
    const sx = x < endX ? 1 : -1,
        sy = y < endY ? 1 : -1
    let err = dx + dy
    for (;;) {
        ctx.fillRect(x, y, 1, 1)
        if (x === endX && y === endY) break
        const e = 2 * err
        if (e >= dy) {
            err += dy
            x += sx
        }
        if (e <= dx) {
            err += dx
            y += sy
        }
    }
}

function ring(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    rotation = 0,
    sides = 96,
) {
    for (let i = 0; i < sides; i++) {
        const a = rotation + (i * Math.PI * 2) / sides,
            b = rotation + ((i + 1) * Math.PI * 2) / sides
        pixelLine(
            ctx,
            x + Math.cos(a) * radius,
            y + Math.sin(a) * radius,
            x + Math.cos(b) * radius,
            y + Math.sin(b) * radius,
        )
    }
}

function polygon(
    ctx: CanvasRenderingContext2D,
    points: number[][],
    color: string,
) {
    ctx.fillStyle = color
    ctx.beginPath()
    points.forEach(([x, y], i) =>
        i
            ? ctx.lineTo(Math.round(x), Math.round(y))
            : ctx.moveTo(Math.round(x), Math.round(y)),
    )
    ctx.closePath()
    ctx.fill()
}

function buildBackdrop(width: number, height: number, variant: Variant) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas
    ctx.fillStyle = '#09090a'
    ctx.fillRect(0, 0, width, height)
    if (variant === 'home') {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const d = Math.hypot(
                    (x / width - 0.66) * 1.25,
                    (y / height - 0.44) * 1.4,
                )
                const tone = Math.max(0, 3.8 - d * 6)
                const lo = Math.floor(tone)
                ctx.fillStyle =
                    GREYS[
                        Math.min(
                            4,
                            lo +
                                ((tone - lo) * 16 > BAYER[(y & 3) * 4 + (x & 3)]
                                    ? 1
                                    : 0),
                        )
                    ]
                ctx.fillRect(x, y, 1, 1)
            }
        }
        for (let layer = 0; layer < 3; layer++) {
            ctx.fillStyle = ['#111114', '#0c0c0f', '#08080a'][layer]
            for (let x = 0; x < width; x++) {
                const ridge = Math.round(
                    height * (0.63 + layer * 0.12) +
                        Math.sin(x * 0.025 + layer) * 14 +
                        Math.sin(x * 0.065 + layer * 2) * 7,
                )
                ctx.fillRect(x, ridge, 1, height - ridge)
                if (layer === 0 && x % 3 === 0 && Math.cos(x * 0.025) > 0) {
                    ctx.fillStyle = '#3d1c26'
                    ctx.fillRect(x, ridge, 1, 1)
                    ctx.fillStyle = '#111114'
                }
            }
        }
    } else {
        const tile = 16
        const room = variant === 'battle'
        const narrow = width < 250
        const left = room
            ? narrow
                ? 4
                : Math.round(width / 2 - Math.min(width * 0.22, height * 0.29))
            : 0
        const right = room ? width - left : width
        const top = room ? Math.round(height * 0.14) : 0
        const bottom = room
            ? narrow
                ? Math.min(height - 8, top + width - 8 + 14)
                : Math.round(height * 0.71)
            : height
        for (let y = top; y < bottom; y += tile) {
            for (let x = left; x < right; x += tile) {
                ctx.fillStyle = room ? '#1a1a1f' : '#101013'
                ctx.fillRect(x, y, tile, tile)
                ctx.fillStyle = room ? '#29292f' : '#1d1d23'
                ctx.fillRect(x, y, 1, 1)
                for (let k = 0; k < 3; k++) {
                    const px = x + Math.floor(noise(x + k * 37, y) * 15),
                        py = y + Math.floor(noise(x, y + k * 31) * 15)
                    ctx.fillRect(px, py, 1 + (k === 2 ? 1 : 0), 1)
                }
                if (noise(x, y) > 0.92) {
                    ctx.fillStyle = '#08080a'
                    for (let k = 0; k < 5; k++)
                        ctx.fillRect(
                            x + 4 + Math.floor(Math.sin(k * 2) * 2),
                            y + k + 4,
                            1,
                            1,
                        )
                }
            }
        }
        if (room) {
            ctx.fillStyle = '#44444b'
            ctx.fillRect(left - 5, top - 6, right - left + 10, 5)
            ctx.fillRect(left - 5, top, 5, bottom - top)
            ctx.fillRect(right, top, 5, bottom - top)
            ctx.fillRect(left - 5, bottom, right - left + 10, 5)
            ctx.fillStyle = '#78787e'
            ctx.fillRect(left - 5, top - 6, right - left + 10, 1)
            ctx.fillRect(left - 5, top - 6, 1, bottom - top + 12)
            ctx.fillStyle = '#08080a'
            ctx.fillRect(left, top, right - left, 5)
            ctx.fillRect(left + 2, bottom - 4, right - left - 4, 4)
            for (const [x, y] of [
                [left - 8, top - 8],
                [right - 2, top - 8],
                [left - 8, bottom - 2],
                [right - 2, bottom - 2],
            ]) {
                ctx.fillStyle = '#4a4a51'
                ctx.fillRect(x, y, 10, 10)
                ctx.fillStyle = '#8c8c93'
                ctx.fillRect(x, y, 10, 1)
                ctx.fillStyle = '#2b2b30'
                ctx.fillRect(x + 2, y + 3, 6, 5)
            }
            // Small corner inscriptions and quiet ink stains, all on the flat floor.
            ctx.fillStyle = '#483139'
            for (let i = 0; i < 55; i++) {
                const x = left + noise(i, 1) * (right - left),
                    y = top + noise(i, 2) * (bottom - top)
                if (noise(i, 3) > 0.6)
                    ctx.fillRect(Math.round(x), Math.round(y), 2, 1)
            }
        }
    }
    return canvas
}

function drawRelic(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    time: number,
    color: string,
    radius: number,
) {
    // Ordered-dither halo: individual pixels instead of a blurred bloom.
    for (let y = -radius; y <= radius; y += 2) {
        for (let x = -radius; x <= radius; x += 2) {
            const d = Math.hypot(x, y) / radius
            if (
                d < 1 &&
                (1 - d) ** 2 * 8 >
                    BAYER[((y + radius) & 3) * 4 + ((x + radius) & 3)]
            ) {
                ctx.fillStyle = '#3b1b25'
                ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1)
            }
        }
    }
    for (let r = 0; r < 3; r++) {
        ctx.fillStyle = ['#35353d', '#24242a', '#3f2b32'][r]
        ring(ctx, cx, cy, radius * (1 - r * 0.18), 0, 80)
    }
    for (let i = 0; i < 48; i++) {
        const a = time * 0.04 + (i / 48) * Math.PI * 2
        ctx.fillStyle =
            i % 12 === 0 ? color : i % 4 === 0 ? '#5b5b63' : '#2b2b30'
        pixelLine(
            ctx,
            cx + Math.cos(a) * radius,
            cy + Math.sin(a) * radius,
            cx + Math.cos(a) * (radius + (i % 4 === 0 ? 5 : 2)),
            cy + Math.sin(a) * (radius + (i % 4 === 0 ? 5 : 2)),
        )
    }
    for (let i = 0; i < 6; i++) {
        const a = time * 0.1 + (i / 6) * Math.PI * 2,
            b = time * 0.1 + ((i + 2) / 6) * Math.PI * 2
        ctx.fillStyle = '#843143'
        pixelLine(
            ctx,
            cx + Math.cos(a) * radius * 0.68,
            cy + Math.sin(a) * radius * 0.68,
            cx + Math.cos(b) * radius * 0.68,
            cy + Math.sin(b) * radius * 0.68,
        )
    }
    ctx.fillStyle = '#74747c'
    ring(ctx, cx, cy, radius * 0.42, -time * 0.16, 8)
    for (let i = 0; i < 16; i++) {
        const a = -time * 0.045 + (i / 16) * Math.PI * 2
        const x = Math.round(cx + Math.cos(a) * radius * 0.81),
            y = Math.round(cy + Math.sin(a) * radius * 0.81)
        ctx.fillStyle = i === Math.floor(time * 2) % 16 ? color : '#48484f'
        const bits = (i * 139 + 219) & 511
        for (let j = 0; j < 9; j++)
            if (bits & (1 << j))
                ctx.fillRect(
                    x + (j % 3) - 1,
                    y + Math.floor(j / 3) * 2 - 2,
                    1,
                    1,
                )
    }
    const y = Math.round(cy + Math.sin(time * 1.45) * 3)
    const w = Math.round(8 + Math.abs(Math.cos(time * 0.55)) * 6),
        h = radius * 0.4
    polygon(
        ctx,
        [
            [cx, y - h],
            [cx - w, y],
            [cx, y],
        ],
        '#f0efe8',
    )
    polygon(
        ctx,
        [
            [cx, y - h],
            [cx + w, y],
            [cx, y],
        ],
        color,
    )
    polygon(
        ctx,
        [
            [cx, y + h],
            [cx - w, y],
            [cx, y],
        ],
        '#63636b',
    )
    polygon(
        ctx,
        [
            [cx, y + h],
            [cx + w, y],
            [cx, y],
        ],
        '#80283b',
    )
    ctx.fillStyle = '#f0efe8'
    pixelLine(ctx, cx, y - h, cx, y + h)
    for (let i = 0; i < 4; i++) {
        const a = time * 0.55 + (i / 4) * Math.PI * 2
        ctx.fillStyle = ['#35f0ff', color, '#ffcf3a', '#b56bff'][i]
        ctx.fillRect(
            Math.round(cx + Math.cos(a) * 23),
            Math.round(y + Math.sin(a) * 10),
            2,
            2,
        )
    }
}

export function Atmosphere({
    variant = 'home',
    accent = '#ff3d5a',
}: {
    variant?: Variant
    accent?: string
}) {
    const ref = useRef<HTMLCanvasElement>(null)
    const accentRef = useRef(accent)
    accentRef.current = accent
    useEffect(() => {
        const canvas = ref.current
        const ctx = canvas?.getContext('2d', { alpha: false })
        if (!canvas || !ctx) return
        let width = 1,
            height = 1,
            frame = 0,
            last = 0
        let backdrop: HTMLCanvasElement
        let mouseX = 0,
            mouseY = 0
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
        const resize = () => {
            const box = canvas.getBoundingClientRect()
            width = Math.max(1, Math.ceil(box.width / 3))
            height = Math.max(1, Math.ceil(box.height / 3))
            canvas.width = width
            canvas.height = height
            ctx.imageSmoothingEnabled = false
            backdrop = buildBackdrop(width, height, variant)
        }
        const pointer = (event: PointerEvent) => {
            mouseX = (event.clientX / window.innerWidth - 0.5) * 3
            mouseY = (event.clientY / window.innerHeight - 0.5) * 2
        }
        const draw = (now: number) => {
            frame = requestAnimationFrame(draw)
            if (document.hidden || now - last < 33) return
            last = now
            const t = reduced.matches ? 0 : now / 1000
            ctx.drawImage(backdrop, 0, 0)
            if (variant === 'home')
                drawRelic(
                    ctx,
                    width * 0.72 - mouseX,
                    height * 0.4 - mouseY,
                    t,
                    accentRef.current,
                    Math.min(width * 0.16, height * 0.27),
                )
            for (let i = 0; i < (variant === 'home' ? 55 : 28); i++) {
                const x = Math.round(
                    (noise(i, 11) * width + Math.sin(t * 0.3 + i) * 4 + width) %
                        width,
                )
                const y = Math.round(
                    (noise(i, 12) * height + t * (1 + (i % 4)) + height) %
                        height,
                )
                ctx.fillStyle =
                    i % 11 === 0
                        ? accentRef.current
                        : i % 9 === 0
                          ? '#64646b'
                          : '#303037'
                ctx.globalAlpha = i % 11 === 0 ? 0.6 : 0.5
                ctx.fillRect(x, y, 1, 1)
            }
            ctx.globalAlpha = 1
        }
        resize()
        const observer = new ResizeObserver(resize)
        observer.observe(canvas)
        window.addEventListener('pointermove', pointer, { passive: true })
        frame = requestAnimationFrame(draw)
        return () => {
            cancelAnimationFrame(frame)
            observer.disconnect()
            window.removeEventListener('pointermove', pointer)
        }
    }, [variant])
    return (
        <canvas
            ref={ref}
            className={`atmosphere atmosphere--${variant}`}
            aria-hidden="true"
        />
    )
}
