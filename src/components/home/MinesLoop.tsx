import { useEffect, useState } from 'react'
import { DropBombIcon, TonIcon } from '../shell/icons'
import { cx } from '../../lib/cx'
import styles from './MinesLoop.module.css'

/** Порядок открытия клеток: четыре гема, затем мина (индексы 0..8). */
const GEM_ORDER = [4, 0, 6, 2] as const
const BOMB_CELL = 8
/** Множитель после каждого безопасного хода (как в игре при 3 минах). */
const MULTS = ['1.00', '1.11', '1.27', '1.46', '1.69'] as const
const STEP_MS = 850
/** 0 — пусто; 1..4 — гемы; 5 — взрыв; 6, 7 — пауза; затем сброс. */
const LAST_STEP = 7

/**
 * Зацикленная сцена «Мин» для плитки Play Hub: клетки открываются одна за другой, растёт множитель,
 * в конце фирменная бомба-капля взрывается, поле трясётся — и всё начинается заново.
 * Состояние — один счётчик шага, анимации только на transform/opacity.
 */
export function MinesLoop() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced) {
      setStep(3)
      return
    }
    let id = 0
    const tick = () => {
      if (!document.hidden) setStep((s) => (s >= LAST_STEP ? 0 : s + 1))
    }
    id = window.setInterval(tick, STEP_MS)
    return () => window.clearInterval(id)
  }, [])

  const exploded = step >= 5
  const gemsOpen = Math.min(step, 4)
  const mult = exploded ? 'BOOM' : `x${MULTS[gemsOpen]}`

  return (
    <div className={cx(styles.wrap, exploded && styles.shake)} aria-hidden>
      <span className={cx(styles.chip, exploded && styles.chipBoom)}>{mult}</span>

      <div className={styles.board}>
        {Array.from({ length: 9 }, (_, i) => {
          const gemIdx = GEM_ORDER.indexOf(i as (typeof GEM_ORDER)[number])
          const isGem = gemIdx !== -1 && gemIdx < gemsOpen
          const isBomb = i === BOMB_CELL && exploded
          return (
            <span
              key={i}
              className={cx(styles.cell, isGem && styles.cellGem, isBomb && styles.cellBomb)}
            >
              {isGem && <TonIcon className={styles.gem} />}
              {isBomb && <DropBombIcon className={styles.bomb} />}
              {isBomb && <i className={styles.shock} />}
            </span>
          )
        })}
      </div>
    </div>
  )
}
