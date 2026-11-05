import { useEffect, useState } from 'react'
import { loadDepositConfig, type DepositConfig } from '../../lib/deposits'
import { adminFetch } from '../../lib/adminApi'
import { formatMinor } from '../../lib/money'
import styles from './AdminPanel.module.css'

interface BotStatus {
  token: boolean
  bot?: string | null
  webhook?: string | null
  pending?: number
  last_error?: string | null
  admin_in_chats?: Record<string, string>
  error?: string
}

function Row({ label, ok, value }: { label: string; ok: boolean | null; value?: string }) {
  return (
    <div className={styles.sysRow}>
      <span>{label}</span>
      <span className={ok === null ? styles.muted : ok ? styles.good : styles.bad}>
        {value ?? (ok ? 'работает' : 'не настроено')}
      </span>
    </div>
  )
}

/** Состояние сервера: бот и вебхук, способы пополнения, каналы, где бот админ. */
export function AdminSystemTab() {
  const [bot, setBot] = useState<BotStatus | null>(null)
  const [cfg, setCfg] = useState<DepositConfig | null | undefined>(undefined)

  useEffect(() => {
    let dead = false
    fetch('/api/telegram/status', { cache: 'no-store' })
      .then((r) => r.json() as Promise<BotStatus>)
      .then((b) => !dead && setBot(b))
      .catch(() => !dead && setBot({ token: false, error: 'нет ответа' }))
    void loadDepositConfig().then((c) => !dead && setCfg(c))
    return () => {
      dead = true
    }
  }, [])

  const chats = Object.entries(bot?.admin_in_chats ?? {})

  return (
    <div className={styles.tab}>
      <h3 className={styles.h3}>Бот</h3>
      <Row label="Токен на сервере" ok={bot ? bot.token : null} value={bot ? undefined : '…'} />
      <Row label="Имя бота" ok={bot?.bot ? true : bot ? false : null} value={bot?.bot ? `@${bot.bot}` : '—'} />
      <Row label="Вебхук" ok={bot ? Boolean(bot.webhook) : null} value={bot?.webhook ? 'установлен' : bot ? 'не установлен' : '…'} />
      <Row label="Необработано" ok={bot ? (bot.pending ?? 0) === 0 : null} value={String(bot?.pending ?? '—')} />
      {bot?.last_error && <p className={`${styles.note} ${styles.bad}`}>Последняя ошибка: {bot.last_error}</p>}

      <h3 className={styles.h3}>Пополнения</h3>
      <Row label="TON-кошельки (TON Connect)" ok={cfg === undefined ? null : Boolean(cfg?.ton_address)} />
      <Row label="@CryptoBot" ok={cfg === undefined ? null : Boolean(cfg?.cryptobot)} />
      <Row label="Telegram Stars" ok={cfg === undefined ? null : Boolean(cfg?.stars)} />

      <h3 className={styles.h3}>Каналы, где бот — админ</h3>
      {chats.length === 0 && (
        <p className={styles.note}>
          Пока ни одного. Сделайте бота администратором обоих каналов, иначе подписки на них
          проверить нельзя. Закрытый канал появится здесь после этого.
        </p>
      )}
      {chats.map(([id, title]) => (
        <Row key={id} label={title} ok value={id} />
      ))}

      <ResetBalances />
    </div>
  )
}

/** Обнуление TON-балансов всех игроков, кроме админа. Требует ввести «ОБНУЛИТЬ». */
function ResetBalances() {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const ready = confirm.trim().toUpperCase() === 'ОБНУЛИТЬ'

  const run = async () => {
    if (!ready || busy) return
    setBusy(true)
    setResult(null)
    const r = await adminFetch<{ users: number; total_minor: number }>('/api/admin/reset-balances', {
      method: 'POST',
      body: { confirm: confirm.trim() },
    })
    setBusy(false)
    if (r.ok) {
      setResult(`Готово: обнулено ${r.data.users} игроков, списано ${formatMinor(r.data.total_minor)} TON`)
      setConfirm('')
    } else {
      setResult(r.error)
    }
  }

  return (
    <>
      <h3 className={styles.h3}>Обнулить балансы</h3>
      <p className={styles.note}>
        Спишет весь TON-баланс у всех игроков, кроме админа. Отменить нельзя. Звёзды и подарки не
        трогаются. Чтобы включить кнопку, введите слово ОБНУЛИТЬ.
      </p>
      <input
        className={styles.search}
        aria-label="Подтверждение обнуления"
        placeholder="ОБНУЛИТЬ"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <div className={styles.actions}>
        <button type="button" className={`${styles.refresh} ${styles.danger}`} disabled={!ready || busy} onClick={() => void run()}>
          {busy ? 'Обнуляем…' : 'Обнулить балансы всем, кроме админа'}
        </button>
      </div>
      {result && <p className={styles.note}>{result}</p>}
    </>
  )
}
