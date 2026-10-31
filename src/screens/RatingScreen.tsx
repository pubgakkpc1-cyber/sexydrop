import { useMemo, useState } from 'react'
import { useProfileStore } from '../store/profile'
import { TrophyIcon } from '../components/shell/icons'
import { UserAvatar } from '../components/ui/UserAvatar'
import { TgAvatar } from '../components/ui/TgAvatar'
import { cx } from '../lib/cx'
import styles from './RatingScreen.module.css'

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
  const [infoOpen, setInfoOpen] = useState(false)
  const myPoints = Math.floor(wageredMinor / 10) // 1 TON оборота = 100 очков

  // Таблица: боты + вы (если есть реальные раунды), по убыванию очков
  const rows = useMemo<Row[]>(() => {
    // Только реальные игроки: пока серверного рейтинга нет, в таблице только вы
    return noData ? [] : [{ key: 'me', me: true, name: 'Вы', points: myPoints }]
  }, [noData, myPoints])

  const myIndex = rows.findIndex((r) => r.me)
  const myRankLabel = noData ? '999+' : myIndex >= 0 ? String(myIndex + 1) : '10+'

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Рейтинг</h1>

      {/* Маленькое описание очков: раскрывается только по нажатию */}
      <div className={styles.info}>
        <button
          type="button"
          className={styles.infoBtn}
          aria-expanded={infoOpen}
          onClick={() => setInfoOpen((v) => !v)}
        >
          Что за очки? <span className={cx(styles.infoCaret, infoOpen && styles.infoCaretOpen)} aria-hidden>▾</span>
        </button>
        {infoOpen && (
          <div className={styles.infoPanel} role="note">
            <p><b>Очки</b> показывают, как много вы играете. За каждую ставку в Ракетке и мини-играх
            вы получаете <b>100 очков за 1 TON</b> ставки (1 TON оборота = 100 очков).</p>
            <p>Выигрыш и проигрыш не важны — считается только оборот. Таблица обновляется после
            каждого раунда. Места ботов — демо.</p>
          </div>
        )}
      </div>

      <div className={styles.listHead}>
        <span className={styles.listTitle}>
          <TrophyIcon className={styles.listTitleIcon} aria-hidden />
          Топ игроков
        </span>
        <span className={styles.colLabel}>Очки</span>
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
              {row.me ? (
                <UserAvatar size={44} className={styles.avatar} />
              ) : (
                <TgAvatar name={row.name} size={44} className={styles.avatar} />
              )}
              <span className={styles.name}>
                {row.me ? 'Вы' : maskName(row.name)}
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
        <span className={styles.points}>{formatPoints(myPoints)}</span>
      </div>

      <p className={styles.note}>
        PVP-матчей: {pvpMatches}.
      </p>
    </div>
  )
}
