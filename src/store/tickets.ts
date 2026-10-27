import { create } from 'zustand'
import type { Minor } from '../lib/money'

/** Начисление: 1 билет за каждые 2 GRAM оборота (TICKET_STEP_MINOR = 2000). */
export const TICKET_STEP_MINOR = 2000

/** Ценность билета при обмене и в EV розыгрыша: 25 minor = 0.025 GRAM. */
export const TICKET_VALUE_MINOR = 25

interface TicketsState {
  balance: number
  /** Водяной знак: сколько оборота уже конвертировано в билеты (minor). */
  creditedWageredMinor: Minor
  /** Всего начислено билетов с начала сессии (для прозрачности UI). */
  accruedTickets: number
  /** Начислить недостающие билеты под новый совокупный оборот; возвращает начисленное. */
  accrueForWagered: (totalWageredMinor: Minor) => number
  /** Разовое начисление (задания, промо). */
  add: (amount: number) => void
  /** Списание; false, если билетов не хватает. */
  spend: (amount: number) => boolean
}

/**
 * Билеты лояльности (6.3). Начисление — от РЕАЛЬНОГО оборота ставок
 * (store/profile ← gamesHistory/pvpMatches): floor(оборот/2000) билетов всего,
 * водяной знак не даёт начислить один оборот дважды. Ценность билета при обмене
 * 0.025 GRAM ⇒ кэшбэк = 0.5·25/1000 = 1.25% оборота — внутри house edge 2%,
 * раскрыто на экране. Demo Mode: в памяти; серверная программа — TIER 7.
 */
export const useTicketsStore = create<TicketsState>((set, get) => ({
  balance: 0,
  creditedWageredMinor: 0,
  accruedTickets: 0,

  accrueForWagered: (total) => {
    const { creditedWageredMinor } = get()
    if (!Number.isSafeInteger(total) || total <= creditedWageredMinor) return 0
    const should = Math.floor(total / TICKET_STEP_MINOR)
    const already = Math.floor(creditedWageredMinor / TICKET_STEP_MINOR)
    const grant = should - already
    set({ creditedWageredMinor: total })
    if (grant <= 0) return 0
    set((s) => ({
      balance: s.balance + grant,
      accruedTickets: s.accruedTickets + grant,
    }))
    return grant
  },

  add: (amount) => {
    if (!Number.isSafeInteger(amount) || amount <= 0) return
    set((s) => ({ balance: s.balance + amount }))
  },

  spend: (amount) => {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false
    const { balance } = get()
    if (balance < amount) return false
    set({ balance: balance - amount })
    return true
  },
}))
