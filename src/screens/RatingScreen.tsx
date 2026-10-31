import { useEffect, useMemo, useState } from 'react'
import { useProfileStore } from '../store/profile'
import { giftById } from '../data/catalog'
import { ClockIcon, TrophyIcon, UsersIcon } from '../components/shell/icons'
import { UserAvatar } from '../components/ui/UserAvatar'
import { cx } from '../lib/cx'
import { FEATURES } from '../lib/features'
import styles from './RatingScreen.module.css'

interface LeaderboardBot {
  id: string
  name: string
  avatar: string
  /** Очки = оборот в TON × 100 */
  points: number
}

/** Призы топ-10: реальные NFT из каталога, по местам. */
const PRIZE_IDS = [
  'plush_pepe-1',
  'heart_locket-1',
  'resistance_dog-1',
  'durovs_cap-1',
  'scared_cat-1',
  'precious_peach-1',
  'heroic_helmet-1',
  'loot_bag-1',
  'mighty_arm-1',
  'astral_shard-1',
] as const

const TOP_BOTS: readonly LeaderboardBot[] = [
  { id: 'b1', name: 'kamronbek', avatar: '/avatars/bot_03.svg', points: 84_000 },
  { id: 'b2', name: 'cryptowhale', avatar: '/avatars/bot_17.svg', points: 62_000 },
  { id: 'b3', name: 'Saullmurder', avatar: '/avatars/bot_08.svg', points: 49_000 },
  { id: 'b4', name: 'abdoo', avatar: '/avatars/bot_22.svg', points: 41_000 },
  { id: 'b5', name: 'DIYORBEK', avatar: '/avatars/bot_30.svg', points: 35_000 },
  { id: 'b6', name: 'Module_II', avatar: '/avatars/bot_11.svg', points: 29_000 },
  { id: 'b7', name: 'moon_rider', avatar: '/avatars/bot_26.svg', points: 24_000 },
  { id: 'b8', name: 'Al_Sheikh', avatar: '/avatars/bot_35.svg', points: 21_000 },
  { id: 'b9', name: 'Pavel_D', avatar: '/avatars/bot_14.svg', points: 18_000 },
  { id: 'b10', name: 'Artem_TON', avatar: '/avatars/bot_41.svg', points: 14_000 },
]

/** «kamronbek» → «ka***ek» */
export function maskName(name: string): string {
  if (name.length <= 4) return `${name[0] ?? ''}***`
  return `${name.slice(0, 2)}***${name.slice(-2)}`
}

/** 29600000 → «29.6M», 84000 → «84.0K»: максимум один знак после точки. */
export function formatPoints(points: number): string {
  if (points >= 1_000_000) return `${(Math.floor(points / 100_000) / 10).toFixed(1)}M`
  if (points >= 1_000) return `${(Math.floor(points / 100) / 10).toFixed(1)}K`
  return String(Math.floor(points))
}

/** Недельный сезон: заканчивается в ближайший понедельник 00:00 UTC. */
function msUntilSeasonEnd(now: number): number {
  const d = new Date(now)
  const daysToMonday = ((8 - d.getUTCDay()) % 7) || 7
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToMonday)
  return end - now
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${d}d ${h}h ${m}m ${s}s`
}

interface Row {
  key: string
  me: boolean
  name: string
  avatar?: string
  points: number
}

export function RatingScreen() {
  const { rounds, wageredMinor, pvpMatches } = useProfileStore()
  const noData = rounds === 0
  const myPoints = Math.floor(wageredMinor / 10) // 1 TON оборота = 100 очков

  const [left, setLeft] = useState(() => msUntilSeasonEnd(Date.now()))
  useEffect(() => {
    const id = setInterval(() => setLeft(msUntilSeasonEnd(Date.now())), 1000)
    return () => clearInterval(id)
  }, [])

  // Таблица: боты + вы (если есть реальные раунды), по убыванию очков
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = TOP_BOTS.map((b) => ({ key: b.id, me: false, name: b.name, avatar: b.avatar, points: b.points }))
    if (!noData) list.push({ key: 'me', me: true, name: 'Вы', points: myPoints })
    return list.sort((a, b) => b.points - a.points).slice(0, 10)
  }, [noData, myPoints])

  const myIndex = rows.findIndex((r) => r.me)
  const myRankLabel = noData ? '999+' : myIndex >= 0 ? String(myIndex + 1) : '10+'
  const myPrize = myIndex >= 0 ? giftById.get(PRIZE_IDS[myIndex] ?? '') : undefined

  return (
    <div className={styles.screen}>
      {FEATURES.ratingHero ? (
        <section className={styles.hero} aria-label="Рейтинг">
        <div className={styles.heroTop}>
          <span className={styles.heroIcon}>
            <TrophyIcon className={styles.heroIconSvg} aria-hidden />
          </span>
          <h1 className={styles.title}>Рейтинг</h1>
        </div>
        <div className={styles.heroRow}>
          <div className={styles.heroCol}>
            <span className={styles.heroLabel}>Заканчивается через</span>
            <span className={styles.timer} role="timer">
              <ClockIcon className={styles.timerIcon} aria-hidden />
              {formatCountdown(left)}
            </span>
          </div>
          <div className={cx(styles.heroCol, styles.heroColRight)}>
            <span className={styles.heroLabel}>Призы и победители</span>
            <span className={styles.winners}>
              <UsersIcon className={styles.winnersIcon} aria-hidden />
              {PRIZE_IDS.length}
            </span>
          </div>
        </div>
        <p className={styles.heroText}>
          Соревнуйтесь с другими пользователями и выигрывайте потрясающие призы!
        </p>
      </section>
      ) : (
        <h1 className={styles.title}>Рейтинг</h1>
      )}

      <div className={styles.listHead}>
        <span className={styles.listTitle}>
          <TrophyIcon className={styles.listTitleIcon} aria-hidden />
          Топ игроков
        </span>
        <span className={styles.colLabel}>Приз</span>
        <span className={styles.colLabel}>Очки</span>
      </div>

      <ol className={styles.list} aria-label="Рейтинг игроков">
        {rows.map((row, idx) => {
          const prize = giftById.get(PRIZE_IDS[idx] ?? '')
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
              {row.me ? (
                <UserAvatar size={44} className={styles.avatar} />
              ) : (
                <img className={styles.avatar} src={row.avatar} alt="" />
              )}
              <span className={styles.name}>
                {row.me ? 'Вы' : maskName(row.name)}
              </span>
              <span className={styles.prize}>
                {prize && <img src={prize.image} alt="" className={styles.prizeImg} />}
              </span>
              <span className={styles.points}>{formatPoints(row.points)}</span>
            </li>
          )
        })}
      </ol>

      <div className={styles.meBar} aria-label="Ваше место">
        <span className={styles.meRank}>{myRankLabel}</span>
        <UserAvatar size={40} className={styles.avatar} />
        <span className={styles.meChip}>ВЫ</span>
        <span className={styles.prize}>
          {myPrize ? (
            <img src={myPrize.image} alt="" className={styles.prizeImg} />
          ) : (
            <span className={styles.noPrize} aria-label="Без приза">
              ✕
            </span>
          )}
        </span>
        <span className={styles.points}>{formatPoints(myPoints)}</span>
      </div>

      <p className={styles.note}>
        PVP-матчей: {pvpMatches}. Очки — оборот ставок в TON × 100. Таблица лидеров обновляется по
        результатам раундов; места ботов — демо.
      </p>
    </div>
  )
}
