import { useEffect, useState, type CSSProperties } from 'react'
import { getWebApp, hapticImpact } from '../../lib/telegram'
import { waitUntilReady } from './splashReady'
import styles from './SplashDesktop.module.css'

const GIFTS = [
  'heart_locket_1', 'plush_pepe_2', 'mini_oscar_1', 'ion_gem_1', 'precious_peach_3', 'durovs_cap_2', 'bonded_ring_1', 'astral_shard_2',
].map((id) => `/gifts/${id}.webp`)
const WORD = 'SEXY DROP'.split('')
const TOTAL_MS = 2600

const STATUS = [
  [0, 'Подключаемся к Telegram'],
  [35, 'Загружаем кейсы и подарки'],
  [70, 'Готовим игры'],
  [92, 'Добро пожаловать'],
] as const

/**
 * Запуск для ПК: отдельная заставка на весь экран. Две ленты подарков плывут навстречу друг другу,
 * в центре буквы названия выезжают по одной, снизу широкая полоса загрузки с процентами.
 * Анимация стартует, только когда окно готово (шрифты, разворот на весь экран) — всегда с первого кадра.
 */
export function SplashDesktop({ onFinish }: { onFinish: () => void }) {
  const [ready, setReady] = useState(() => !getWebApp())
  const [progress, setProgress] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (ready) return
    let alive = true
    void Promise.race([waitUntilReady(true).catch(() => undefined), new Promise((r) => window.setTimeout(r, 1500))]).then(
      () => alive && setReady(true),
    )
    return () => {
      alive = false
    }
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const start = performance.now()
    let hit = false
    const id = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / TOTAL_MS)
      // плавное замедление к концу: быстрый старт, спокойный финал
      const eased = 1 - Math.pow(1 - t, 2.2)
      setProgress(Math.round(eased * 100))
      if (!hit && t > 0.28) {
        hit = true
        hapticImpact('light')
      }
      if (t >= 1) {
        window.clearInterval(id)
        setExiting(true)
        window.setTimeout(onFinish, 420)
      }
    }, 40)
    return () => window.clearInterval(id)
  }, [ready, onFinish])

  const status = [...STATUS].reverse().find(([from]) => progress >= from)?.[1] ?? STATUS[0][1]
  const skip = () => {
    if (exiting) return
    setExiting(true)
    window.setTimeout(onFinish, 300)
  }

  return (
    <div
      className={`${styles.root} ${ready ? styles.run : ''} ${exiting ? styles.exit : ''}`}
      role="status"
      aria-label="Загрузка приложения"
      onClick={skip}
    >
      <div className={styles.glow} aria-hidden />

      <div className={`${styles.rail} ${styles.railTop}`} aria-hidden>
        <div className={styles.track}>
          {[...GIFTS, ...GIFTS, ...GIFTS].map((src, i) => (
            <img key={i} src={src} alt="" className={styles.tile} decoding="async" />
          ))}
        </div>
      </div>
      <div className={`${styles.rail} ${styles.railBottom}`} aria-hidden>
        <div className={`${styles.track} ${styles.trackBack}`}>
          {[...GIFTS].reverse().concat([...GIFTS].reverse(), [...GIFTS].reverse()).map((src, i) => (
            <img key={i} src={src} alt="" className={styles.tile} decoding="async" />
          ))}
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.word} aria-hidden>
          {WORD.map((ch, i) => (
            <span key={i} className={styles.letter} style={{ '--i': i } as CSSProperties}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </div>
        <div className={styles.line} aria-hidden />
        <div className={styles.brand}>SEXY DROP Mini App</div>
      </div>

      <div className={styles.bar}>
        <div className={styles.barHead}>
          <span className={styles.status}>{status}</span>
          <span className={styles.percent}>{progress}%</span>
        </div>
        <div className={styles.track2}>
          <div className={styles.fill} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
