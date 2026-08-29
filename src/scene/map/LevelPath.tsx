import { levels } from '../../config/gameContent'

type LevelPathProps = {
  onStartLevel: (levelId: string) => void
}

const NODE_EDGE_OFFSET = 24.3

function trimToNodeEdges(start: (typeof levels)[number], end: (typeof levels)[number]) {
  const dx = end.position.x - start.position.x
  const dy = end.position.y - start.position.y
  const length = Math.hypot(dx, dy)
  const offsetX = (dx / length) * NODE_EDGE_OFFSET
  const offsetY = (dy / length) * NODE_EDGE_OFFSET

  return {
    x1: start.position.x + offsetX,
    y1: start.position.y + offsetY,
    x2: end.position.x - offsetX,
    y2: end.position.y - offsetY,
  }
}

const PATH_SEGMENTS = levels.slice(0, -1).map((level, index) => (
  trimToNodeEdges(level, levels[index + 1])
))

export function LevelPath({ onStartLevel }: LevelPathProps) {
  return (
    <div className="level-path" aria-label="Level progression">
      <svg className="level-path-lines" viewBox="0 0 1000 1076" aria-hidden="true">
        {PATH_SEGMENTS.map((segment, index) => (
          <line
            key={levels[index].id}
            className="level-path-line level-path-line--inactive"
            {...segment}
          />
        ))}
      </svg>

      {levels.map((level, index) => {
        const isPlayable = level.playableInDemo && level.monsterId !== null
        const className = `level-path-node${index === 0 ? ' is-current' : ''}`
        const style = {
          left: `${level.position.x / 10}%`,
          top: `${(level.position.y / 1076) * 100}%`,
        }

        if (isPlayable) {
          return (
            <button
              key={level.id}
              className={className}
              style={style}
              type="button"
              aria-label={`Start ${level.label}`}
              onClick={() => onStartLevel(level.id)}
            >
              <span className="level-path-node__dot" aria-hidden="true" />
              <span className="level-path-node__label">{level.label}</span>
            </button>
          )
        }

        return (
          <div key={level.id} className={`${className} is-locked`} style={style} aria-label={`${level.label}, unavailable`}>
            <span className="level-path-node__dot" aria-hidden="true" />
            <span className="level-path-node__label">{level.label}</span>
          </div>
        )
      })}
    </div>
  )
}
