import { cx } from '../../lib/cx'
import { formatMinor, type Minor } from '../../lib/money'
import { TonIcon } from '../shell/icons'
import styles from './GramAmount.module.css'

interface GramAmountProps {
  minor: Minor
  /** Размер иконки TON. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** Сумма в TON: кристалл TON + число без фиктивной точности. */
export function GramAmount({ minor, size = 'sm', className }: GramAmountProps) {
  const amount = formatMinor(minor)
  return (
    <span className={cx(styles.gram, styles[size], className)}>
      <TonIcon className={styles.icon} aria-hidden />
      <span>{amount}</span>
      <span className={styles.srUnit}> TON</span>
    </span>
  )
}
