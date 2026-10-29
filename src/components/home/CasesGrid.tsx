import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { paidCases } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { cx } from '../../lib/cx'
import { TonIcon, SparkleIcon } from '../shell/icons'
import styles from './CasesGrid.module.css'

/**
 * Сетка платных кейсов (7.4) в оформлении референса: тёмная плитка со свечением
 * под артом, нижняя панель с названием и ценовой пилюлей (зелёная у кейсов
 * дешевле 1 GRAM, сиреневая у остальных), чип «НОВОЕ» слева сверху.
 * Правило пилюли — конфигурация оформления; цены остаются конфигом продукта.
 */
export function CasesGrid() {
  return (
    <section className={styles.section} aria-label="Кейсы">
      <h2 className={styles.title}>Кейсы</h2>
      <div className={styles.grid}>
        {paidCases.map((gameCase) => {
          const cheap = gameCase.priceMinor < 1000
          return (
            <Link
              key={gameCase.id}
              to={`/case/${gameCase.id}`}
              className={styles.tile}
              aria-label={`Кейс ${gameCase.name} — ${formatMinor(gameCase.priceMinor)} TON`}
            >
              <span className={styles.art} style={{ '--case-glow': gameCase.glow } as CSSProperties}>
                {gameCase.isNew && (
                  <span className={styles.newBadge}>
                    <SparkleIcon className={styles.newBadgeIcon} aria-hidden />
                    НОВОЕ
                  </span>
                )}
                <img className={styles.image} src={gameCase.image} alt="" />
              </span>
              <span className={styles.bar}>
                <span className={styles.name}>{gameCase.name}</span>
                <span className={cx(styles.pricePill, cheap ? styles.pillGreen : styles.pillPurple)}>
                  <TonIcon className={styles.pillIcon} aria-hidden />
                  {formatMinor(gameCase.priceMinor)}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
