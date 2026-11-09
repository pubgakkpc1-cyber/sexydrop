import { PAUSE_TEXT, PAUSE_TITLE } from '../../lib/features'
import styles from './PauseNotice.module.css'

/** Крупная плашка: вывод и задания на паузе. Показывается в инвентаре, на замках подарков и в окне задания. */
export function PauseNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? styles.compact : styles.box} role="status">
      <strong className={styles.title}>⏸ {PAUSE_TITLE}</strong>
      <p className={styles.text}>{PAUSE_TEXT}</p>
    </div>
  )
}
