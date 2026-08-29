interface LoadingScreenProps {
  progress: number
}

export function LoadingScreen({ progress }: LoadingScreenProps) {
  const percentage = Math.round(progress * 100)

  return (
    <main className="loading-screen" aria-busy="true" aria-label={`加载中 ${percentage}%`}>
      <div className="loading-panel">
        <div className="loading-title-row">
          <span>THE CALLED</span>
          <span>{percentage.toString().padStart(3, '0')}%</span>
        </div>
        <div
          className="loading-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div className="loading-fill" style={{ width: `${percentage}%` }} />
        </div>
        <p className="loading-status">我们称之为怪物</p>
      </div>
    </main>
  )
}
