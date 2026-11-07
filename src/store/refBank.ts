import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeJsonStorage } from '../lib/persistStorage'
import { useStarsBalanceStore } from './starsBalance'

/** Забрать звёзды из банка можно, когда накопилось столько (как на сервере: BANK_MIN_CLAIM). */
export const BANK_MIN_CLAIM = 15

interface RefBankState {
  /** Звёзды за друзей, ещё не забранные на баланс звёзд. */
  stars: number
  /** Минимум для «Забрать» (присылает сервер). */
  min: number
  /** Положить в банк (dev/demo: друг прокрутил бесплатный кейс). */
  deposit: (stars: number) => void
  /** dev/demo: забрать всё на баланс звёзд, если накопилось от минимума. */
  claimLocal: () => 'ok' | 'too_small'
}

/**
 * Банк звёзд за друзей: +2 ★ за каждого друга, прокрутившего бесплатный кейс, копятся здесь
 * и переходят на баланс звёзд кнопкой «Забрать» — от 15 ★. В production состояние присылает
 * сервер (ref_bank в /api/me/state), забирает тоже сервер.
 */
export const useRefBankStore = create<RefBankState>()(
  persist(
    (set, get) => ({
      stars: 0,
      min: BANK_MIN_CLAIM,
      deposit: (stars) => {
        if (stars > 0) set((s) => ({ stars: s.stars + Math.floor(stars) }))
      },
      claimLocal: () => {
        const { stars, min } = get()
        if (stars < min) return 'too_small'
        useStarsBalanceStore.getState().add(stars)
        set({ stars: 0 })
        return 'ok'
      },
    }),
    {
      name: 'sexydrop.refbank',
      version: 1,
      storage: safeJsonStorage<Pick<RefBankState, 'stars'>>(),
      partialize: (s) => ({ stars: s.stars }),
    },
  ),
)
