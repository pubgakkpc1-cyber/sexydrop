import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminApi'
import { cx } from '../../lib/cx'
import { PlayerAvatar } from './AdminAvatar'
import { AdminPlayerCard } from './AdminPlayerCard'
import { ago, signedTon, ton } from './adminFormat'
import styles from './AdminPanel.module.css'

export interface PlayerRow {
  id: string
  name: string
  username: string | null
  photo: string | null
  first: number
  last: number
  balance: number
  deposited: number
  wagered: number
  delta: number
  rounds: number
}

interface PlayersResponse {
  total: number
  rows: PlayerRow[]
}

const SORTS = [
  { id: 'last', label: 'Последние' },
  { id: 'new', label: 'Новые' },
  { id: 'deposited', label: 'Пополнения' },
  { id: 'wagered', label: 'Оборот' },
  { id: 'balance', label: 'Баланс' },
] as const
type SortId = (typeof SORTS)[number]['id']

/** Игроки: поиск, сортировка, по нажатию — карточка игрока со всей статистикой. */
export function AdminPlayersTab() {
  const [data, setData] = useState<PlayersResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortId>('last')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let dead = false
    // поиск на сервере, с небольшой задержкой после ввода
    const t = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim(), sort, limit: '200' })
      void adminFetch<PlayersResponse>(`/api/admin/players?${params}`).then((r) => {
        if (dead) return
        if (r.ok) {
          setData(r.data)
          setError(null)
        } else setError(r.error)
      })
    }, 250)
    return () => {
      dead = true
      window.clearTimeout(t)
    }
  }, [query, sort])

  if (openId) return <AdminPlayerCard telegramId={openId} onBack={() => setOpenId(null)} onOpen={setOpenId} />

  return (
    <div className={styles.tab}>
      <input
        className={styles.search}
        type="search"
        placeholder="Поиск: имя, @юзернейм или ID"
        aria-label="Поиск игрока"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.chips} role="group" aria-label="Сортировка">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={cx(styles.chip, sort === s.id && styles.chipOn)}
            aria-pressed={sort === s.id}
            onClick={() => setSort(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className={`${styles.note} ${styles.bad}`}>{error}</p>}
      {!data && !error && <p className={styles.muted}>Загрузка…</p>}
      {data && (
        <p className={styles.note}>
          Найдено игроков: <b>{data.total}</b>
          {data.total > data.rows.length ? ` (показаны первые ${data.rows.length})` : ''}. Нажмите на игрока,
          чтобы открыть всю его статистику.
        </p>
      )}

      {data?.rows.map((p) => (
        <button key={p.id} type="button" className={styles.playerRow} onClick={() => setOpenId(p.id)}>
          <PlayerAvatar name={p.name} photo={p.photo} />
          <span className={styles.pMain}>
            <span className={styles.pName}>{p.name}</span>
            <span className={styles.pSub}>
              {p.username ? `@${p.username} · ` : ''}
              {ago(p.last)}
            </span>
            <span className={styles.pSub}>
              пополнил {ton(p.deposited)} · оборот {ton(p.wagered)}
            </span>
          </span>
          <span className={styles.pRight}>
            <span className={styles.pBalance}>{ton(p.balance)}</span>
            <span className={cx(styles.pSub, p.delta > 0 ? styles.good : p.delta < 0 ? styles.bad : undefined)}>
              {p.rounds > 0 ? signedTon(p.delta) : 'не играл'}
            </span>
          </span>
        </button>
      ))}
      {data && data.rows.length === 0 && <p className={styles.muted}>Никого не найдено</p>}
    </div>
  )
}
