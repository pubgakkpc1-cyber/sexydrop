import { useMemo } from 'react'
import { usePvpMatchesStore } from '../../store/pvpMatches'
import { formatMinor } from '../../lib/money'
import styles from './PvpLeaderboard.module.css'

/**
 * PvP Leaderboard (5.6) — только реальные данные. В Demo Mode реальный игрок
 * один: таблица показывает агрегаты собственных матчей (матчи, победы,
 * винрейт, профит). Фиктивные игроки, выдаваемые за реальных, запрещены
 * спецификацией; полный лидерборд появится с backend — TIER 7 (7.6).
 */
export function PvpLeaderboard() {
  const entries = usePvpMatchesStore((s) => s.entries)

  const stats = useMemo(() => {
    let wins = 0
    let net = 0
    for (const entry of entries) {
      if (entry.outcome === 'won') wins += 1
      net += entry.deltaMinor
    }
    return {
      matches: entries.length,
      wins,
      winRatePct: entries.length === 0 ? 0 : Math.round((wins * 100) / entries.length),
      net,
    }
  }, [entries])

  return (
    <section className={styles.section} aria-label="PvP Leaderboard">
      <h2 className={styles.title}>PvP Leaderboard</h2>
      {entries.length === 0 ? (
        <p className={styles.empty}>
          Матчей пока нет — сыграйте, чтобы появилась ваша строка.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Игрок</th>
              <th scope="col">Матчи</th>
              <th scope="col">Винрейт</th>
              <th scope="col">Профит</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                Вы <span className={styles.youTag}>реальные данные</span>
              </td>
              <td className={styles.num}>{stats.matches}</td>
              <td className={styles.num}>{stats.winRatePct}%</td>
              <td className={styles.num}>
                <span className={stats.net >= 0 ? styles.netWon : styles.netLost}>
                  {stats.net >= 0 ? '+' : '−'}
                  {formatMinor(Math.abs(stats.net))} TON
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <p className={styles.note}>
        Таблица лидеров PVP по суммарному выигрышу и активности.
      </p>
    </section>
  )
}
