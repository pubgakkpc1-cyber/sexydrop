import { create } from 'zustand'

export interface TagQuestState {
  tag: string
  reward: number
  stage: 1 | 2 | 3
  started_at: number | null
  ready_at: number | null
  expires_at: number | null
  total_claimed: number
}

export const useTagQuestStore = create<{ quest: TagQuestState | null }>(() => ({ quest: null }))
