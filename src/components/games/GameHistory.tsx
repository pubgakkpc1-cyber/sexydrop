import type { ReactNode } from 'react'
import { useGamesHistoryStore, type GameName } from '../../store/gamesHistory'
import { formatMinor } from '../../lib/money'
import {
  BombIcon,
  DiceIcon,
  RefreshIcon,
  RocketIcon,
  SlotIcon,
  TargetIcon,
  TonIcon,
  WrenchIcon,
} from '../shell/icons'
import styles from './GameHistory.module.css'

function renderGameIcon(game: GameName): ReactNode {
  const iconStyle = { width: '18px', height: '18px' }
  switch (game) {
    case 'Ракетка':
      return <RocketIcon style={iconStyle} />
    case 'Апгрейд':
      return <RefreshIcon style={iconStyle} />
    case 'Крафт':
      return <WrenchIcon style={iconStyle} />
    case 'Плинко':
      return <TargetIcon style={iconStyle} />
    case 'Дайс':
      return <DiceIcon style={iconStyle} />
    case 'Мины':
      return <BombIcon style={iconStyle} />
    case 'Спины':
      return <SlotIcon style={iconStyle} />
  }
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Общая история ставок по мини-играм (4.3). Показывает только реальные
 * результаты пользователя из `useGamesHistoryStore` (пишут demo-сервисы игр).
 */
export function GameHistory() {
  const entries = useGamesHistoryStore((s) => s.entries)
  if (entries.length === 0) return null

  return (
    <section className={styles.section} aria-label="История ставок">
      <h2 className={styles.title}>История ставок</h2>
      <div className={styles.list}>
        {entries.map((entry, index) => (
          <div key={`${entry.at}-${index}`} className={styles.row}>
            <span className={styles.icon} aria-hidden>
              {renderGameIcon(entry.game)}
            </span>
            <span className={styles.info}>
              <span className={styles.name}>{entry.game}</span>
              <span className={styles.meta}>
                <span
                  className={
                    entry.outcome === 'won' ? styles.outcomeWon : styles.outcomeLost
                  }
                >
                  {entry.outcome === 'won' ? 'Выигрыш' : 'Проигрыш'}
                </span>
                {' · '}
                {entry.stakeLabel}
                {entry.detail && ` · ${entry.detail}`}
              </span>
            </span>
            <span className={styles.right}>
              <span
                className={
                  entry.deltaMinor >= 0 ? styles.deltaWon : styles.deltaLost
                }
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
        История Demo Mode хранится локально и сбрасывается при перезагрузке;
        серверная история раундов — TIER 7 (7.6).
      </p>
    </section>
  )
}
