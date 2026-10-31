import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWalletStore } from '../../store/wallet'
import { useDisplayCurrencyStore } from '../../store/displayCurrency'
import { GRAPHICS_PRESETS, useGraphicsStore, type GraphicsQuality } from '../../store/graphics'
import { formatBalanceStars, formatBalanceTon } from '../../lib/balanceFormat'
import { hapticImpact } from '../../lib/telegram'
import { cx } from '../../lib/cx'
import { CrownIcon, StarIcon, TonIcon } from './icons'
import styles from './GameTopBar.module.css'

const QUALITY_LABELS: ReadonlyArray<{ id: GraphicsQuality; label: string }> = [
  { id: 'high', label: 'Высокая' },
  { id: 'medium', label: 'Средняя' },
  { id: 'low', label: 'Низкая' },
]

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M2.5 9a14 14 0 0 1 19 0M5.6 12.4a9.5 9.5 0 0 1 12.8 0M8.8 15.7a5 5 0 0 1 6.4 0" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

interface GameTopBarProps {
  /** Если задан — рядом с настройками появляется кнопка админ-панели. */
  onAdmin?: () => void
}

/**
 * Компактная верхняя панель игр (Ракетка и мини-игры): слева статус связи и настройки графики,
 * справа баланс с кнопкой «+». Без «назад» и без названия — как в референсе.
 */
export function GameTopBar({ onAdmin }: GameTopBarProps) {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode] ?? s.balances.demo ?? 0)
  const currency = useDisplayCurrencyStore((s) => s.currency)
  const quality = useGraphicsStore((s) => s.quality)
  const setQuality = useGraphicsStore((s) => s.setQuality)
  const [menuOpen, setMenuOpen] = useState(false)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const menuRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const amount = currency === 'STARS' ? formatBalanceStars(balance) : formatBalanceTon(balance)

  return (
    <div className={styles.bar}>
      <div className={styles.left} ref={menuRef}>
        <span className={styles.status} role="status" aria-label={online ? 'Связь стабильна' : 'Нет связи'}>
          <span className={cx(styles.dot, !online && styles.dotOff)} />
          <WifiIcon className={cx(styles.wifi, !online && styles.wifiOff)} />
        </span>

        <button
          type="button"
          className={styles.gear}
          aria-label="Настройки графики"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            hapticImpact('light')
            setMenuOpen((v) => !v)
          }}
        >
          <GearIcon className={styles.gearIcon} />
        </button>

        {onAdmin && (
          <button type="button" className={styles.gear} aria-label="Панель администратора" onClick={onAdmin}>
            <CrownIcon className={styles.gearIcon} />
          </button>
        )}

        {menuOpen && (
          <div className={styles.menu} role="menu" aria-label="Графика">
            <span className={styles.menuTitle}>ГРАФИКА</span>
            {QUALITY_LABELS.map((q) => (
              <button
                key={q.id}
                type="button"
                role="menuitemradio"
                aria-checked={quality === q.id}
                className={cx(styles.menuItem, quality === q.id && styles.menuItemActive)}
                onClick={() => {
                  hapticImpact('light')
                  setQuality(q.id)
                  setMenuOpen(false)
                }}
              >
                <span>{q.label}</span>
                {quality === q.id && <span className={styles.check} aria-hidden>✓</span>}
              </button>
            ))}
          </div>
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
