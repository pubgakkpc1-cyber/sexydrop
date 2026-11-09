import { useEffect, useState } from 'react'
import { loadDepositConfig, type DepositConfig } from '../../lib/deposits'
import { adminFetch } from '../../lib/adminApi'
import { safeAmount } from './adminFormat'
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

      <PrizeBankPanel />
      <MaintenanceSwitch />
      <ResetProfit />
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
      setResult(`Готово: обнулено ${r.data.users} игроков, списано ${safeAmount(r.data.total_minor)} TON`)
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

/** Обнулить прибыль в админке: игры, кейсы и прибыль казино считаются заново с этого момента. */
function ResetProfit() {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const ready = confirm.trim().toUpperCase() === 'СБРОС'

  const run = async () => {
    if (!ready || busy) return
    setBusy(true)
    setResult(null)
    const r = await adminFetch<{ profit_since: number }>('/api/admin/reset-profit', {
      method: 'POST',
      body: { confirm: confirm.trim() },
    })
    setBusy(false)
    if (r.ok) {
      setResult(`Готово: прибыль считается с ${new Date(r.data.profit_since * 1000).toLocaleString('ru-RU')}`)
      setConfirm('')
    } else {
      setResult(r.error)
    }
  }

  return (
    <>
      <h3 className={styles.h3}>Сбросить прибыль к нулю</h3>
      <p className={styles.note}>
        «Обзор» начнёт считать прибыль казино, игры и кейсы заново с этой минуты. Деньги игроков,
        балансы и история не меняются. Чтобы включить кнопку, введите слово СБРОС.
      </p>
      <input
        className={styles.search}
        aria-label="Подтверждение сброса прибыли"
        placeholder="СБРОС"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <div className={styles.actions}>
        <button type="button" className={`${styles.refresh} ${styles.danger}`} disabled={!ready || busy} onClick={() => void run()}>
          {busy ? 'Сбрасываем…' : 'Сбросить прибыль'}
        </button>
      </div>
      {result && <p className={styles.note}>{result}</p>}
    </>
  )
}


/** Технические работы: включить — у всех игроков вместо приложения экран «1–2 дня», бот отвечает тем же. Админ проходит внутрь. */
function MaintenanceSwitch() {
  const [on, setOn] = useState<boolean | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void adminFetch<{ on: boolean }>('/api/maintenance').then((r) => (r.ok ? setOn(r.data.on) : setErr(r.error)))
  }, [])

  const toggle = async (next: boolean) => {
    setBusy(true)
    setErr(null)
    const r = await adminFetch<{ on: boolean }>('/api/admin/maintenance', { method: 'POST', body: { on: next } })
    setBusy(false)
    setConfirm(false)
    if (r.ok) setOn(r.data.on)
    else setErr(r.error)
  }

  return (
    <>
      <h3 className={styles.h3}>Технические работы</h3>
      <p className={styles.note}>
        Сейчас: <b>{on === null ? '…' : on ? 'ВКЛЮЧЕНЫ — игроки видят экран работ' : 'выключены — всё работает'}</b>. Включение закрывает приложение
        для всех, кроме админа, и бот на /start отвечает, что работы идут 1–2 дня. Готовый текст для канала есть в рассылке («Технические работы»).
      </p>
      {err && <p className={`${styles.note} ${styles.bad}`}>{err}</p>}
      {on === false && !confirm && (
        <button type="button" className={`${styles.refresh} ${styles.danger}`} onClick={() => setConfirm(true)}>
          Включить технические работы
        </button>
      )}
      {on === false && confirm && (
        <>
          <button type="button" className={`${styles.refresh} ${styles.danger}`} disabled={busy} onClick={() => void toggle(true)}>
            Точно включить: бот перестанет работать
          </button>
          <button type="button" className={styles.refresh} onClick={() => setConfirm(false)}>
            Отмена
          </button>
        </>
      )}
      {on === true && (
        <button type="button" className={styles.refresh} disabled={busy} onClick={() => void toggle(false)}>
          Выключить — вернуть бота в работу
        </button>
      )}
    </>
  )
}


/** Банк призов: админ ставит число вручную, сервер считает его настоящим (приз дороже банка не выпадает). */
function PrizeBankPanel() {
  const [minor, setMinor] = useState<number | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void adminFetch<{ minor: number }>('/api/admin/prize-bank').then((r) => (r.ok ? setMinor(r.data.minor) : setMsg(r.error)))
  }, [])

  const save = async () => {
    const ton = Number(value.replace(',', '.'))
    if (!Number.isFinite(ton) || ton < 0) return setMsg('Введите число TON, например 10 или 0')
    setBusy(true)
    setMsg(null)
    const r = await adminFetch<{ minor: number }>('/api/admin/prize-bank', { method: 'POST', body: { ton } })
    setBusy(false)
    if (r.ok) {
      setMinor(r.data.minor)
      setValue('')
      setMsg('Банк призов обновлён')
    } else {
      setMsg(r.error)
    }
  }

  return (
    <>
      <h3 className={styles.h3}>Банк призов</h3>
      <p className={styles.note}>
        Сейчас в банке: <b>{minor === null ? '…' : `${safeAmount(minor)} TON`}</b>. Подарок или выигрыш дороже банка выпасть не может; когда банк пуст, в кейсах
        падают два самых дешёвых приза. Стоимость выпавшего приза списывается из банка сразу. Ракета и Мины не платят сверх ставки больше, чем есть в банке.
      </p>
      <input
        className={styles.search}
        inputMode="decimal"
        aria-label="Банк призов, TON"
        placeholder="Новое значение, TON (0 — пустой банк)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="button" className={styles.refresh} disabled={busy || value.trim() === ''} onClick={() => void save()}>
        Поставить банк
      </button>
      {msg && <p className={styles.note}>{msg}</p>}
    </>
  )
}
