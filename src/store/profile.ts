import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeJsonStorage } from '../lib/persistStorage'
import type { Minor } from '../lib/money'

export interface ProfileStats {
  rounds: number
  /** Оборот — суммы ставок в GRAM (ставки подарками не входят, честно помечено). */
  wageredMinor: Minor
  /** Чистый результат всех раундов (со знаком). */
  netMinor: Minor
  pvpMatches: number
}

interface ProfileState extends ProfileStats {
  record: (entry: { stakeMinor?: Minor; deltaMinor: Minor; isPvp?: boolean }) => void
}

/**
 * Кумулятивная статистика реальной игры (6.1/6.2). Пишется ТОЛЬКО из
 * `gamesHistory.push` и `pvpMatches.push` — единственных мест, куда demo-сервисы
 * записывают результаты: считается исключительно реальная игра пользователя,
 * синтетика запрещена. Оборот в GRAM конвертируется в билеты лояльности
 * (store/tickets). Серверный профиль и журнал — TIER 7 (7.2/7.3).
 */
export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
  rounds: 0,
  wageredMinor: 0,
  netMinor: 0,
  pvpMatches: 0,

  record: (entry) => {
    set((state) => ({
      rounds: state.rounds + 1,
      pvpMatches: state.pvpMatches + (entry.isPvp === true ? 1 : 0),
      wageredMinor: state.wageredMinor + (entry.stakeMinor ?? 0),
      netMinor: state.netMinor + entry.deltaMinor,
    }))
  },
}),
    {
      name: 'sexydrop.profile',
      version: 1,
      storage: safeJsonStorage<Pick<ProfileState, 'rounds' | 'wageredMinor' | 'netMinor' | 'pvpMatches'>>(),
      partialize: (s) => ({ rounds: s.rounds, wageredMinor: s.wageredMinor, netMinor: s.netMinor, pvpMatches: s.pvpMatches }),
    },
  ),
)
