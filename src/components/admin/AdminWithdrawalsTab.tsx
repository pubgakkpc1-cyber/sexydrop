import { useCallback, useEffect, useState } from 'react'
import { giftById } from '../../data/catalog'
import { authHeaders, resetAuthToken } from '../../lib/auth'
import { adminFetch } from '../../lib/adminApi'
import { ago, dateTime, ton } from './adminFormat'
import styles from './AdminPanel.module.css'

interface Withdrawal {
  id: string
  gift_id: string
  name: string
  user: { id: number; username: string | null; name: string | null }
  created_at: string
}

interface LockedRow {
  player: { id: string; name: string; username: string | null }
  gift: string
  price: number
  at: number | null
  expires_at: number | null
  steps: {
    friends: { done: number; target: number }
    deposit: { done: number; target: number }
    games: { done: number; target: number }
  } | null
}

/** Заявки игроков на вывод подарков: выдали вручную — «Выдал», не получилось — «Вернуть» (подарок снова в инвентаре). */
export function AdminWithdrawalsTab() {
  const [rows, setRows] = useState<Withdrawal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [locked, setLocked] = useState<LockedRow[] | null>(null)

  useEffect(() => {
    void adminFetch<LockedRow[]>('/api/admin/locked-gifts').then((r) => r.ok && setLocked(Array.isArray(r.data) ? r.data : []))
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/withdrawals', { headers: await authHeaders(), cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as Withdrawal[] | { detail?: string } | null
      if (!res.ok || !Array.isArray(data)) {
        setError((data as { detail?: string } | null)?.detail ?? `Ошибка ${res.status}`)
        return
      }
      setError(null)
      setRows(data)
    } catch {
      setError('Нет связи с сервером')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = async (w: Withdrawal, action: 'done' | 'reject') => {
    setBusy(w.id)
    setDone(null)
    setError(null)
    const call = async () =>
      fetch(`/api/admin/withdrawals/${w.id}/${action}`, { method: 'POST', headers: await authHeaders() })
    try {
      let res = await call()
      if (res.status === 401 || res.status === 403) {
        // токен истёк — входим заново и повторяем один раз
        resetAuthToken()
        res = await call()
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null
        setError(`Не получилось: ${data?.detail ?? `ошибка ${res.status}`}`)
      } else {
        const gift = giftById.get(w.gift_id)?.name ?? w.name
        setRows((r) => (r ? r.filter((x) => x.id !== w.id) : r)) // карточка исчезает сразу
        setDone(action === 'done' ? `Готово: «${gift}» отмечен выданным.` : `«${gift}» вернули игроку в инвентарь.`)
      }
    } catch {
      setError('Нет связи с сервером — попробуйте ещё раз')
    } finally {
      setBusy(null)
      void load()
    }
  }

  return (
    <div className={styles.tab}>
      {error && <p className={`${styles.note} ${styles.bad} ${styles.stickyNote}`} role="alert">{error}</p>}
      {done && <p className={`${styles.note} ${styles.good}`} role="status">{done}</p>}
      {rows === null && !error && <p className={styles.muted}>Загрузка…</p>}
      {rows !== null && rows.length === 0 && (
        <div className={styles.emptyBox}>
          <span className={styles.emptyBig}>✓</span>
          <strong>Заявок нет</strong>
          <span className={styles.muted}>Все подарки выданы. Новые заявки появятся здесь.</span>
        </div>
      )}
      {rows !== null && rows.length > 0 && (
        <p className={styles.note}>
          Ждут вывода: <b>{rows.length}</b>. Порядок: сначала отправьте подарок игроку в Telegram, потом нажмите
          «Выдал».
        </p>
      )}
      {rows?.map((w) => {
        const gift = giftById.get(w.gift_id)
        const who = w.user.username ? `@${w.user.username}` : (w.user.name ?? `ID ${w.user.id}`)
        const at = Math.floor(new Date(w.created_at).getTime() / 1000)
        return (
          <div key={w.id} className={styles.wCard}>
            <div className={styles.wHead}>
              {gift?.image ? (
                <img className={styles.wImg} src={gift.image} alt="" width={56} height={56} loading="lazy" />
              ) : (
                <span className={styles.wImg} aria-hidden>🎁</span>
              )}
              <div className={styles.pMain}>
                <span className={styles.pName}>{gift?.name ?? w.name}</span>
                {gift && <span className={styles.pSub}>Цена {ton(gift.priceMinor)}</span>}
                <span className={styles.pSub}>
                  Кому: <b className={styles.wWho}>{who}</b> · {ago(at)}
                </span>
              </div>
            </div>
            <div className={styles.wActions}>
              <button
                type="button"
                className={styles.wDone}
                onClick={() => void resolve(w, 'done')}
                disabled={busy === w.id}
              >
                ✓ Выдал
              </button>
              <button
                type="button"
                className={styles.wReject}
                onClick={() => void resolve(w, 'reject')}
                disabled={busy === w.id}
              >
                ↩ Вернуть
              </button>
            </div>
          </div>
        )
      })}
      {locked && locked.length > 0 && (
        <>
          <h3 className={styles.h3}>Под замком ({locked.length}) — ещё не выполнили задание</h3>
          <p className={styles.note}>
            Сумма NFT под замком: <b>{ton(locked.reduce((a, l) => a + l.price, 0))}</b>. Они не выданы и в прибыль не входят.
          </p>
          {locked.map((l, i) => (
            <div key={i} className={styles.lockCard}>
              <div className={styles.lockHead}>
                <span className={styles.pName}>🔒 {l.gift}</span>
                <span className={styles.pSub}>{ton(l.price)}</span>
              </div>
              <span className={styles.pSub}>
                {l.player.name}
                {l.player.username ? ` · @${l.player.username}` : ''} · получил {ago(l.at)}
              </span>
              {l.steps ? (
                <span className={styles.pSub}>
                  Друзья {l.steps.friends.done}/{l.steps.friends.target} · пополнение {l.steps.deposit.done / 1000}/
                  {l.steps.deposit.target / 1000} TON · игры {l.steps.games.done}/{l.steps.games.target}
                  {l.expires_at ? ` · до ${dateTime(l.expires_at)}` : ''}
                </span>
              ) : (
                <span className={`${styles.pSub} ${styles.bad}`}>Срок задания истёк</span>
              )}
            </div>
          ))}
        </>
      )}
      <button type="button" className={styles.refresh} onClick={() => void load()}>
        ↻ Обновить список
      </button>
    </div>
  )
}
