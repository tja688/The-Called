function unit(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return value - Math.floor(value)
}

const CARDS = Array.from({ length: 18 }, (_, index) => {
  const width = 72 + unit(index, 1) * 78
  return {
    id: index,
    left: 28 + unit(index, 2) * 68,
    width,
    delay: -unit(index, 3) * 18,
    duration: 11 + unit(index, 4) * 13,
    drift: (unit(index, 5) - 0.5) * 90,
    tilt: (unit(index, 6) - 0.5) * 36,
    spin: (unit(index, 7) - 0.5) * 50,
    opacity: 0.28 + unit(index, 8) * 0.45,
    mark: unit(index, 9) > 0.5 ? 'diamond' : 'square',
  }
})

export function FallingCards() {
  return (
    <div className="home-fall" aria-hidden="true">
      {CARDS.map((card) => (
        <div
          key={card.id}
          className={`home-fall__card home-fall__card--${card.mark}`}
          style={{
            left: `${card.left}%`,
            width: `${card.width}px`,
            animationDelay: `${card.delay}s`,
            animationDuration: `${card.duration}s`,
            ['--drift' as string]: `${card.drift}px`,
            ['--tilt' as string]: `${card.tilt}deg`,
            ['--spin' as string]: `${card.spin}deg`,
            ['--card-opacity' as string]: card.opacity,
          }}
        >
          <span className="home-fall__frame" />
          <span className="home-fall__mark" />
          <span className="home-fall__rule" />
        </div>
      ))}
    </div>
  )
}
