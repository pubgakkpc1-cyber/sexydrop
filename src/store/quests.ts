import { create } from 'zustand'
import { useProfileStore } from './profile'
import { useTicketsStore } from './tickets'

export type QuestMetric = 'rounds' | 'wagered' | 'pvpMatches'

export interface Quest {
  id: string
  title: string
  metric: QuestMetric
  /** Цель: для 'wagered' — в минорных единицах (10_000 = 10 GRAM). */
  target: number
  rewardTickets: number
}

/**
 * Каталог заданий (6.2). Прогресс считается из РЕАЛЬНОЙ статистики
 * (store/profile ← gamesHistory/pvpMatches); синтетика запрещена.
 * Награды — разовые промо-билеты (билет = 0.025 GRAM ценности при обмене).
 * Серверная проверка заданий по журналу транзакций — TIER 7 (6.6/7.6).
 */
export const QUESTS: readonly Quest[] = [
  { id: 'first-round', title: 'Первый раунд', metric: 'rounds', target: 1, rewardTickets: 10 },
  { id: 'rounds-10', title: 'Разогрев: 10 раундов', metric: 'rounds', target: 10, rewardTickets: 25 },
  { id: 'rounds-50', title: 'Ветеран: 50 раундов', metric: 'rounds', target: 50, rewardTickets: 100 },
  { id: 'wagered-10', title: 'Оборот 10 TON', metric: 'wagered', target: 10_000, rewardTickets: 50 },
  { id: 'wagered-100', title: 'Оборот 100 TON', metric: 'wagered', target: 100_000, rewardTickets: 500 },
  { id: 'pvp-5', title: 'Пять PVP-матчей', metric: 'pvpMatches', target: 5, rewardTickets: 75 },
] as const

interface QuestsState {
  claimed: Record<string, boolean>
  progressOf: (quest: Quest) => number
  claim: (id: string) => 'ok' | 'already_claimed' | 'not_enough'
}

export const useQuestsStore = create<QuestsState>((set, get) => ({
  claimed: {},

  progressOf: (quest) => {
    const profile = useProfileStore.getState()
    switch (quest.metric) {
      case 'rounds':
        return profile.rounds
      case 'wagered':
        return profile.wageredMinor
      case 'pvpMatches':
        return profile.pvpMatches
    }
  },

  claim: (id) => {
    const quest = QUESTS.find((candidate) => candidate.id === id)
    if (!quest) return 'not_enough'
    if (get().claimed[id]) return 'already_claimed'
    if (get().progressOf(quest) < quest.target) return 'not_enough'
    set((s) => ({ claimed: { ...s.claimed, [id]: true } }))
    useTicketsStore.getState().add(quest.rewardTickets)
    return 'ok'
  },
}))
