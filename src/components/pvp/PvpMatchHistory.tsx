import { usePvpMatchesStore, type PvpMode } from '../../store/pvpMatches'
import { formatMinor } from '../../lib/money'
import { CoinsRewardIcon, SwordsIcon, TonIcon } from '../shell/icons'
import styles from './PvpMatchHistory.module.css'

const MODE_NAMES: Record<PvpMode, string> = {
  jackpot: 'Solo Jackpot',
  tvt: 'TVT: Лёд vs Огонь',
}

function renderPvpIcon(mode: PvpMode) {
  if (mode === 'jackpot') {
    return <CoinsRewardIcon style={{ width: '18px', height: '18px', color: '#ba464b' }} />
  }
  return <SwordsIcon style={{ width: '18px', height: '18px', color: '#c7696d' }} />
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * История PVP-матчей (5.5). Показывает только реальные матчи пользователя
 * из `usePvpMatchesStore` (пишут demo-сервисы PVP): режим, ставка, исход
 * и чистое изменение баланса.
 */
export function PvpMatchHistory() {
  const entries = usePvpMatchesStore((s) => s.entries)
  if (entries.length === 0) return null

  return (
    <section className={styles.section} aria-label="История матчей">
      <h2 className={styles.title}>История матчей</h2>
      <div className={styles.list}>
        {entries.map((entry, index) => (
          <div key={`${entry.at}-${index}`} className={styles.row}>
            <span className={styles.icon} aria-hidden>
              {renderPvpIcon(entry.mode)}
            </span>
            <span className={styles.info}>
              <span className={styles.name}>{MODE_NAMES[entry.mode]}</span>
              <span className={styles.meta}>
                <span
                  className={
                    entry.outcome === 'won' ? styles.outcomeWon : styles.outcomeLost
                  }
                >
                  {entry.outcome === 'won' ? 'Победа' : 'Поражение'}
                </span>
                {' · '}
                <TonIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                {formatMinor(entry.stakeMinor)} TON
                {entry.detail && ` · ${entry.detail}`}
              </span>
            </span>
            <span className={styles.right}>
              <span
                className={entry.deltaMinor >= 0 ? styles.deltaWon : styles.deltaLost}
              >
                <TonIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                <span>{`${entry.deltaMinor >= 0 ? '+' : '−'}${formatMinor(Math.abs(entry.deltaMinor))} TON`}</span>
              </span>
              <time dateTime={new Date(entry.at).toISOString()} className={styles.time}>
                {timeFormatter.format(entry.at)}
              </time>
            </span>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        История ваших последних PVP-матчей.
      </p>
    </section>
  )
}
