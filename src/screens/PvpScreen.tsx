import { Link, useNavigate } from 'react-router-dom'
import { PvpMatchHistory } from '../components/pvp/PvpMatchHistory'
import { PvpLeaderboard } from '../components/pvp/PvpLeaderboard'
import { usePvpRoundsStore } from '../store/pvpRounds'
import { formatMinor } from '../lib/money'
import { CoinsRewardIcon, SwordsIcon } from '../components/shell/icons'
import styles from './screens.module.css'
import pvpStyles from './PvpScreen.module.css'

/**
 * PVP HUB (5.1). Два режима — Solo Jackpot и TVT: Ice vs Fire; оба Demo Mode
 * против казино-контрагента с раскрытыми шансами (реальные игроки — TIER 7).
 * Пока открыт раунд Джекпота, хаб показывает баннер возврата (5.4 —
 * синхронизация раундов). Ниже — история матчей (5.5) и лидерборд (5.6)
 * только по реальным данным пользователя.
 */
export function PvpScreen() {
  const navigate = useNavigate()
  const jackpot = usePvpRoundsStore((s) => s.jackpot)
  const jackpotOpen = jackpot !== null && !jackpot.finished

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>PVP HUB</h1>
      <p className={styles.lead}>Дуэли и джекпот — играйте и побеждайте</p>

      {jackpotOpen && jackpot && (
        <Link to="/pvp/jackpot" className={pvpStyles.activeRound} data-testid="active-round">
          <span className={pvpStyles.activePulse} aria-hidden />
          <span className={pvpStyles.activeInfo}>
            <span className={pvpStyles.activeTitle}>Идёт раунд: Solo Jackpot</span>
            <span className={pvpStyles.activeMeta}>
              Банк {formatMinor(jackpot.poolMinor)} TON · доля{' '}
              {(jackpot.shareParts / 100).toFixed(2)}%
            </span>
          </span>
          <span className={pvpStyles.activeBack}>Вернуться →</span>
        </Link>
      )}

      <div className={pvpStyles.modeGrid}>
        <Link
          to="/pvp/jackpot"
          className={`${pvpStyles.mode} ${pvpStyles.modeJackpot}`}
        >
          <span className={pvpStyles.modeIcon} aria-hidden>
            <CoinsRewardIcon style={{ width: '28px', height: '28px', color: '#f59e0b' }} />
          </span>
          <span className={pvpStyles.modeName}>Solo Jackpot</span>
          <span className={pvpStyles.modeDesc}>
            Шанс = доля ставки в банке · выплата — весь банк · EV опубликован
          </span>
        </Link>

        <Link
          to="/pvp/tvt"
          className={`${pvpStyles.mode} ${pvpStyles.modeTvt}`}
        >
          <span className={pvpStyles.modeIcon} aria-hidden>
            <SwordsIcon style={{ width: '28px', height: '28px', color: '#38bdf8' }} />
          </span>
          <span className={pvpStyles.modeName}>TVT: Лёд vs Огонь</span>
          <span className={pvpStyles.modeDesc}>
            Монета 50/50 · выплата ×1.96 · соперник — казна
          </span>
        </Link>
      </div>

      <PvpLeaderboard />

      <PvpMatchHistory />

      <button
        type="button"
        className={pvpStyles.rules}
        onClick={() => navigate('/pvp/jackpot')}
        aria-label="Как устроена честность PVP"
      >
        <SwordsIcon className={pvpStyles.rulesIcon} />
        <span>
          Честные правила: шанс и коэффициенты открыты, мгновенные выплаты при победе.
        </span>
      </button>
    </div>
  )
}
