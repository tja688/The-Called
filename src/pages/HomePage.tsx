import { playGameStart } from '../audio/gameAudio'
import { HomeCardScene } from '../scene/home/HomeCardScene'
import { useNavigationStore } from '../stores/navigationStore'
import { BattleFilters } from '../ui/BattleFilters'

export function HomePage() {
  const openMap = useNavigationStore((state) => state.openMap)

  return (
    <main className="home-page">
      <div className="home-page__brain-texture" aria-hidden="true">
        <img src="/map/brain.png" alt="" />
      </div>
      <HomeCardScene />

      <section className="home-page__content" aria-labelledby="home-title">
        <h1 id="home-title" className="home-page__title">
          <span className="home-page__title-en">THE CALLED</span>
          <span className="home-page__title-cn">我们称之为怪物</span>
        </h1>
      </section>

      <button className="home-page__start" type="button" onClick={() => {
        playGameStart()
        openMap()
      }}>
        START
      </button>

      <div className="grain" aria-hidden="true" />
      <BattleFilters fight fightBlue />
    </main>
  )
}
