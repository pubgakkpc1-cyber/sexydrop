import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { currentSlot, liveFeed, msToNextSlot } from '../../services/liveFeed'
import { formatMinor } from '../../lib/money'
import { cx } from '../../lib/cx'
import styles from './LiveFeed.module.css'

/**
 * Лента «Live» под шапкой: последние дропы из кейсов, у всех пользователей одинаковые и
 * сменяются в один и тот же момент (по серверно-независимому расписанию — см. services/liveFeed).
 * Новый дроп выезжает слева, остальные сдвигаются.
 */
export function LiveFeed() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: number
    const tick = () => {
      const t = Date.now()
      setNow(t)
      timer = window.setTimeout(tick, msToNextSlot(t) + 20)
    }
    timer = window.setTimeout(tick, msToNextSlot(Date.now()) + 20)
    return () => window.clearTimeout(timer)
  }, [])

  const drops = liveFeed(now)
  const slot = currentSlot(now)

  return (
    <section className={styles.bar} aria-label="Live: последние дропы">
      <span className={styles.label}>
        <span className={styles.dot} aria-hidden />
        <span className={styles.labelText}>Live</span>
      </span>
      <div className={styles.track}>
        {drops.map((drop) => (
          <Link
            key={drop.slot}
            to={`/case/${drop.caseId}`}
            className={cx(styles.item, drop.isHit && styles.hit, drop.slot === slot && styles.fresh)}
            aria-label={`${drop.gift.name} из кейса ${drop.caseName} — ${formatMinor(drop.gift.priceMinor)} TON`}
          >
            <img
              src={drop.gift.image}
              alt=""
              className={/_\d\.png$/.test(drop.gift.image) ? styles.imgFull : styles.imgContain}
              loading="lazy"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
