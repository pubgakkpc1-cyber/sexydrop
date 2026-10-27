import { Banners } from '../components/home/Banners'
import { CasesGrid } from '../components/home/CasesGrid'
import { FreeCasesSection } from '../components/home/FreeCasesSection'
import { LiveDrops } from '../components/home/LiveDrops'
import styles from './screens.module.css'

/**
 * Главный экран (раздел 7): Live Drops → баннеры → бесплатные кейсы →
 * сетка платных кейсов.
 */
export function HomeScreen() {
  return (
    <div className={styles.screen}>
      <LiveDrops />
      <Banners />
      <FreeCasesSection />
      <CasesGrid />
    </div>
  )
}
