import { useCallback, useEffect, useState } from 'react'
import { giftById } from '../../data/catalog'
import { authHeaders } from '../../lib/auth'
import { ago, ton } from './adminFormat'
import styles from './AdminPanel.module.css'

interface Withdrawal {
  id: string
  gift_id: string
  name: string
  user: { id: number; username: string | null; name: string | null }
  created_at: string
}

/** Заявки игроков на вывод подарков: выдали вручную — «Выдал», не получилось — «Вернуть» (подарок снова в инвентаре). */
export function AdminWithdrawalsTab() {
  const [rows, setRows] = useState<Withdrawal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

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
    try {
      const res = await fetch(`/api/admin/withdrawals/${w.id}/${action}`, { method: 'POST', headers: await authHeaders() })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null
        setError(data?.detail ?? `Ошибка ${res.status}`)
      } else {
        const gift = giftById.get(w.gift_id)?.name ?? w.name
        setDone(action === 'done' ? `Готово: «${gift}» отмечен выданным.` : `«${gift}» вернули игроку в инвентарь.`)
      }
    } finally {
      setBusy(null)
      void load()
    }
  }

  return (
    <div className={styles.tab}>
      {error && <p className={`${styles.note} ${styles.bad}`}>{error}</p>}
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
      <button type="button" className={styles.refresh} onClick={() => void load()}>
        ↻ Обновить список
      </button>
    </div>
  )
}
