import { useEffect, useState } from 'react'
import { getWebApp } from '../../lib/telegram'
import { safeAmount, signedTon, ton } from './adminFormat'
import { AdminWatchPanels } from './AdminWatchPanels'
import { AreaChart, DonutChart, HBars, type ChartPoint } from './AdminCharts'
import styles from './AdminPanel.module.css'
import { cx } from '../../lib/cx'

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
  wagered?: number
  deposited?: number
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
  users_7d: number
  users_30d: number
  users_new_7d: number
  users_premium: number
  users_played: number
  users_paid: number
  users_referred: number
  deposited_total: number
  deposited_24h: number
  balances_total: number
  stars_total: number
  withdrawals_pending: number
  withdrawals_done: number
  profit_since?: number | null
  locked_gifts?: number
  ref_banks_total?: number
  ref_friends_credited?: number
  ref_stars_earned?: number
  locked_value?: number
}

const GAME_LABEL: Record<string, string> = { crash: 'Ракета', mines: 'Мины', upgrade: 'Апгрейд', case: 'Кейсы' }
const METHOD_LABEL: Record<string, string> = { ton: 'TON-кошелёк', crypto: 'CryptoBot', stars: 'Telegram Stars', demo: 'Демо' }
const METHOD_COLOR: Record<string, string> = { ton: '#4a8fd6', crypto: '#43ab6e', stars: '#e0a830', demo: '#8791a8' }

type Tab = 'overview' | 'money' | 'deposits' | 'games'
const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'money', label: 'Деньги' },
  { id: 'deposits', label: 'Пополнения' },
  { id: 'games', label: 'Игры' },
]

function Card({ label, value, tone, hint }: { label: string; value: string; tone?: 'good' | 'bad'; hint?: string }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</strong>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  )
}

const tonShort = (minor: number) => {
  const v = minor / 1000
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(v < 10 ? 1 : 0)
}

const dayLabel = (day: string) => `${day.slice(8)}.${day.slice(5, 7)}`

/** Сводка по игрокам, деньгам, пополнениям и играм: вкладки, графики, детали выбранной категории. */
export function AdminStatsTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')

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

  const series = stats.series ?? []
  const deposits = stats.deposits ?? []
  const depStarsMinor = deposits.filter((d) => d.method === 'stars').reduce((a, d) => a + d.amount, 0)
  const depTon = (stats.deposited_total ?? 0) - depStarsMinor
  const depStars = Math.round(depStarsMinor / 10)
  const toPoints = (pick: (s: SeriesRow) => number): ChartPoint[] => series.map((s) => ({ label: dayLabel(s.day), value: pick(s) }))
  const totalPayments = deposits.reduce((a, d) => a + d.count, 0)

  return (
    <div className={styles.tab}>
      <div className={styles.segment} role="tablist" aria-label="Категории статистики">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx(styles.segBtn, tab === t.id && styles.segBtnOn)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <button type="button" className={styles.segRefresh} aria-label="Обновить" onClick={() => setTick((n) => n + 1)}>
          ↻
        </button>
      </div>

      {tab === 'overview' && (
        <>
          <div className={styles.statGrid}>
            <Card label="Всего в боте" value={String(stats.users_total)} hint="все, кто открывал приложение" />
            <Card label="Заходили за сутки" value={String(stats.users_24h)} hint="были в приложении за 24 часа" />
            <Card label="Новых: сутки / неделя" value={`${stats.users_new_24h} / ${stats.users_new_7d ?? 0}`} hint="впервые открыли приложение" />
            <Card label="Заходили: неделя / месяц" value={`${stats.users_7d ?? 0} / ${stats.users_30d ?? 0}`} hint="активные за 7 и 30 дней" />
            <Card label="Играли хоть раз" value={String(stats.users_played ?? 0)} />
            <Card label="Пополняли баланс" value={String(stats.users_paid ?? 0)} />
            <Card label="Пришли по рефке" value={String(stats.users_referred ?? 0)} />
            <Card label="С Telegram Premium" value={String(stats.users_premium ?? 0)} />
          </div>
          <h3 className={styles.h3}>Игроки по дням</h3>
          <AreaChart points={toPoints((s) => s.users)} color="#4a8fd6" />
          <h3 className={styles.h3}>Новые игроки по дням</h3>
          <AreaChart points={toPoints((s) => s.new)} color="#43ab6e" />
          <AdminWatchPanels />
        </>
      )}

      {tab === 'money' && (
        <>
          <div className={styles.statGrid}>
            <Card label="Оборот ставок" value={ton(stats.wagered)} hint="сколько всего поставили" />
            <Card
              label="Прибыль казино"
              value={signedTon(stats.house_profit)}
              tone={stats.house_profit >= 0 ? 'good' : 'bad'}
              hint={stats.profit_since ? `с ${new Date(stats.profit_since * 1000).toLocaleDateString('ru-RU')}` : 'за всё время'}
            />
            <Card label="Лежит у игроков" value={ton(stats.balances_total ?? 0)} hint="TON на балансах" />
            <Card label="Звёзд у игроков" value={`${stats.stars_total ?? 0} ★`} />
            <Card label="Выводов ждут" value={String(stats.withdrawals_pending ?? 0)} tone={(stats.withdrawals_pending ?? 0) > 0 ? 'bad' : undefined} hint={`выдано ${stats.withdrawals_done ?? 0}`} />
            <Card label="NFT под замком" value={`${stats.locked_gifts ?? 0}`} hint={ton(stats.locked_value ?? 0)} />
          </div>
          <h3 className={styles.h3}>Оборот по дням, TON</h3>
          <AreaChart points={toPoints((s) => (s.wagered ?? 0) / 1000)} color="#c35c61" format={(v) => v.toFixed(v < 10 ? 1 : 0)} />
          <h3 className={styles.h3}>Пополнения по дням, TON</h3>
          <AreaChart points={toPoints((s) => (s.deposited ?? 0) / 1000)} color="#e0a830" format={(v) => v.toFixed(v < 10 ? 1 : 0)} />
        </>
      )}

      {tab === 'deposits' && (
        <>
          <div className={styles.statGrid}>
            <Card label="Пополнено всего" value={ton(stats.deposited_total ?? 0)} hint="TON и Stars вместе" />
            <Card label="За сутки" value={ton(stats.deposited_24h ?? 0)} hint="последние 24 часа" />
            <Card label="В TON" value={ton(depTon)} hint="кошелёк и CryptoBot" />
            <Card label="За Stars" value={`${depStars} ★`} hint={ton(depStarsMinor)} />
            <Card label="Платежей" value={String(totalPayments)} />
            <Card label="Платящих игроков" value={String(stats.users_paid ?? 0)} />
          </div>
          <h3 className={styles.h3}>Как пополняют</h3>
          <DonutChart
            slices={deposits.filter((d) => d.amount > 0).map((d) => ({ label: METHOD_LABEL[d.method] ?? d.method, value: d.amount, color: METHOD_COLOR[d.method] ?? '#8791a8', sub: `${d.count} платежей` }))}
            center={tonShort(stats.deposited_total ?? 0)}
            centerNote="TON всего"
            format={(v) => `${tonShort(v)} TON`}
          />
          <h3 className={styles.h3}>По дням, TON</h3>
          <AreaChart points={toPoints((s) => (s.deposited ?? 0) / 1000)} color="#e0a830" format={(v) => v.toFixed(v < 10 ? 1 : 0)} />
        </>
      )}

      {tab === 'games' && (
        <>
          <h3 className={styles.h3}>Оборот по играм</h3>
          <HBars
            rows={(stats.games ?? []).map((g) => ({ label: GAME_LABEL[g.game] ?? g.game, value: g.wagered, note: `${g.rounds} раундов · итог игроков ${signedTon(g.delta)}` }))}
            format={(v) => `${tonShort(v)} TON`}
          />
          <h3 className={styles.h3}>Кейсы: потрачено и выдано</h3>
          <HBars
            rows={(stats.cases ?? []).flatMap((c) => [
              { label: `${c.case} · потрачено`, value: c.spent, color: '#c35c61', note: `${c.opens} открытий` },
              { label: `${c.case} · выдано`, value: c.prize, color: '#43ab6e' },
            ])}
            format={(v) => `${tonShort(v)} TON`}
          />
          <h3 className={styles.h3}>Топ по обороту</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Игрок</th>
                  <th>Оборот</th>
                  <th>Итог</th>
                </tr>
              </thead>
              <tbody>
                {(stats.top ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className={styles.muted}>Пока пусто</td>
                  </tr>
                )}
                {(stats.top ?? []).map((u) => (
                  <tr key={u.id}>
                    <td>{u.name ? `@${u.name}` : u.id}</td>
                    <td>{safeAmount(u.wagered)}</td>
                    <td className={u.delta >= 0 ? styles.good : styles.bad}>{signedTon(u.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
