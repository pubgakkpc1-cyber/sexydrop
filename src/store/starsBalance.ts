import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeJsonStorage } from '../lib/persistStorage'
import { exchangeStarsToMinor } from '../lib/stars'
import { useWalletStore } from './wallet'

/** Минимальный обмен — 1 звезда (курс 100 Stars = 1 TON). */
export const EXCHANGE_MIN_STARS = 1

interface StarsBalanceState {
  /** Заработанные звёзды (за задания и бонусы). */
  stars: number
  add: (amount: number) => void
  /** Списать звёзды (не больше, чем есть); возвращает сколько реально списано. */
  spend: (amount: number) => number
  /** Обмен звёзд на TON по курсу 100 Stars = 1 TON (вниз); возвращает статус. */
  exchange: (stars: number) => 'ok' | 'too_small' | 'insufficient'
}

export const useStarsBalanceStore = create<StarsBalanceState>()(
  persist(
    (set, get) => ({
  stars: 0,
  add: (amount) => {
    if (amount > 0) set((s) => ({ stars: s.stars + Math.floor(amount) }))
  },
  spend: (amount) => {
    const used = Math.max(0, Math.min(Math.floor(amount), get().stars))
    if (used > 0) set((s) => ({ stars: s.stars - used }))
    return used
  },
  exchange: (stars) => {
    const amount = Math.floor(stars)
    if (amount < EXCHANGE_MIN_STARS) return 'too_small'
    if (get().stars < amount) return 'insufficient'
    set((s) => ({ stars: s.stars - amount }))
    useWalletStore.getState().credit(exchangeStarsToMinor(amount))
    return 'ok'
  },
}),
    {
      name: 'sexydrop.stars',
      // v2: обнуление звёзд после исправления накруток
      version: 2,
      migrate: () => ({ stars: 0 }),
      storage: safeJsonStorage<Pick<StarsBalanceState, 'stars'>>(),
      partialize: (s) => ({ stars: s.stars }),
    },
  ),
)
