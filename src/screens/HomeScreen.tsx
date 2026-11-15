import { Banners } from '../components/home/Banners'
import { ClickerBanner } from '../components/home/ClickerBanner'
import { CasesGrid } from '../components/home/CasesGrid'
import { FreeCasesSection } from '../components/home/FreeCasesSection'
import styles from './screens.module.css'

/**
 * Главный экран (раздел 7): баннеры → бесплатные кейсы →
 * сетка платных кейсов; каждый раздел лежит на своей матовой подложке.
 */
export function HomeScreen() {
  return (
    <div className={`${styles.screen} ${styles.home}`}>
      <section className={`${styles.panel} ${styles.homeGames}`} aria-label="Игры">
        <h2 className={styles.panelTitle}>Игры</h2>
        <div className={styles.gamesGrid}>
          <Banners />
          <ClickerBanner />
        </div>
      </section>
      <section className={`${styles.panel} ${styles.homeFree}`} aria-label="Бесплатные кейсы">
        <FreeCasesSection />
      </section>
      <section className={`${styles.panel} ${styles.homeCases}`} aria-label="Кейсы">
        <CasesGrid />
      </section>
    </div>
  )
}
