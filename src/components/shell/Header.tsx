import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatBalanceTon } from '../../lib/balanceFormat'
import { useStarsBalanceStore } from '../../store/starsBalance'
import { useDisplayCurrencyStore } from '../../store/displayCurrency'
import { BalanceCurrencySheet } from './BalanceCurrencySheet'
import { GraphicsMenu } from './GraphicsMenu'
import { getTelegramUser } from '../../lib/telegram'
import { useWalletStore } from '../../store/wallet'
import { AdminPanelModal } from '../admin/AdminPanelModal'
import { Button } from '../ui'
import { UserAvatar } from '../ui/UserAvatar'
import { DiamondIcon, WalletIcon, TonIcon, StarIcon } from './icons'
import styles from './Header.module.css'
import { isAdminUsername } from '../../lib/admins'

export function Header() {
  const balance = useWalletStore((s) => s.balances[s.mode] ?? s.balances.demo ?? s.balances.real)
  const navigate = useNavigate()
  const [adminOpen, setAdminOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const currency = useDisplayCurrencyStore((s) => s.currency)
  const earnedStars = useStarsBalanceStore((s) => s.stars)

  const tgUser = useMemo(() => getTelegramUser(), [])
  const balanceParts = useMemo(() => {
    if (currency === 'STARS') {
      // \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0437\u0432\u0451\u0437\u0434\u043d\u044b\u0439 \u0431\u0430\u043b\u0430\u043d\u0441 (\u0437\u0430\u0440\u0430\u0431\u043e\u0442\u0430\u043d\u043d\u044b\u0435 \u0437\u0432\u0451\u0437\u0434\u044b), \u043d\u0435 TON \u0432 \u043f\u0435\u0440\u0435\u0441\u0447\u0451\u0442\u0435
      return { int: earnedStars.toLocaleString('ru-RU').replace(/\u00a0/g, ' '), frac: '' }
    }
    // Больше 0.1 TON — одна цифра после точки (вниз); меньше — как есть (например 0.023)
    const shown = formatBalanceTon(balance)
    const [int = '0', frac] = shown.split('.')
    return { int, frac: frac ? `.${frac}` : '' }
  }, [balance, currency, earnedStars])
  const balanceText = currency === 'STARS' ? `${balanceParts.int} Stars` : `${balanceParts.int}${balanceParts.frac} TON`
  const usernameClean = (tgUser?.username || '').toLowerCase().replace(/^@/, '')
  const isAdmin =
    isAdminUsername(usernameClean) ||
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
            👑<span className={styles.adminLabel}> Админка</span>
          </button>
        )}
        <GraphicsMenu align="right" />
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
