import { useNavigate } from 'react-router-dom'
import { QUESTS, useQuestsStore, type Quest } from '../store/quests'
import { useProfileStore } from '../store/profile'
import { useStarsBalanceStore } from '../store/starsBalance'
import { claimQuestApi } from '../services/gameApi'
import { starsToMinor } from '../lib/stars'
import { formatMinor } from '../lib/money'
import { CheckIcon, ConvertIcon, StarIcon, TonIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import { TagQuestCard } from '../components/rewards/TagQuestCard'
import styles from './RewardsScreen.module.css'

function fmtStars(stars: number): string {
  return stars.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
}

/** Кольцо прогресса задания: дуга растёт, внутри звезда (или галочка, когда награда забрана). */
function QuestRing({ pct, done }: { pct: number; done: boolean }) {
  const r = 19
  const len = 2 * Math.PI * r
  return (
    <span className={cx(styles.ring, done && styles.ringDone)} aria-hidden>
      <svg viewBox="0 0 46 46" className={styles.ringSvg}>
        <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="23"
          cy="23"
          r={r}
          fill="none"
          stroke={done ? '#4fd18b' : '#ffc93c'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, pct) / 100) * len} ${len}`}
          transform="rotate(-90 23 23)"
        />
      </svg>
      {done ? <CheckIcon className={styles.ringIcon} /> : <StarIcon className={styles.ringIcon} />}
    </span>
  )
}

/**
 * Заработок: звёзды за задания и переход в конвертер для обмена на TON. Задания считаются из
 * РЕАЛЬНОЙ статистики (store/profile); синтетики нет. Серверная проверка заданий — TIER 7.
 */
export function RewardsScreen() {
  const navigate = useNavigate()
  const stars = useStarsBalanceStore((s) => s.stars)
  const claimed = useQuestsStore((s) => s.claimed)
  const progressOf = useQuestsStore((s) => s.progressOf)
  const profile = useProfileStore()

  const doneQuests = QUESTS.filter((q) => claimed[q.id] === true).length

  const fmtProgress = (quest: Quest, value: number) =>
    quest.metric === 'wagered' ? formatMinor(value) : String(value)

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Заработок</h1>
      <p className={styles.lead}>Выполняй задания, копи звёзды и обменивай их на TON</p>

      <TagQuestCard />

      <section className={styles.earnHero} aria-label="Сводка заработка">
        <div className={styles.earnMain}>
          <span className={styles.earnLabel}>Ваши звёзды</span>
          <span className={styles.earnValue} data-testid="earn-value">
            {fmtStars(stars)}
            <StarIcon className={styles.earnStarBig} aria-hidden />
          </span>
          <span className={styles.earnSub}>
            ≈ {formatMinor(starsToMinor(stars))} TON
            <TonIcon className={styles.earnStar} aria-hidden />
          </span>
        </div>
        <button type="button" className={styles.exchangeCta} onClick={() => navigate('/deposit?tab=convert')}>
          <ConvertIcon className={styles.exchangeCtaIcon} aria-hidden />
          Обменять
        </button>
        <div className={styles.earnStats}>
          <span><b>{formatMinor(profile.wageredMinor)}</b> оборот</span>
          <span><b>{profile.rounds}</b> раундов</span>
          <span><b>{doneQuests}/{QUESTS.length}</b> заданий</span>
        </div>
      </section>

      <section className={styles.section} aria-label="Задания">
        <h2 className={styles.sectionTitle}>Задания</h2>
        <ul className={styles.quests}>
          {QUESTS.map((quest) => {
            const value = progressOf(quest)
            const progress = Math.min(value, quest.target)
            const done = value >= quest.target
            const isClaimed = claimed[quest.id] === true
            const pct = Math.round((progress * 100) / quest.target)
            return (
              <li key={quest.id} className={cx(styles.qCard, done && !isClaimed && styles.qReady, isClaimed && styles.qClaimed)}>
                <QuestRing pct={pct} done={isClaimed} />
                <div className={styles.qBody}>
                  <span className={styles.qTitle}>{quest.title}</span>
                  <span className={styles.qProgress}>
                    {fmtProgress(quest, progress)} / {fmtProgress(quest, quest.target)}
                  </span>
                </div>
                <div className={styles.qSide}>
                  <span className={styles.qReward}>
                    +{fmtStars(quest.rewardStars)} <StarIcon className={styles.qRewardIcon} aria-hidden />
                  </span>
                  <button
                    type="button"
                    className={cx(styles.qBtn, done && !isClaimed && styles.qBtnReady)}
                    disabled={!done || isClaimed}
                    onClick={() => void claimQuestApi(quest.id)}
                  >
                    {isClaimed ? 'Забрано' : done ? 'Забрать' : `${pct}%`}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <p className={styles.rules}>Бонусы за задания разовые.</p>
      </section>
    </div>
  )
}
