import { useEffect, useState } from 'react'
import { KeyCap } from '../../screens/KeyCap'
import { cx } from '../../lib/cx'
import styles from './ClickerLoop.module.css'

const TICK_MS = 380
/** За один цикл клавиша нажимается столько раз, потом шкала ранга заполнена и всё начинается заново. */
const TAPS_PER_LOOP = 12

/**
 * Зацикленная сцена «Кликалки» для плитки Play Hub в том же виде, что Ракетка и Мины: тёмное окно,
 * счётчик слева, клавиша нажимается, взлетает «+1», шкала ранга заполняется — и сначала.
 * Анимации только на transform/opacity, при скрытой вкладке не тикает.
 */
export function ClickerLoop() {
  const [taps, setTaps] = useState(0)
  const [down, setDown] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced) {
      setTaps(6)
      return
    }
    let release = 0
    const id = window.setInterval(() => {
      if (document.hidden) return
      setTaps((t) => (t >= TAPS_PER_LOOP ? 0 : t + 1))
      setDown(true)
      window.clearTimeout(release)
      release = window.setTimeout(() => setDown(false), 130)
    }, TICK_MS)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(release)
    }
  }, [])

  const count = 1240 + taps * 8
  return (
    <div className={styles.wrap} aria-hidden>
      <div className={styles.left}>
        <span className={styles.count}>{count.toLocaleString('ru-RU')}</span>
        <span className={styles.bar}>
          <i className={styles.fill} style={{ transform: `scaleX(${taps / TAPS_PER_LOOP})` }} />
        </span>
      </div>
      <div className={styles.keyBox}>
        <KeyCap level={3} pressed={down} scale={0.36} />
        <span key={taps} className={cx(styles.plus, taps > 0 && styles.plusFly)}>
          +1
        </span>
      </div>
    </div>
  )
}
