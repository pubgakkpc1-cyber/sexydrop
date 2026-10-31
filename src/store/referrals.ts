import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeJsonStorage } from '../lib/persistStorage'
import { REFERRAL_BONUS_STARS, sendReferralEvent, type ReferralEvent } from '../lib/referral'
import { useStarsBalanceStore } from './starsBalance'

interface ReferralsState {
  /** Кто пригласил этого пользователя (Telegram ID из start_param), если пришёл по ссылке. */
  referredBy: string | null
  /** Уведомление пригласившему уже поставлено в очередь (награда даётся один раз). */
  qualified: boolean
  /** События, которые ещё не доставлены пригласившему (ждут серверного канала). */
  outbox: ReferralEvent[]
  /** Друзья, за которых уже начислены звёзды: friendId → время и сумма. */
  credited: Record<string, { at: number; stars: number }>

  /** Запомнить пригласившего (только первый раз и не себя). */
  setReferrer: (referrerId: string, myId: string | undefined) => void
  /** Этот пользователь (друг) открыл бесплатный кейс — пригласивший получит награду. */
  onFreeCaseOpened: (myId: string | undefined) => void
  /** Пригласивший получил событие по другу: +2 ★ мгновенно, один раз за друга. */
  creditFriend: (friendId: string) => boolean
  /** Отправить накопленные события, когда канал появился. */
  flushOutbox: () => void
}

export const useReferralsStore = create<ReferralsState>()(
  persist(
    (set, get) => ({
      referredBy: null,
      qualified: false,
      outbox: [],
      credited: {},

      setReferrer: (referrerId, myId) => {
        if (get().referredBy !== null) return
        if (myId !== undefined && myId === referrerId) return // сам себя пригласить нельзя
        set({ referredBy: referrerId })
      },

      onFreeCaseOpened: (myId) => {
        const { referredBy, qualified } = get()
        if (referredBy === null || qualified || myId === undefined) return
        const event: ReferralEvent = { referrerId: referredBy, friendId: myId, at: Date.now() }
        const sent = sendReferralEvent(event)
        set((s) => ({ qualified: true, outbox: sent ? s.outbox : [...s.outbox, event] }))
      },

      creditFriend: (friendId) => {
        if (get().credited[friendId]) return false
        set((s) => ({
          credited: { ...s.credited, [friendId]: { at: Date.now(), stars: REFERRAL_BONUS_STARS } },
        }))
        useStarsBalanceStore.getState().add(REFERRAL_BONUS_STARS)
        return true
      },

      flushOutbox: () => {
        const rest = get().outbox.filter((e) => !sendReferralEvent(e))
        set({ outbox: rest })
      },
    }),
    {
      name: 'sexydrop.referrals',
      version: 1,
      storage: safeJsonStorage<Pick<ReferralsState, 'referredBy' | 'qualified' | 'outbox' | 'credited'>>(),
      partialize: (s) => ({ referredBy: s.referredBy, qualified: s.qualified, outbox: s.outbox, credited: s.credited }),
    },
  ),
)

/** Сумма звёзд, заработанных на рефералах. */
export function referralStarsEarned(credited: ReferralsState['credited']): number {
  return Object.values(credited).reduce((sum, c) => sum + c.stars, 0)
}
