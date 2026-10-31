import { useEffect, useState } from 'react'
import { getWebApp } from '../../lib/telegram'
import { formatMinor } from '../../lib/money'
import styles from './AdminPanel.module.css'

interface GameRow {
  game: string
  rounds: number
  wagered: number
  delta: number
  wins: number
}
interface CaseRow {
  case: string
  opens: number
  spent: number
  prize: number
}
interface DepositRow {
  method: string
  count: number
  amount: number
}
interface TopRow {
  id: string
  name?: string
  wagered: number
  delta: number
  events: number
}
interface SeriesRow {
  day: string
  events: number
  users: number
  new: number
}
interface Stats {
  since: number
  users_total: number
  users_24h: number
  users_new_24h: number
  wagered: number
  house_profit: number
  games: GameRow[]
  cases: CaseRow[]
  deposits: DepositRow[]
  series: SeriesRow[]
  top: TopRow[]
}

const METHOD_LABEL: Record<string, string> = { ton: 'TON-кошелёк', crypto: 'CryptoBot', stars: 'Stars', demo: 'Демо' }

function Card({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</strong>
    </div>
  )
}

const ton = (minor: number) => `${formatMinor(minor)} TON`

/** Сводка по всем игрокам: пользователи, обороты, прибыль, игры, кейсы, пополнения, динамика. */
export function AdminStatsTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let dead = false
    const initData = (getWebApp() as unknown as { initData?: string } | undefined)?.initData
    if (!initData) {
      setError('Статистика доступна только при запуске из Telegram.')
      return
    }
    fetch('/api/admin/stats', { headers: { 'X-Telegram-Init-Data': initData }, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Доступ запрещён' : 'Сервер недоступен')
        return (await res.json()) as Stats
      })
      .then((s) => {
        if (!dead) {
          setStats(s)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!dead) setError(e.message)
      })
    return () => {
      dead = true
    }
  }, [tick])

  if (error) return <p className={`${styles.note} ${styles.bad}`}>{error}</p>
  if (!stats) return <p className={styles.note}>Загружаем…</p>

  const maxEvents = Math.max(1, ...stats.series.map((s) => s.events))
  const since = new Date(stats.since * 1000).toLocaleString('ru-RU')

  return (
    <div className={styles.tab}>
      <div className={styles.statGrid}>
        <Card label="Игроков всего" value={String(stats.users_total)} />
        <Card label="Онлайн за 24 ч" value={String(stats.users_24h)} />
        <Card label="Новых за 24 ч" value={String(stats.users_new_24h)} />
        <Card label="Оборот" value={ton(stats.wagered)} />
        <Card
          label="Прибыль казино"
          value={`${stats.house_profit >= 0 ? '+' : '−'}${ton(Math.abs(stats.house_profit))}`}
          tone={stats.house_profit >= 0 ? 'good' : 'bad'}
        />
      </div>

      <h3 className={styles.h3}>Активность за 14 дней</h3>
      <div className={styles.bars} aria-label="Активность по дням">
        {stats.series.length === 0 && <span className={styles.muted}>Данных пока нет</span>}
        {stats.series.map((s) => (
          <div key={s.day} className={styles.barCol} title={`${s.day}: ${s.users} игроков, ${s.events} событий`}>
            <span className={styles.bar} style={{ height: `${Math.max(6, (s.events / maxEvents) * 100)}%` }} />
            <span className={styles.barLabel}>{s.day.slice(8)}</span>
          </div>
        ))}
      </div>

      <h3 className={styles.h3}>Игры</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Игра</th>
            <th>Раунды</th>
            <th>Оборот</th>
            <th>Игроки +</th>
          </tr>
        </thead>
        <tbody>
          {stats.games.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.muted}>Раундов ещё не было</td>
            </tr>
          )}
          {stats.games.map((g) => (
            <tr key={g.game}>
              <td>{g.game}</td>
              <td>{g.rounds}</td>
              <td>{formatMinor(g.wagered)}</td>
              <td className={g.delta >= 0 ? styles.bad : styles.good}>{formatMinor(g.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.h3}>Кейсы</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Кейс</th>
            <th>Открытий</th>
            <th>Потрачено</th>
            <th>Выдано</th>
          </tr>
        </thead>
        <tbody>
          {stats.cases.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.muted}>Открытий ещё не было</td>
            </tr>
          )}
          {stats.cases.map((c) => (
            <tr key={c.case}>
              <td>{c.case}</td>
              <td>{c.opens}</td>
              <td>{formatMinor(c.spent)}</td>
              <td>{formatMinor(c.prize)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.h3}>Пополнения</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Способ</th>
            <th>Платежей</th>
            <th>Сумма, TON</th>
          </tr>
        </thead>
        <tbody>
          {stats.deposits.length === 0 && (
            <tr>
              <td colSpan={3} className={styles.muted}>Пополнений ещё не было</td>
            </tr>
          )}
          {stats.deposits.map((d) => (
            <tr key={d.method}>
              <td>{METHOD_LABEL[d.method] ?? d.method}</td>
              <td>{d.count}</td>
              <td>{formatMinor(d.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.h3}>Топ игроков по обороту</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Игрок</th>
            <th>Оборот</th>
            <th>Итог</th>
          </tr>
        </thead>
        <tbody>
          {stats.top.length === 0 && (
            <tr>
              <td colSpan={3} className={styles.muted}>Пока пусто</td>
            </tr>
          )}
          {stats.top.map((u) => (
            <tr key={u.id}>
              <td>{u.name ? `@${u.name}` : u.id}</td>
              <td>{formatMinor(u.wagered)}</td>
              <td className={u.delta >= 0 ? styles.good : styles.bad}>{formatMinor(u.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={styles.note}>
        Статистика копится с {since} и сбрасывается при перезапуске сервера, если нет постоянного
        тома. «Игроки +» — чистый выигрыш игроков (минус — выигрывает казино).
      </p>
      <button type="button" className={styles.refresh} onClick={() => setTick((t) => t + 1)}>
        Обновить
      </button>
    </div>
  )
}
