import { playGameStart } from '../audio/gameAudio'
import { HomeCardScene } from '../scene/home/HomeCardScene'
import { useNavigationStore } from '../stores/navigationStore'
export function HomePage() {
  const openMap = useNavigationStore((state) => state.openMap)

  return (
    <main className="home-page">
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
        开始
      </button>
    </main>
  )
}
