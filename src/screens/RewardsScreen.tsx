import { useState } from 'react'
import { QUESTS, useQuestsStore } from '../store/quests'
import { useProfileStore } from '../store/profile'
import {
  TICKET_STEP_MINOR,
  TICKET_VALUE_MINOR,
  useTicketsStore,
} from '../store/tickets'
import { drawRaffle, raffleRecentDraws } from '../services/demoRaffleService'
import { RAFFLE_PRIZES, RAFFLE_TICKET_COST } from '../lib/raffleMath'
import { formatMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { giftById } from '../data/catalog'
import { useWalletStore } from '../store/wallet'
import { TicketIcon } from '../components/shell/icons'
import styles from './RewardsScreen.module.css'

/** Обмен билетов на TON: 25 minor за билет (единая ценность 6.3). */
const EXCHANGE_OPTIONS: readonly { tickets: number; gramMinor: Minor }[] = [
  { tickets: 100, gramMinor: 2500 },
  { tickets: 400, gramMinor: 10_000 },
  { tickets: 1000, gramMinor: 25_000 },
]

/**
 * Награды (6.2–6.4): задания и прогресс, билеты и обмен, розыгрыш.
 * Всё считается из РЕАЛЬНОЙ статистики пользователя (store/profile ←
 * gamesHistory/pvpMatches); синтетика запрещена. Экономика раскрыта:
 * билет = 0.025 TON, начисление 1 билет / 2 TON оборота = кэшбэк 1.25%
 * (внутри house edge 2%); EV розыгрыша = ценности затраченных билетов.
 * Серверная проверка заданий — TIER 7 (6.6/7.6).
 */
export function RewardsScreen() {
  const tickets = useTicketsStore((s) => s.balance)
  const accrued = useTicketsStore((s) => s.accruedTickets)
  const claimed = useQuestsStore((s) => s.claimed)
  const claim = useQuestsStore((s) => s.claim)
  const progressOf = useQuestsStore((s) => s.progressOf)
  const profile = useProfileStore()
  const [lastDraw, setLastDraw] = useState<string | null>(null)
  const [exchangeError, setExchangeError] = useState<string | null>(null)

  const exchange = (ticketsCost: number, gramMinor: Minor) => {
    setExchangeError(null)
    if (!useTicketsStore.getState().spend(ticketsCost)) {
      setExchangeError('Недостаточно билетов')
      return
    }
    // Кэшбэк-программа: билеты → TON по фиксированной ценности (25 minor).
    // Обмен не создаёт раунд в профиле — это конвертация, а не игра.
    useWalletStore.getState().credit(gramMinor)
    setLastDraw(`Обмен ${ticketsCost} билетов → ${formatMinor(gramMinor)} TON`)
  }

  const spinRaffle = () => {
    const result = drawRaffle(makeRequestId())
    if (result.status !== 'ok') {
      setLastDraw('Недостаточно билетов для тиража (нужно 100)')
      return
    }
    setLastDraw(
      result.prizeGiftId === null
        ? 'Тираж: пусто — билеты сгорели (EV раскрыт: 2.5 TON)'
        : `Тираж: ${giftById.get(result.prizeGiftId)?.name ?? result.prizeGiftId} → инвентарь`,
    )
  }

  const draws = raffleRecentDraws()

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Награды</h1>
      <p className={styles.lead}>Задания, билеты и розыгрыши</p>

      {/* --- Билеты (6.3) --- */}
      <section className={styles.section} aria-label="Билеты">
        <div className={styles.ticketHead}>
          <h2 className={styles.sectionTitle}>
            <TicketIcon style={{ width: '18px', height: '18px', display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
            <span>Билеты</span>
          </h2>
          <span className={styles.ticketBalance} data-testid="tickets">
            {tickets}
          </span>
        </div>
        <p className={styles.rules}>
          Начисление: 1 билет за каждые {formatMinor(TICKET_STEP_MINOR)} TON оборота
          в играх и PVP — кэшбэк {(TICKET_VALUE_MINOR * 100) / TICKET_STEP_MINOR}% от
          оборота (внутри house edge 2%). Ценность билета при обмене:{' '}
          {formatMinor(TICKET_VALUE_MINOR)} TON. Начислено за сессию: {accrued}.
        </p>

        <div className={styles.exchange} role="group" aria-label="Обмен билетов">
          {EXCHANGE_OPTIONS.map((option) => (
            <button
              key={option.tickets}
              type="button"
              className={styles.exchangeButton}
              disabled={tickets < option.tickets}
              onClick={() => exchange(option.tickets, option.gramMinor)}
            >
              {option.tickets} билетов → {formatMinor(option.gramMinor)} TON
            </button>
          ))}
        </div>
        {exchangeError && (
          <p className={styles.error} role="alert">
            {exchangeError}
          </p>
        )}
      </section>

      {/* --- Задания (6.2) --- */}
      <section className={styles.section} aria-label="Задания">
        <h2 className={styles.sectionTitle}>Задания и прогресс</h2>
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
                  <span className={styles.questReward} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    +{quest.rewardTickets} <TicketIcon style={{ width: '14px', height: '14px' }} />
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
        <p className={styles.rules}>
          Задания считаются локально по реальным событиям; серверная проверка
          по журналу транзакций — TIER 7 (6.6/7.6). Награды разовые (промо).
        </p>
      </section>

      {/* --- Розыгрыш (6.4) --- */}
      <section className={styles.section} aria-label="Розыгрыш">
        <h2 className={styles.sectionTitle}>Розыгрыш</h2>
        <p className={styles.rules}>
          Тираж = {RAFFLE_TICKET_COST} билетов; приз — подарок каталога в инвентарь.
          EV тиража = 2.5 TON = ровно ценность {RAFFLE_TICKET_COST} билетов
          ({RAFFLE_TICKET_COST} × {formatMinor(TICKET_VALUE_MINOR)} TON); шансы ниже.
        </p>
        <div className={styles.prizeTable} aria-label="Шансы призов">
          {RAFFLE_PRIZES.map((prize) => (
            <div key={prize.giftId ?? 'empty'} className={styles.prizeRow}>
              <span>
                {prize.giftId === null
                  ? 'Пусто'
                  : (giftById.get(prize.giftId)?.name ?? prize.giftId)}
              </span>
              <span className={styles.prizeChance}>
                {(prize.weight / 100).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.raffleCta}
          disabled={tickets < RAFFLE_TICKET_COST}
          onClick={spinRaffle}
        >
          Крутить розыгрыш · {RAFFLE_TICKET_COST} билетов
        </button>
        {lastDraw && (
          <p className={styles.drawResult} data-testid="raffle-result">
            {lastDraw}
          </p>
        )}
        {draws.length > 0 && (
          <div className={styles.drawHistory}>
            {draws.slice(0, 5).map((draw, index) => (
              <div key={`${draw.at}-${index}`} className={styles.drawRow}>
                <span>
                  {draw.prizeGiftId === null
                    ? 'Пусто'
                    : (giftById.get(draw.prizeGiftId)?.name ?? draw.prizeGiftId)}
                </span>
                <span>
                  {draw.prizeMinor > 0 ? `${formatMinor(draw.prizeMinor)} TON` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className={styles.note}>
        Demo Mode: статистика реальная (раунды: {profile.rounds}, оборот:{' '}
        {formatMinor(profile.wageredMinor)} TON), билеты хранятся в памяти и
        сбрасываются при перезагрузке. Серверная программа лояльности — TIER 7.
      </p>
    </div>
  )
}
