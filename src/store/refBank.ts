import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeJsonStorage } from '../lib/persistStorage'
import { useStarsBalanceStore } from './starsBalance'

/** Забрать звёзды из банка можно, когда накопилось столько (как на сервере: BANK_MIN_CLAIM). */
export const BANK_MIN_CLAIM = 15

/** Чат SEXY DROP: друг засчитывается, только если он в этом чате (адрес присылает сервер). */
export const REF_CHAT_URL = 'https://t.me/+hQUjqYtgmTA2NmQ0'

/** Запись мини-истории банка: d — сколько звёзд (+/−, 0 — без звёзд), t — что случилось. */
export interface BankHistoryEntry {
  at: number
  d: number
  t: string
}

interface RefBankState {
  /** Звёзды за друзей, ещё не забранные на баланс звёзд. */
  stars: number
  /** Минимум для «Забрать» (присылает сервер). */
  min: number
  /** Ссылка на чат SEXY DROP. */
  chatUrl: string
  /** Мини-история: друг прокрутил кейс, не в чате, вернулся, забрали. */
  history: BankHistoryEntry[]
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
      chatUrl: REF_CHAT_URL,
      history: [],
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
