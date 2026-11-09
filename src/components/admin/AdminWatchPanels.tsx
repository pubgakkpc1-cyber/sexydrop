import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminApi'
import styles from './AdminPanel.module.css'

interface SusPlayer {
  telegram_id: number
  name: string
  username: string | null
  score: number
  flagged: boolean
  reasons: string[]
  total: number
  month_clicks: number
  last: number
}
interface ClickRow {
  telegram_id: number
  name: string
  username: string | null
  total: number
  month_clicks: number
  ref_clicks_total: number
  ref_waiting: number
  score: number
  flagged: boolean
}
interface Stars {
  count: number
  stars_total: number
  ton_equivalent_minor: number
  recent: { name: string; username: string | null; stars: number; ton_minor: number; paid_at: number }[]
}

const fmtDate = (sec: number) => (sec ? new Date(sec * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

/** Два блока для админа: подозрительные кликеры (автокликер) и покупки за Stars отдельно от TON. */
export function AdminWatchPanels() {
  const [sus, setSus] = useState<{ threshold: number; players: SusPlayer[] } | null>(null)
  const [stars, setStars] = useState<Stars | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [all, setAll] = useState<ClickRow[] | null>(null)

  useEffect(() => {
    let dead = false
    void Promise.resolve(adminFetch<{ threshold: number; players: SusPlayer[] }>('/api/admin/clicker/suspicious'))
      .then((r) => {
        if (dead || !r) return
        if (r.ok && Array.isArray(r.data?.players)) setSus(r.data)
        else if (!r.ok) setErr(r.error)
      })
      .catch(() => undefined)
    void Promise.resolve(adminFetch<{ players: ClickRow[] }>('/api/admin/clicker/players'))
      .then((r) => {
        if (!dead && r?.ok && Array.isArray(r.data?.players)) setAll(r.data.players)
      })
      .catch(() => undefined)
    void Promise.resolve(adminFetch<Stars>('/api/admin/stars-purchases'))
      .then((r) => {
        if (!dead && r?.ok && Array.isArray(r.data?.recent)) setStars(r.data)
      })
      .catch(() => undefined)
    return () => {
      dead = true
    }
  }, [])

  return (
    <>
      <h3 className={styles.h3}>Кликалка: кто сколько накликал</h3>
      {all && all.length === 0 && <p className={styles.note}>Пока никто не кликал.</p>}
      {all && all.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Игрок</th>
              <th>Всего / марафон</th>
              <th>Рефы</th>
            </tr>
          </thead>
          <tbody>
            {all.map((p) => (
              <tr key={p.telegram_id}>
                <td className={p.flagged ? styles.bad : undefined}>
                  {p.name}
                  {p.username ? ` @${p.username}` : ''}
                  {p.flagged ? ' ⚠ автокликер?' : ''}
                </td>
                <td>
                  {p.total} / {p.month_clicks}
                </td>
                <td>
                  +{p.ref_clicks_total}
                  {p.ref_waiting ? ` (ждут ${p.ref_waiting})` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className={styles.h3}>Кликалка: подозрение на автокликер</h3>
      {err && <p className={`${styles.note} ${styles.bad}`}>{err}</p>}
      {sus && sus.players.length === 0 && <p className={styles.note}>Подозрительных пока нет.</p>}
      {sus && sus.players.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Игрок</th>
              <th>Звоночки</th>
              <th>Кликов</th>
            </tr>
          </thead>
          <tbody>
            {sus.players.map((p) => (
              <tr key={p.telegram_id}>
                <td>
                  {p.name}
                  {p.username ? ` @${p.username}` : ''}
                  <br />
                  <span className={styles.muted}>{p.reasons.join('; ') || 'мало данных'}</span>
                </td>
                <td className={p.flagged ? styles.bad : styles.muted}>
                  {p.score}/{sus.threshold}
                  {p.flagged ? ' ⚠' : ''}
                </td>
                <td>{p.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className={styles.h3}>Покупки за Stars</h3>
      {stars && (
        <p className={styles.note}>
          Всего {stars.count} покупок на {stars.stars_total} ★ (отдельно от пополнений в TON).
        </p>
      )}
      {stars && stars.recent.length === 0 && <p className={styles.note}>Покупок за Stars ещё не было.</p>}
      {stars && stars.recent.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Кто</th>
              <th>Stars</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {stars.recent.map((r, i) => (
              <tr key={`${r.paid_at}-${i}`}>
                <td>
                  {r.name}
                  {r.username ? ` @${r.username}` : ''}
                </td>
                <td>{r.stars} ★</td>
                <td>{fmtDate(r.paid_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
