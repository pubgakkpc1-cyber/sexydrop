import { useState } from 'react'
import { QUESTS, useQuestsStore } from '../store/quests'
import { useProfileStore } from '../store/profile'
import { EXCHANGE_MIN_STARS, useStarsBalanceStore } from '../store/starsBalance'
import { STARS_PER_TON, starsToMinor } from '../lib/stars'
import { formatMinor } from '../lib/money'
import { StarIcon, TonIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './RewardsScreen.module.css'

/** Быстрые суммы обмена, Stars (кратно курсу: 1, 5, 10 TON). */
const EXCHANGE_PRESETS: readonly number[] = [STARS_PER_TON, STARS_PER_TON * 5, STARS_PER_TON * 10]

function fmtStars(stars: number): string {
  return stars.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
}

/**
 * Заработок: звёзды за задания и обмен звёзд на TON. Задания считаются из РЕАЛЬНОЙ статистики
 * (store/profile); синтетики нет. Серверная проверка заданий — TIER 7.
 */
export function RewardsScreen() {
  const stars = useStarsBalanceStore((s) => s.stars)
  const claimed = useQuestsStore((s) => s.claimed)
  const claim = useQuestsStore((s) => s.claim)
  const progressOf = useQuestsStore((s) => s.progressOf)
  const profile = useProfileStore()
  const [note, setNote] = useState<string | null>(null)

  const doneQuests = QUESTS.filter((q) => claimed[q.id] === true).length

  const exchange = (amount: number) => {
    const res = useStarsBalanceStore.getState().exchange(amount)
    setNote(
      res === 'ok'
        ? `Обмен: ${fmtStars(amount)} Stars → ${formatMinor(starsToMinor(amount))} TON`
        : res === 'insufficient'
          ? 'Недостаточно звёзд'
          : `Минимальный обмен — ${EXCHANGE_MIN_STARS} Stars`,
    )
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Заработок</h1>
      <p className={styles.lead}>Выполняй задания, копи звёзды и обменивай их на TON</p>

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
        <div className={styles.earnStats}>
          <span><b>{formatMinor(profile.wageredMinor)}</b> оборот</span>
          <span><b>{profile.rounds}</b> раундов</span>
          <span><b>{doneQuests}/{QUESTS.length}</b> заданий</span>
        </div>
      </section>

      {/* --- Обмен звёзд на TON --- */}
      <section className={styles.section} aria-label="Обмен звёзд">
        <h2 className={styles.sectionTitle}>
          <StarIcon className={styles.titleStar} aria-hidden /> Обмен на TON
        </h2>
        <p className={styles.rules}>Курс: {STARS_PER_TON} Stars = 1 TON. Минимальный обмен — {EXCHANGE_MIN_STARS} Stars.</p>

        <div className={styles.exchange} role="group" aria-label="Сумма обмена">
          {EXCHANGE_PRESETS.map((amount) => (
            <button
              key={amount}
              type="button"
              className={cx(styles.exchangeButton, stars >= amount && styles.exchangeActive)}
              disabled={stars < amount}
              onClick={() => exchange(amount)}
            >
              <span className={styles.presetStars}>
                {fmtStars(amount)} <StarIcon className={styles.presetIcon} aria-hidden />
              </span>
              <span className={styles.presetTon}>
                → {formatMinor(starsToMinor(amount))} <TonIcon className={styles.presetIcon} aria-hidden />
              </span>
            </button>
          ))}
          <button
            type="button"
            className={cx(styles.exchangeButton, stars >= EXCHANGE_MIN_STARS && styles.exchangeActive)}
            disabled={stars < EXCHANGE_MIN_STARS}
            onClick={() => exchange(stars)}
          >
            <span className={styles.presetStars}>Всё</span>
            <span className={styles.presetTon}>
              → {formatMinor(starsToMinor(stars))} <TonIcon className={styles.presetIcon} aria-hidden />
            </span>
          </button>
        </div>

        {note && (
          <p className={styles.drawResult} role="status" data-testid="exchange-note">
            {note}
          </p>
        )}
      </section>

      {/* --- Задания --- */}
      <section className={styles.section} aria-label="Задания">
        <h2 className={styles.sectionTitle}>Задания — заработай звёзды</h2>
        <div className={styles.questList}>
          {QUESTS.map((quest) => {
            const progress = Math.min(progressOf(quest), quest.target)
            const done = progressOf(quest) >= quest.target
            const isClaimed = claimed[quest.id] === true
            const pct = Math.round((progress * 100) / quest.target)
            return (
              <div key={quest.id} className={styles.quest}>
                <div className={styles.questTop}>
                  <span className={styles.questTitle}>{quest.title}</span>
                  <span className={styles.questReward}>
                    +{fmtStars(quest.rewardStars)} <StarIcon className={styles.presetIcon} aria-hidden />
                  </span>
                </div>
                <div className={styles.questBar}>
                  <span className={styles.questFill} style={{ width: `${pct}%` }} />
                </div>
                <div className={styles.questBottom}>
                  <span>
                    Прогресс:{' '}
                    {quest.metric === 'wagered' ? formatMinor(progress) : progress}/
                    {quest.metric === 'wagered' ? formatMinor(quest.target) : quest.target}
                  </span>
                  <button
                    type="button"
                    className={styles.claim}
                    disabled={!done || isClaimed}
                    onClick={() => claim(quest.id)}
                  >
                    {isClaimed ? 'Забрано' : done ? 'Забрать' : '—'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <p className={styles.rules}>Бонусы за задания разовые.</p>
      </section>
    </div>
  )
}
