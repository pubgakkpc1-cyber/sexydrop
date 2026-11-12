import { useEffect, useMemo, useState } from 'react'
import { useProfileStore } from '../store/profile'
import { TrophyIcon } from '../components/shell/icons'
import { UserAvatar } from '../components/ui/UserAvatar'
import { TgAvatar } from '../components/ui/TgAvatar'
import { cx } from '../lib/cx'
import { getWebApp } from '../lib/telegram'
import styles from './RatingScreen.module.css'

/** Аватарка игрока из Telegram; если фото нет или не загрузилось — инициалы на градиенте. */
function PlayerAvatar({ name, src }: { name: string; src?: string | null }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <TgAvatar name={name} size={44} className={styles.avatar} />
  return (
    <img
      className={styles.avatar}
      src={src}
      alt=""
      width={44}
      height={44}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

/** Оборот в TON (minor → TON): максимум один знак после точки, вниз; 12 400 → «12.4K», 3 200 000 → «3.2M». */
export function formatTurnover(minor: number): string {
  const ton = minor / 1000
  if (ton >= 1_000_000) return `${(Math.floor(ton / 100_000) / 10).toFixed(1)}M`
  if (ton >= 1_000) return `${(Math.floor(ton / 100) / 10).toFixed(1)}K`
  return (Math.floor(ton * 10) / 10).toFixed(1)
}

interface Row {
  key: string
  me: boolean
  name: string
  avatar?: string | null
  turnover: number
}

interface BoardResponse {
  rows: Array<{ rank: number; name: string; avatar?: string | null; turnover_minor: number; me: boolean }>
  me: { rank: number; turnover_minor: number } | null
  total: number
}

export function RatingScreen() {
  const { rounds, wageredMinor, pvpMatches } = useProfileStore()
  const [board, setBoard] = useState<BoardResponse | null>(null)

  // Общий рейтинг всех игроков с сервера; без ответа остаётся только ваша строка
  useEffect(() => {
    let dead = false
    const initData = (getWebApp() as unknown as { initData?: string } | undefined)?.initData
    fetch('/api/leaderboard', { headers: initData ? { 'X-Telegram-Init-Data': initData } : {}, cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<BoardResponse>) : null))
      .then((b) => {
        if (!dead && b) setBoard(b)
      })
      .catch(() => undefined)
    return () => {
      dead = true
    }
  }, [])

  const noData = rounds === 0 && (board?.rows.length ?? 0) === 0
  const myTurnover = wageredMinor

  // Топ-20 с сервера: имя из Telegram (не @username) и аватарка
  const rows = useMemo<Row[]>(() => {
    // Реальные игроки с сервера; если он не ответил, показываем только себя
    if (board && board.rows.length > 0) {
      return board.rows.map((r) => ({ key: `r${r.rank}`, me: r.me, name: r.name, avatar: r.avatar, turnover: r.turnover_minor }))
    }
    return noData ? [] : [{ key: 'me', me: true, name: 'Вы', turnover: myTurnover }]
  }, [board, noData, myTurnover])

  const myIndex = rows.findIndex((r) => r.me)
  const myRankLabel = noData
    ? '999+'
    : board?.me
      ? String(board.me.rank)
      : myIndex >= 0
        ? String(myIndex + 1)
        : '10+'

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Рейтинг</h1>

      <div className={styles.listHead}>
        <span className={styles.listTitle}>
          <TrophyIcon className={styles.listTitleIcon} aria-hidden />
          Топ-20 игроков
        </span>
        <span className={styles.colLabel}>Оборот, TON</span>
      </div>

      {rows.length === 0 && (
        <p className={styles.emptyList}>Пока в рейтинге никого нет. Сделайте ставку — и вы окажетесь в таблице.</p>
      )}
      <ol className={styles.list} aria-label="Рейтинг игроков">
        {rows.map((row, idx) => {
          return (
            <li
              key={row.key}
              className={cx(
                styles.row,
                idx === 0 && styles.rowGold,
                idx === 1 && styles.rowSilver,
                idx === 2 && styles.rowBronze,
                row.me && styles.rowMe,
              )}
            >
              <span
                className={cx(
                  styles.rank,
                  idx === 0 && styles.rankGold,
                  idx === 1 && styles.rankSilver,
                  idx === 2 && styles.rankBronze,
                )}
              >
                {idx + 1}
              </span>
              {row.me && !row.avatar ? (
                <UserAvatar size={44} className={styles.avatar} />
              ) : (
                <PlayerAvatar name={row.name} src={row.avatar} />
              )}
              <span className={styles.name}>{row.name}</span>
              <span className={styles.points}>{formatTurnover(row.turnover)}</span>
            </li>
          )
        })}
      </ol>

      {!noData && (
      <div className={styles.meBar} aria-label="Ваше место">
        <span className={styles.meRank}>{myRankLabel}</span>
        <UserAvatar size={40} className={styles.avatar} />
        <span className={styles.meChip}>ВЫ</span>
        <span className={styles.points}>{formatTurnover(board?.me?.turnover_minor ?? myTurnover)}</span>
      </div>
      )}

      <p className={styles.note}>
        PVP-матчей: {pvpMatches}.
      </p>
    </div>
  )
}
