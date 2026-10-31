import { create } from 'zustand'
import { STARS_PER_TON, starsToMinor } from '../lib/stars'
import { useWalletStore } from './wallet'

/** Минимальный обмен: 175 Stars = 1 TON. */
export const EXCHANGE_MIN_STARS = STARS_PER_TON

interface StarsBalanceState {
  /** Заработанные звёзды (за задания и бонусы). */
  stars: number
  add: (amount: number) => void
  /** Обмен звёзд на TON по курсу 175 Stars = 1 TON (вниз); возвращает статус. */
  exchange: (stars: number) => 'ok' | 'too_small' | 'insufficient'
}

export const useStarsBalanceStore = create<StarsBalanceState>((set, get) => ({
  stars: 0,
  add: (amount) => {
    if (amount > 0) set((s) => ({ stars: s.stars + Math.floor(amount) }))
  },
  exchange: (stars) => {
    const amount = Math.floor(stars)
    if (amount < EXCHANGE_MIN_STARS) return 'too_small'
    if (get().stars < amount) return 'insufficient'
    set((s) => ({ stars: s.stars - amount }))
    useWalletStore.getState().credit(starsToMinor(amount))
    return 'ok'
  },
}))
