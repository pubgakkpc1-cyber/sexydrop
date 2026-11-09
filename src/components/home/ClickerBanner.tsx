import { Link } from 'react-router-dom'
import { KEY_LEVELS, KeyCap } from '../../screens/KeyCap'
import banners from './Banners.module.css'
import styles from './ClickerBanner.module.css'

/** Баннер «Кликалка» в том же виде, что Ракетка и Play Hub: бейдж, название и бесконечная лента кристаллов справа. */
export function ClickerBanner() {
  const cards = [...KEY_LEVELS.map((_, i) => i), ...KEY_LEVELS.map((_, i) => i)]
  return (
    <Link to="/games/clicker" className={`${banners.banner} ${styles.clicker}`} aria-label="Кликалка — марафон 30 дней">
      <span className={banners.badge}>
        <span>NEW</span>
      </span>
      <div className={styles.wrap} aria-hidden>
        <div className={styles.viewport}>
          <div className={styles.strip}>
            {cards.map((lv, i) => (
              <span key={i} className={styles.card}>
                <KeyCap level={lv} scale={0.3} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <span className={banners.titleRow}>
        <span className={banners.bannerTitle}>КЛИКАЛКА</span>
      </span>
    </Link>
  )
}
