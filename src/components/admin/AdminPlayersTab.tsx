import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminApi'
import { formatMinor } from '../../lib/money'
import styles from './AdminPanel.module.css'

interface Player {
  id: string
  name: string | null
  first: number
  last: number
  wagered: number
  delta: number
  events: number
}

function ago(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (s < 90) return 'сейчас'
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  return `${Math.floor(s / 86400)} дн назад`
}

/** Игроки, которых видит сервер: кто, когда заходил, сколько поставил и в плюсе или в минусе. */
export function AdminPlayersTab() {
  const [rows, setRows] = useState<Player[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let dead = false
    void adminFetch<Player[]>('/api/admin/players?limit=200').then((r) => {
      if (dead) return
      if (r.ok) setRows(r.data)
      else setError(r.error)
    })
    return () => {
      dead = true
    }
  }, [])

  const q = query.trim().toLowerCase().replace(/^@/, '')
  const list = (rows ?? []).filter((p) => q === '' || (p.name ?? '').toLowerCase().includes(q) || p.id.includes(q))

  return (
    <div className={styles.tab}>
      <input
        className={styles.search}
        type="search"
        placeholder="Поиск по имени или ID"
        aria-label="Поиск игрока"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p className={`${styles.note} ${styles.bad}`}>{error}</p>}
      {!rows && !error && <p className={styles.muted}>Загрузка…</p>}
      {rows && <p className={styles.note}>Показаны последние {rows.length} игроков по активности. «Итог» — выигрыш игрока минус его траты (минус = в плюсе казна).</p>}
      {list.map((p) => (
        <div key={p.id} className={styles.sysRow}>
          <span>
            <strong>{p.name ? `@${p.name.replace(/^@/, '')}` : `ID ${p.id}`}</strong>
            <br />
            <span className={styles.muted}>
              {ago(p.last)} · оборот {formatMinor(p.wagered)}
            </span>
          </span>
          <span className={p.delta >= 0 ? styles.good : styles.bad}>
            {p.delta >= 0 ? '+' : '−'}
            {formatMinor(Math.abs(p.delta))}
          </span>
        </div>
      ))}
      {rows && list.length === 0 && <p className={styles.muted}>Никого не найдено</p>}
    </div>
  )
}
