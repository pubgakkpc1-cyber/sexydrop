import { Banners } from '../components/home/Banners'
import { CasesGrid } from '../components/home/CasesGrid'
import { FreeCasesSection } from '../components/home/FreeCasesSection'
import { LiveDrops } from '../components/home/LiveDrops'
import styles from './screens.module.css'

/**
 * Главный экран (раздел 7): Live Drops → баннеры → бесплатные кейсы →
 * сетка платных кейсов; каждый раздел лежит на своей матовой подложке.
 */
export function HomeScreen() {
  return (
    <div className={styles.screen}>
      <LiveDrops />
      <section className={styles.panel} aria-label="Игры">
        <h2 className={styles.panelTitle}>Игры</h2>
        <Banners />
      </section>
      <section className={styles.panel} aria-label="Бесплатные кейсы">
        <FreeCasesSection />
      </section>
      <section className={styles.panel} aria-label="Кейсы">
        <CasesGrid />
      </section>
    </div>
  )
}
