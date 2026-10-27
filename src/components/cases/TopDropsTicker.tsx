import { useEffect, useState } from 'react'
import { giftById, type CaseDefinition } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { CalendarIcon, GiftIcon, TonIcon } from '../shell/icons'
import styles from './TopDropsTicker.module.css'

interface TopDropsTickerProps {
  caseDefinition: CaseDefinition
}

const RECENT_DROPS_FIXTURES = [
  { giftId: 'diamond-ring', name: 'Diamond Ring', time: '1m ago', isHit: true },
  { giftId: 'astral-shard', name: 'Astral Shard', time: '2m ago', isHit: true },
  { giftId: 'cyber-helmet', name: 'Cyber Helmet', time: '3m ago', isHit: false },
  { giftId: 'durovs-cap', name: "Durov's Cap", time: '4m ago', isHit: true },
  { giftId: 'magic-potion', name: 'Magic Potion', time: '5m ago', isHit: false },
]

export function TopDropsTicker({ caseDefinition }: TopDropsTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Циклическая ротация последних дропов
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % RECENT_DROPS_FIXTURES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const currentDrop = RECENT_DROPS_FIXTURES[currentIndex]
  const gift = currentDrop ? giftById.get(currentDrop.giftId) : undefined

  return (
    <div className={styles.tickerBar} aria-label="Последние ТОП дропы">
      <div className={styles.caseTitleBlock}>
        <span className={styles.caseIcon}>
          {caseDefinition.freeCooldownMs !== null ? (
            <CalendarIcon style={{ width: '15px', height: '15px' }} />
          ) : (
            <GiftIcon style={{ width: '15px', height: '15px' }} />
          )}
        </span>
        <span>{caseDefinition.name}</span>
      </div>

      <div className={styles.tickerSection}>
        <span className={styles.tickerLabel}>ТОП дропы:</span>
        {gift && currentDrop && (
          <div key={gift.id} className={styles.dropItem}>
            {currentDrop.isHit && <span className={styles.hitBadge}>ХИТ</span>}
            <img className={styles.dropImage} src={gift.image} alt="" />
            <span className={styles.dropName}>{gift.name}</span>
            <span className={styles.dropPrice}>
              <TonIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
              {formatMinor(gift.priceMinor)} TON
            </span>
            <span className={styles.dropTime}>{currentDrop.time}</span>
          </div>
        )}
      </div>
    </div>
  )
}
