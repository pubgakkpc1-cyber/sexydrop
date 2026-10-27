import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { formatMinor } from '../../lib/money'
import { getTelegramUser } from '../../lib/telegram'
import { useWalletStore } from '../../store/wallet'
import { Button, Modal } from '../ui'
import { UserAvatar } from '../ui/UserAvatar'
import { RefreshIcon, WalletIcon, TonIcon } from './icons'
import styles from './Header.module.css'

function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mode = useWalletStore((s) => s.mode)
  const credit = useWalletStore((s) => s.credit)
  const resetDemo = useWalletStore((s) => s.resetDemo)

  return (
    <Modal open={open} onClose={onClose} title="Пополнение">
      {mode === 'demo' ? (
        <div className={styles.depositBody}>
          <p className={styles.depositText}>
            Demo Mode: реальные платежи отключены. Демо-пополнение зачисляется только
            на демо-баланс и не является деньгами.
          </p>
          <Button
            fullWidth
            onClick={() => {
              credit(100_000, 'demo')
              onClose()
            }}
          >
            Получить 100 TON (демо)
          </Button>
          <Button
            fullWidth
            variant="ghost"
            onClick={() => {
              resetDemo()
              onClose()
            }}
          >
            <RefreshIcon className={styles.depositResetIcon} />
            Сбросить демо-баланс
          </Button>
        </div>
      ) : (
        <div className={styles.depositBody}>
          <p className={styles.depositText}>
            Пополнение реального баланса появится после подключения платежей
            (backend, раздел 7 роадмапа). Сейчас доступен только Demo Mode.
          </p>
          <Button fullWidth disabled>
            Пополнить
          </Button>
          <Button fullWidth variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      )}
    </Modal>
  )
}

export function Header() {
  const mode = useWalletStore((s) => s.mode)
  const balance = useWalletStore((s) => s.balances[s.mode])
  const setMode = useWalletStore((s) => s.setMode)
  const [depositOpen, setDepositOpen] = useState(false)
  // Косметические данные профиля Telegram; доверять им на сервере запрещено (TIER 7 валидирует initData).
  const tgUser = useMemo(() => getTelegramUser(), [])

  const modeLabel = mode === 'demo' ? 'демо' : 'реальный'

  return (
    <header className={styles.header}>
      <Link
        to="/"
        className={styles.profile}
        aria-label={tgUser ? `${tgUser.first_name ?? 'Игрок'} — на главную` : 'SEXY DROP — на главную'}
      >
        <UserAvatar size={36} />
        <span className={styles.balanceCol} aria-label={`Баланс (${modeLabel}): ${formatMinor(balance)} TON`}>
          <span className={styles.balanceLabel}>Ваш баланс</span>
          <span className={styles.balanceValue}>
            <TonIcon style={{ width: '15px', height: '15px', color: '#0098ea', display: 'inline-block', flexShrink: 0 }} aria-hidden />
            {formatMinor(balance)}
          </span>
        </span>
      </Link>

      <div className={styles.controls}>
        {mode === 'demo' && <span className={styles.demoBadge}>DEMO</span>}
        <div className={styles.modeSwitch} role="group" aria-label="Режим баланса">
          <button
            type="button"
            className={cx(styles.modeBtn, mode === 'demo' && styles.modeBtnActive)}
            onClick={() => setMode('demo')}
          >
            Демо
          </button>
          <button
            type="button"
            className={cx(styles.modeBtn, mode === 'real' && styles.modeBtnActive)}
            onClick={() => setMode('real')}
          >
            Реал
          </button>
        </div>
        <Button size="sm" className={styles.depositBtn} onClick={() => setDepositOpen(true)}>
          <WalletIcon className={styles.depositIcon} aria-hidden />
          Пополнить
        </Button>
      </div>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />

      <span className={styles.srOnly} aria-live="polite">
        Баланс ({modeLabel}): {formatMinor(balance)}
      </span>
    </header>
  )
}
