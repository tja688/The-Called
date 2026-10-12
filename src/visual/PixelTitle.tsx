const LETTERS: Record<string, string[]> = {
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
}

export function PixelTitle({
    word,
    className = '',
}: {
    word: string
    className?: string
}) {
    return (
        <svg
            className={`pixel-title ${className}`}
            viewBox={`0 0 ${word.length * 6 - 1} 7`}
            role="img"
            aria-label={word}
            shapeRendering="crispEdges"
        >
            {[...word].flatMap((letter, index) =>
                (LETTERS[letter] ?? []).flatMap((row, y) =>
                    [...row].map((pixel, x) =>
                        pixel === '1' ? (
                            <rect
                                key={`${index}-${x}-${y}`}
                                x={index * 6 + x}
                                y={y}
                                width="1"
                                height="1"
                                fill={
                                    index === 1 && word === 'CALLED'
                                        ? 'var(--red)'
                                        : 'currentColor'
                                }
                            />
                        ) : null,
                    ),
                ),
            )}
        </svg>
    )
}
