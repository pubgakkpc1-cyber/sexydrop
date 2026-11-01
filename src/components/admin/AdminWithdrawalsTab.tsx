import { useCallback, useEffect, useState } from 'react'
import { giftById } from '../../data/catalog'
import { authHeaders } from '../../lib/auth'
import { Button } from '../ui'
import styles from './AdminPanelModal.module.css'

interface Withdrawal {
  id: string
  gift_id: string
  name: string
  user: { id: number; username: string | null; name: string | null }
  created_at: string
}

/** Заявки игроков на вывод подарков: выдали вручную — «Выдано», не получилось — «Вернуть» (подарок снова в инвентаре). */
export function AdminWithdrawalsTab() {
  const [rows, setRows] = useState<Withdrawal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

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

  const resolve = async (id: string, action: 'done' | 'reject') => {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/${action}`, { method: 'POST', headers: await authHeaders() })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null
        setError(data?.detail ?? `Ошибка ${res.status}`)
      }
    } finally {
      setBusy(null)
      void load()
    }
  }

  return (
    <div className={styles.body}>
      {error && <div className={`${styles.statusMessage} ${styles.error}`}>{error}</div>}
      {rows === null && !error && <p>Загрузка…</p>}
      {rows !== null && rows.length === 0 && <p>Заявок на вывод нет.</p>}
      {rows?.map((w) => {
        const gift = giftById.get(w.gift_id)
        const who = w.user.username ? `@${w.user.username}` : (w.user.name ?? `id ${w.user.id}`)
        return (
          <div key={w.id} className={styles.statusMessage}>
            <strong>{gift?.name ?? w.name}</strong> — {who}
            <br />
            <small>{new Date(w.created_at).toLocaleString('ru-RU')}</small>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button onClick={() => void resolve(w.id, 'done')} disabled={busy === w.id}>
                Выдано
              </Button>
              <Button variant="secondary" onClick={() => void resolve(w.id, 'reject')} disabled={busy === w.id}>
                Вернуть
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
