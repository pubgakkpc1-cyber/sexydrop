import { giftById, type Rarity } from '../../data/catalog'
import { useInventoryStore } from '../../store/inventory'
import styles from './LiveDrops.module.css'

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b29a9b',
  rare: '#c7696d',
  epic: '#cf7d81',
  legendary: '#c96e72',
}

const SOURCE_LABEL: Record<string, string> = {
  'case-open': 'платный кейс',
  'free-case': 'бесплатный кейс',
}

/**
 * Лента дропов (2.1) — визуал референса. Честность данных: в Demo Mode лента
 * показывает ТОЛЬКО собственные дропы пользователя из журнала инвентаря —
 * никаких сгенерированных «чужих» событий (спека 2.4). Глобальная лента
 * backend-событий (7.8) появится в TIER 7; пока секция без дропов не выводится.
 */
export function LiveDrops() {
  const drops = useInventoryStore((s) => s.history)
    .filter((event) => event.type === 'acquire')
    .slice(0, 14)

  if (drops.length === 0) return null

  return (
    <section className={styles.section} aria-label="Live Drops">
      <div className={styles.liveLabel}>
        <span className={styles.liveDot} aria-hidden />
        <span>Live</span>
      </div>
      <div className={styles.strip}>
        {drops.map((drop) => {
          const gift = giftById.get(drop.giftId)
          if (!gift) return null
          return (
            <div
              key={drop.uid}
              className={styles.tile}
              style={{
                background: `linear-gradient(145deg, ${RARITY_COLOR[gift.rarity]}2e, ${RARITY_COLOR[gift.rarity]}12)`,
                border: `1px solid ${RARITY_COLOR[gift.rarity]}66`,
              }}
              title={`${gift.name} · ${SOURCE_LABEL[drop.detail] ?? drop.detail}`}
            >
              <img className={styles.tileImage} src={gift.image} alt="" />
            </div>
          )
        })}
      </div>
    </section>
  )
}
