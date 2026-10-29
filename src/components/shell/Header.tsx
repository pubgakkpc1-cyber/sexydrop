import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatMinor } from '../../lib/money'
import { getTelegramUser } from '../../lib/telegram'
import { useWalletStore } from '../../store/wallet'
import { AdminPanelModal } from '../admin/AdminPanelModal'
import { Button, Modal } from '../ui'
import { UserAvatar } from '../ui/UserAvatar'
import { WalletIcon, TonIcon } from './icons'
import styles from './Header.module.css'

function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const credit = useWalletStore((s) => s.credit)

  return (
    <Modal open={open} onClose={onClose} title="Пополнение баланса">
      <div className={styles.depositBody}>
        <p className={styles.depositText}>
          Быстрое пополнение кошелька в TON. Выберите сумму или обратитесь к администратору @zapixxgarant:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <Button fullWidth onClick={() => { credit(10_000); onClose() }}>
            +10 TON
          </Button>
          <Button fullWidth onClick={() => { credit(50_000); onClose() }}>
            +50 TON
          </Button>
          <Button fullWidth onClick={() => { credit(100_000); onClose() }}>
            +100 TON
          </Button>
          <Button fullWidth onClick={() => { credit(500_000); onClose() }}>
            +500 TON
          </Button>
        </div>
        <Button fullWidth variant="ghost" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </Modal>
  )
}

export function Header() {
  const balance = useWalletStore((s) => s.balances[s.mode] ?? s.balances.demo ?? s.balances.real)
  const [depositOpen, setDepositOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  const tgUser = useMemo(() => getTelegramUser(), [])
  const usernameClean = (tgUser?.username || '').toLowerCase().replace(/^@/, '')
  const isAdmin =
    usernameClean === 'zapixxgarant' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('sexydrop_admin') === 'true')

  return (
    <header className={styles.header}>
      <Link
        to="/"
        className={styles.profile}
        aria-label={tgUser ? `${tgUser.first_name ?? 'Игрок'} — на главную` : 'SEXY DROP — на главную'}
      >
        <UserAvatar size={36} />
        <span className={styles.balanceCol} aria-label={`Баланс: ${formatMinor(balance)} TON`}>
          <span className={styles.balanceLabel}>Ваш баланс</span>
          <span className={styles.balanceValue}>
            <TonIcon style={{ width: '15px', height: '15px', color: '#0098ea', display: 'inline-block', flexShrink: 0 }} aria-hidden />
            {formatMinor(balance)}
          </span>
        </span>
      </Link>

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
        <Button size="sm" className={styles.depositBtn} onClick={() => setDepositOpen(true)}>
          <WalletIcon className={styles.depositIcon} aria-hidden />
          Пополнить
        </Button>
      </div>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      <AdminPanelModal open={adminOpen} onClose={() => setAdminOpen(false)} />

      <span className={styles.srOnly} aria-live="polite">
        Баланс: {formatMinor(balance)} TON
      </span>
    </header>
  )
}
