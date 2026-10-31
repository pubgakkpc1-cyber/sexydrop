import { TonIcon } from '../shell/icons'
import { FEATURES } from '../../lib/features'
import styles from './PlayLoop.module.css'

/**
 * Зацикленная CSS-сцена для баннера Play Hub: стрелка апгрейда крутится по кольцу шанса,
 * шарик скачет по колышкам, куб открывается и показывает гем, всплывают «+TON».
 * Только transform/opacity — без нагрузки на главный поток.
 */
export function PlayLoop() {
  return (
    <div className={styles.wrap} aria-hidden>
      <div className={styles.glow} />

      <div className={`${styles.tile} ${styles.upgrade}`}>
        <span className={styles.ring}>
          <span className={styles.needle} />
        </span>
        <span className={styles.pct}>24%</span>
      </div>

      {FEATURES.plinko && (
        <div className={`${styles.tile} ${styles.plinko}`}>
          <span className={styles.peg} style={{ left: '50%', top: '22%' }} />
          <span className={styles.peg} style={{ left: '32%', top: '44%' }} />
          <span className={styles.peg} style={{ left: '68%', top: '44%' }} />
          <span className={styles.peg} style={{ left: '50%', top: '66%' }} />
          <span className={styles.ball} />
        </div>
      )}

      <div className={`${styles.tile} ${styles.mines}`}>
        <span className={`${styles.cube} ${styles.cubeA}`}>
          <span className={styles.cubeFront} />
          <span className={styles.cubeBack}>◆</span>
        </span>
        <span className={`${styles.cube} ${styles.cubeB}`}>
          <span className={styles.cubeFront} />
          <span className={styles.cubeBack}>◆</span>
        </span>
      </div>

      <span className={`${styles.coin} ${styles.coin1}`}>
        +2.4 <TonIcon className={styles.coinIcon} />
      </span>
      <span className={`${styles.coin} ${styles.coin2}`}>
        +0.8 <TonIcon className={styles.coinIcon} />
      </span>
    </div>
  )
}
