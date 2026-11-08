import { create } from 'zustand'

export interface QuestStep {
  done: number
  target: number
}

/** Шаги замка NFT из FREE (с сервера): друзья, пополнение (minor TON), игры. */
export interface QuestStepsState {
  steps: { friends: QuestStep; deposit: QuestStep; games: QuestStep; completed: boolean } | null
}

export const useQuestStepsStore = create<QuestStepsState>(() => ({ steps: null }))
