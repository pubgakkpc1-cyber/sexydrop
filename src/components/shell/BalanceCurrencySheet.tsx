import { formatMinor } from '../../lib/money'
import { STARS_PER_TON, minorToStars } from '../../lib/stars'
import { hapticImpact } from '../../lib/telegram'
import { useDisplayCurrencyStore, type DisplayCurrency } from '../../store/displayCurrency'
import { cx } from '../../lib/cx'
import { BottomSheet } from '../ui'
import { StarIcon, TonIcon } from './icons'
import styles from './BalanceCurrencySheet.module.css'

interface BalanceCurrencySheetProps {
  open: boolean
  onClose: () => void
  balanceMinor: number
}

function fmtStars(stars: number): string {
  return stars.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
}

/** Плашка «В чём показывать баланс»: TON или Telegram Stars. */
export function BalanceCurrencySheet({ open, onClose, balanceMinor }: BalanceCurrencySheetProps) {
  const currency = useDisplayCurrencyStore((s) => s.currency)
  const setCurrency = useDisplayCurrencyStore((s) => s.setCurrency)

  const options: ReadonlyArray<{ id: DisplayCurrency; name: string; hint: string; value: string; icon: 'ton' | 'star' }> = [
    { id: 'TON', name: 'TON', hint: 'Основная валюта игры', value: formatMinor(balanceMinor), icon: 'ton' },
    { id: 'STARS', name: 'Telegram Stars', hint: `${STARS_PER_TON} Stars = 1 TON`, value: fmtStars(minorToStars(balanceMinor)), icon: 'star' },
  ]

  return (
    <BottomSheet open={open} onClose={onClose} title="В чём показывать баланс">
      <div className={styles.list} role="radiogroup" aria-label="Валюта баланса">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={currency === o.id}
            className={cx(styles.option, currency === o.id && styles.optionActive)}
            onClick={() => {
              hapticImpact('light')
              setCurrency(o.id)
              onClose()
            }}
          >
            <span className={cx(styles.badge, o.icon === 'star' && styles.badgeStar)}>
              {o.icon === 'ton' ? <TonIcon className={styles.badgeIcon} aria-hidden /> : <StarIcon className={styles.badgeIcon} aria-hidden />}
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{o.name}</span>
              <span className={styles.hint}>{o.hint}</span>
            </span>
            <span className={styles.value}>{o.value}</span>
            <span className={styles.check} aria-hidden>
              {currency === o.id ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>
      <p className={styles.note}>Валюта меняет только показ баланса в шапке — сами средства не конвертируются.</p>
    </BottomSheet>
  )
}
