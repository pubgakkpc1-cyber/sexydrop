import { useState } from 'react'
import { QUESTS, useQuestsStore } from '../store/quests'
import { useProfileStore } from '../store/profile'
import { PAYOUT_MIN_MINOR, usePayoutsStore } from '../store/payouts'
import { minorToStars } from '../lib/stars'
import { useWalletStore } from '../store/wallet'
import { formatMinor, type Minor } from '../lib/money'
import { StarIcon, TonIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './RewardsScreen.module.css'

/** Быстрые суммы выплаты, minor TON. */
const PAYOUT_PRESETS: readonly Minor[] = [1000, 5000, 10_000, 25_000]

function fmtStars(stars: number): string {
  return stars.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
}

/**
 * Заработок: баланс и статистика, выплата звёздами и задания с наградой в TON.
 * Всё считается из РЕАЛЬНОЙ статистики пользователя (store/profile); синтетика запрещена.
 * Серверная проверка заданий и сама выплата Stars — TIER 7.
 */
export function RewardsScreen() {
  const balance = useWalletStore((s) => s.balances[s.mode])
  const claimed = useQuestsStore((s) => s.claimed)
  const claim = useQuestsStore((s) => s.claim)
  const progressOf = useQuestsStore((s) => s.progressOf)
  const profile = useProfileStore()
  const requests = usePayoutsStore((s) => s.requests)
  const [amount, setAmount] = useState<Minor>(PAYOUT_PRESETS[0] ?? PAYOUT_MIN_MINOR)
  const [note, setNote] = useState<string | null>(null)

  const doneQuests = QUESTS.filter((q) => claimed[q.id] === true).length
  const canPay = balance >= amount && amount >= PAYOUT_MIN_MINOR

  const requestPayout = () => {
    const res = usePayoutsStore.getState().request(amount)
    setNote(
      res === 'ok'
        ? `Заявка принята: ${fmtStars(minorToStars(amount))} Stars`
        : res === 'insufficient'
          ? 'Недостаточно средств на балансе'
          : 'Минимальная выплата — 1 TON',
    )
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Заработок</h1>
      <p className={styles.lead}>Играй, выполняй задания и забирай выплату звёздами</p>

      <section className={styles.earnHero} aria-label="Сводка заработка">
        <div className={styles.earnMain}>
          <span className={styles.earnLabel}>Доступно к выплате</span>
          <span className={styles.earnValue} data-testid="earn-value">
            {formatMinor(balance)} TON
          </span>
          <span className={styles.earnSub}>
            ≈ {fmtStars(minorToStars(balance))}
            <StarIcon className={styles.earnStar} aria-hidden />
          </span>
        </div>
        <div className={styles.earnStats}>
          <span><b>{formatMinor(profile.wageredMinor)}</b> оборот</span>
          <span><b>{profile.rounds}</b> раундов</span>
          <span><b>{doneQuests}/{QUESTS.length}</b> заданий</span>
        </div>
      </section>

      {/* --- Выплата звёздами --- */}
      <section className={styles.section} aria-label="Выплата звёздами">
        <h2 className={styles.sectionTitle}>
          <StarIcon className={styles.titleStar} aria-hidden /> Выплата звёздами
        </h2>
        <p className={styles.rules}>Курс: 175 Stars = 1 TON. Минимальная выплата — 1 TON.</p>

        <div className={styles.exchange} role="group" aria-label="Сумма выплаты">
          {PAYOUT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={cx(styles.exchangeButton, amount === preset && styles.exchangeActive)}
              aria-pressed={amount === preset}
              onClick={() => {
                setNote(null)
                setAmount(preset)
              }}
            >
              <span className={styles.presetTon}>
                {formatMinor(preset)} <TonIcon className={styles.presetIcon} aria-hidden />
              </span>
              <span className={styles.presetStars}>
                {fmtStars(minorToStars(preset))} <StarIcon className={styles.presetIcon} aria-hidden />
              </span>
            </button>
          ))}
        </div>

        <button type="button" className={styles.raffleCta} disabled={!canPay} onClick={requestPayout}>
          Вывести {fmtStars(minorToStars(amount))} Stars
        </button>
        {note && (
          <p className={styles.drawResult} role="status" data-testid="payout-note">
            {note}
          </p>
        )}

        {requests.length > 0 && (
          <div className={styles.drawHistory} aria-label="Заявки на выплату">
            {requests.slice(0, 5).map((r) => (
              <div key={r.id} className={styles.drawRow}>
                <span>{fmtStars(r.stars)} Stars · в обработке</span>
                <span>{formatMinor(r.minor)} TON</span>
              </div>
            ))}
          </div>
        )}
        <p className={styles.rules}>Выплату проводит сервер после подключения платежей.</p>
      </section>

      {/* --- Задания --- */}
      <section className={styles.section} aria-label="Задания">
        <h2 className={styles.sectionTitle}>Задания — заработай TON</h2>
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
                    +{formatMinor(quest.rewardMinor)} <TonIcon className={styles.presetIcon} aria-hidden />
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
