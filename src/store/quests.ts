import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeJsonStorage } from '../lib/persistStorage'
import { useProfileStore } from './profile'
import { useStarsBalanceStore } from './starsBalance'

export type QuestMetric = 'casesOpened' | 'minesRounds' | 'upgrades' | 'wagered' | 'friendDeposits'

export interface Quest {
  id: string
  title: string
  metric: QuestMetric
  /** Цель: для 'wagered' — в минорных единицах (10_000 = 10 GRAM). */
  target: number
  /** Награда в Stars (копятся на звёздном балансе, обмениваются на TON). */
  rewardStars: number
}

/**
 * Каталог заданий (6.2). Прогресс считается из РЕАЛЬНОЙ статистики
 * (store/profile ← gamesHistory/pvpMatches); синтетика запрещена.
 * Награды — разовые бонусы в Stars (обмен на TON в «Заработке»).
 * Серверная проверка заданий по журналу транзакций — TIER 7 (6.6/7.6).
 */
export const QUESTS: readonly Quest[] = [
  { id: 'open-3-cases', title: 'Открой 3 платных кейса', metric: 'casesOpened', target: 3, rewardStars: 15 },
  { id: 'mines-10', title: 'Сыграй 10 раз в Мины', metric: 'minesRounds', target: 10, rewardStars: 15 },
  { id: 'upgrade-1', title: 'Сделай апгрейд', metric: 'upgrades', target: 1, rewardStars: 15 },
  { id: 'wagered-10', title: 'Сделай ставок на 10 TON', metric: 'wagered', target: 10_000, rewardStars: 50 },
  { id: 'friend-deposit', title: 'Друг по твоей ссылке пополнил баланс', metric: 'friendDeposits', target: 1, rewardStars: 50 },
] as const

interface QuestsState {
  claimed: Record<string, boolean>
  progressOf: (quest: Quest) => number
  claim: (id: string) => 'ok' | 'already_claimed' | 'not_enough'
}

export const useQuestsStore = create<QuestsState>()(
  persist(
    (set, get) => ({
  claimed: {},

  progressOf: (quest) => {
    const profile = useProfileStore.getState()
    switch (quest.metric) {
      case 'casesOpened':
        return profile.casesOpened
      case 'minesRounds':
        return profile.minesRounds
      case 'upgrades':
        return profile.upgrades
      case 'wagered':
        return profile.wageredMinor
      case 'friendDeposits':
        return profile.friendDeposits
    }
  },

  claim: (id) => {
    const quest = QUESTS.find((candidate) => candidate.id === id)
    if (!quest) return 'not_enough'
    if (get().claimed[id]) return 'already_claimed'
    if (get().progressOf(quest) < quest.target) return 'not_enough'
    set((s) => ({ claimed: { ...s.claimed, [id]: true } }))
    useStarsBalanceStore.getState().add(quest.rewardStars)
    return 'ok'
  },
}),
    {
      name: 'sexydrop.quests',
      version: 1,
      storage: safeJsonStorage<Pick<QuestsState, 'claimed'>>(),
      partialize: (s) => ({ claimed: s.claimed }),
    },
  ),
)
