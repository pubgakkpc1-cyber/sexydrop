import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatMinor } from '../../lib/money'
import { minorToStars } from '../../lib/stars'
import { useDisplayCurrencyStore } from '../../store/displayCurrency'
import { BalanceCurrencySheet } from './BalanceCurrencySheet'
import { getTelegramUser } from '../../lib/telegram'
import { useWalletStore } from '../../store/wallet'
import { AdminPanelModal } from '../admin/AdminPanelModal'
import { Button } from '../ui'
import { UserAvatar } from '../ui/UserAvatar'
import { DiamondIcon, WalletIcon, TonIcon, StarIcon } from './icons'
import styles from './Header.module.css'

export function Header() {
  const balance = useWalletStore((s) => s.balances[s.mode] ?? s.balances.demo ?? s.balances.real)
  const navigate = useNavigate()
  const [adminOpen, setAdminOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const currency = useDisplayCurrencyStore((s) => s.currency)

  const tgUser = useMemo(() => getTelegramUser(), [])
  const balanceParts = useMemo(() => {
    if (currency === 'STARS') {
      return { int: minorToStars(balance).toLocaleString('ru-RU').replace(/\u00a0/g, ' '), frac: '' }
    }
    const [int = '0', frac] = formatMinor(balance).split('.')
    return { int, frac: frac ? `.${frac}` : '' }
  }, [balance, currency])
  const balanceText = currency === 'STARS' ? `${balanceParts.int} Stars` : `${formatMinor(balance)} TON`
  const usernameClean = (tgUser?.username || '').toLowerCase().replace(/^@/, '')
  const isAdmin =
    usernameClean === 'zapixxgarant' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('sexydrop_admin') === 'true')

  return (
    <header className={styles.header}>
      <div className={styles.profile}>
        <Link
          to="/"
          className={styles.avatarLink}
          aria-label={tgUser ? `${tgUser.first_name ?? 'Игрок'} — на главную` : 'SEXY DROP — на главную'}
        >
          <span className={styles.avatarWrap}>
            <UserAvatar size={44} className={styles.avatarRing} />
            <span className={styles.avatarBadge} aria-hidden>
              <DiamondIcon className={styles.avatarBadgeIcon} />
            </span>
          </span>
        </Link>
        <button
          type="button"
          className={styles.balanceCol}
          aria-label={`Баланс: ${balanceText}`}
          aria-haspopup="dialog"
          onClick={() => setCurrencyOpen(true)}
        >
          <span className={styles.balanceLabel}>Ваш баланс <span className={styles.caret} aria-hidden>▾</span></span>
          <span className={styles.balanceValue}>
            {currency === 'STARS' ? (
              <StarIcon style={{ width: '22px', height: '22px', color: '#ffc93c', display: 'inline-block', flexShrink: 0 }} aria-hidden />
            ) : (
              <TonIcon style={{ width: '22px', height: '22px', color: '#2aa7f5', display: 'inline-block', flexShrink: 0 }} aria-hidden />
            )}
            <span>{balanceParts.int}</span>
            {balanceParts.frac && <span className={styles.balanceFrac}>{balanceParts.frac}</span>}
          </span>
        </button>
      </div>

      <div className={styles.controls}>
        {isAdmin && (
          <button
            type="button"
            className={styles.adminBadgeBtn}
            onClick={() => setAdminOpen(true)}
            aria-label="Панель администратора"
          >
            👑 Админка
          </button>
        )}
        <Button size="sm" className={styles.depositBtn} onClick={() => navigate('/deposit')}>
          <WalletIcon className={styles.depositIcon} aria-hidden />
          Пополнить
        </Button>
      </div>

      <AdminPanelModal open={adminOpen} onClose={() => setAdminOpen(false)} />
      <BalanceCurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} balanceMinor={balance} />

      <span className={styles.srOnly} aria-live="polite">
        Баланс: {balanceText}
      </span>
    </header>
  )
}
