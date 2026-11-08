import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWalletStore } from '../../store/wallet'
import { useStarsBalanceStore } from '../../store/starsBalance'
import { useDisplayCurrencyStore } from '../../store/displayCurrency'
import { GRAPHICS_PRESETS, useGraphicsStore } from '../../store/graphics'
import { formatBalanceTon } from '../../lib/balanceFormat'
import { cx } from '../../lib/cx'
import { GraphicsMenu } from './GraphicsMenu'
import { CrownIcon, StarIcon, TonIcon } from './icons'
import styles from './GameTopBar.module.css'

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M2.5 9a14 14 0 0 1 19 0M5.6 12.4a9.5 9.5 0 0 1 12.8 0M8.8 15.7a5 5 0 0 1 6.4 0" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

interface GameTopBarProps {
  /** Если задан — рядом с настройками появляется кнопка админ-панели. */
  onAdmin?: () => void
  /** Растянуть на всю ширину внутри прокручиваемого контейнера с боковыми отступами (Ракетка). */
  bleed?: boolean
}

/**
 * Компактная верхняя панель игр (Ракетка и мини-игры): слева статус связи и настройки графики,
 * справа баланс с кнопкой «+». Без «назад» и без названия — как в референсе.
 */
export function GameTopBar({ onAdmin, bleed = false }: GameTopBarProps) {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode] ?? s.balances.demo ?? 0)
  const currency = useDisplayCurrencyStore((s) => s.currency)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const earnedStars = useStarsBalanceStore((s) => s.stars)
  const amount = currency === 'STARS' ? earnedStars.toLocaleString('ru-RU').replace(/ /g, ' ') : formatBalanceTon(balance)

  return (
    <div className={cx(styles.bar, bleed && styles.bleed)}>
      <div className={styles.left}>
        <span className={styles.status} role="status" aria-label={online ? 'Связь стабильна' : 'Нет связи'}>
          <span className={cx(styles.dot, !online && styles.dotOff)} />
          <WifiIcon className={cx(styles.wifi, !online && styles.wifiOff)} />
        </span>

        <GraphicsMenu />

        {onAdmin && (
          <button type="button" className={styles.gear} aria-label="Панель администратора" onClick={onAdmin}>
            <CrownIcon className={styles.gearIcon} />
          </button>
        )}
      </div>

      <button
        type="button"
        className={styles.balance}
        onClick={() => navigate('/deposit')}
        aria-label={`Баланс ${amount}. Пополнить`}
      >
        {currency === 'STARS' ? (
          <StarIcon className={cx(styles.coin, styles.coinStar)} aria-hidden />
        ) : (
          <TonIcon className={styles.coin} aria-hidden />
        )}
        <span className={styles.amount}>{amount}</span>
        <span className={styles.plus} aria-hidden>+</span>
      </button>
    </div>
  )
}

/** Для тестов и эффектов: число частиц по текущему качеству. */
export function currentGraphics() {
  return GRAPHICS_PRESETS[useGraphicsStore.getState().quality]
}
