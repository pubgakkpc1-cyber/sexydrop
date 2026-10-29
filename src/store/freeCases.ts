import { create } from 'zustand'
import type { FreeCaseId } from '../data/catalog'

export interface FreeQuestState {
  pendingReward: {
    giftId: string
    uid: string
    wonAt: number
    expiresAt: number
  } | null
  referralsJoined: number
  channelsSubscribed: number
  spinsWithPremium: number
}

interface FreeCasesState {
  /** Время последнего получения бесплатного кейса (epoch ms), demo-хранилище. */
  lastClaimAt: Record<FreeCaseId, number>
  /** Состояние квеста для бесплатного кейса «free» (с заданиями на 5 TG Premium друзей). */
  quest: FreeQuestState
  claim: (id: FreeCaseId, at: number) => void
  nextAvailableAt: (id: FreeCaseId, now?: number) => number
  isCaseAvailable: (id: FreeCaseId, now?: number) => boolean
  setQuestPendingReward: (giftId: string, uid: string, wonAt?: number) => void
  incrementQuestStep: (step: 1 | 2 | 3) => void
  simulateFriendJoin: () => void
  clearQuestReward: () => void
  isQuestCompleted: () => boolean
}

const STORAGE_KEY = 'giftcase.demo.freeCases'
const QUEST_STORAGE_KEY = 'giftcase.demo.freeQuest'

/**
 * Расчёт ежедневного обновления в 23:00 по МСК (UTC+3 / 20:00 UTC).
 * Каждый день ровно в 23:00:00 МСК сундук сбрасывается и становится доступен снова.
 */
export function getMsk23ResetInfo(nowMs: number = Date.now()): {
  lastResetMs: number
  nextResetMs: number
  remainingMs: number
  isAvailable: (lastClaimMs: number) => boolean
} {
  const MSK_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC+3
  // Сдвигаем на часовой пояс МСК
  const mskTime = new Date(nowMs + MSK_OFFSET_MS)

  const year = mskTime.getUTCFullYear()
  const month = mskTime.getUTCMonth()
  const date = mskTime.getUTCDate()

  // Время 23:00:00 MSK текущего дня в эпохе UTC
  const today23MskEpoch = Date.UTC(year, month, date, 23, 0, 0, 0) - MSK_OFFSET_MS

  let lastResetMs: number
  let nextResetMs: number

  if (nowMs >= today23MskEpoch) {
    // Уже прошло 23:00 МСК сегодня — текущий период начался сегодня в 23:00, следующий завтра в 23:00
    lastResetMs = today23MskEpoch
    nextResetMs = today23MskEpoch + 24 * 60 * 60 * 1000
  } else {
    // Ещё до 23:00 МСК — текущий период начался вчера в 23:00, следующий сегодня в 23:00
    lastResetMs = today23MskEpoch - 24 * 60 * 60 * 1000
    nextResetMs = today23MskEpoch
  }

  const remainingMs = Math.max(0, nextResetMs - nowMs)

  return {
    lastResetMs,
    nextResetMs,
    remainingMs,
    // Доступен, если последнее открытие было ДО наступления последнего сброса в 23:00 МСК
    isAvailable: (lastClaimMs: number) => lastClaimMs < lastResetMs,
  }
}

function loadLastClaim(): Record<FreeCaseId, number> {
  const empty: Record<FreeCaseId, number> = { free: 0, free24: 0 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Record<FreeCaseId, number>>
    return { ...empty, free: parsed.free ?? 0, free24: parsed.free24 ?? 0 }
  } catch {
    return empty
  }
}

function loadQuest(): FreeQuestState {
  const defaultQuest: FreeQuestState = {
    pendingReward: null,
    referralsJoined: 0,
    channelsSubscribed: 0,
    spinsWithPremium: 0,
  }
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY)
    if (!raw) return defaultQuest
    const parsed = JSON.parse(raw) as Partial<FreeQuestState>
    return {
      ...defaultQuest,
      pendingReward: parsed.pendingReward ?? null,
      referralsJoined: parsed.referralsJoined ?? 0,
      channelsSubscribed: parsed.channelsSubscribed ?? 0,
      spinsWithPremium: parsed.spinsWithPremium ?? 0,
    }
  } catch {
    return defaultQuest
  }
}

function save(claims: Record<FreeCaseId, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(claims))
  } catch {
    /* localStorage может быть недоступен */
  }
}

function saveQuest(quest: FreeQuestState): void {
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(quest))
  } catch {
    /* localStorage может быть недоступен */
  }
}

export const useFreeCasesStore = create<FreeCasesState>((set, get) => ({
  lastClaimAt: loadLastClaim(),
  quest: loadQuest(),

  claim: (id, at) => {
    const next = { ...get().lastClaimAt, [id]: at }
    save(next)
    set({ lastClaimAt: next })
  },

  isCaseAvailable: (id, now = Date.now()) => {
    const last = get().lastClaimAt[id]
    if (last === 0) return true
    const resetInfo = getMsk23ResetInfo(now)
    return resetInfo.isAvailable(last)
  },

  nextAvailableAt: (id, now = Date.now()) => {
    const last = get().lastClaimAt[id]
    if (last === 0) return 0
    const resetInfo = getMsk23ResetInfo(now)
    if (resetInfo.isAvailable(last)) {
      return 0
    }
    return resetInfo.nextResetMs
  },

  setQuestPendingReward: (giftId, uid, wonAt = Date.now()) => {
    // 3 дня на выполнение задания (72 часа)
    const expiresAt = wonAt + 3 * 24 * 60 * 60 * 1000
    const nextQuest: FreeQuestState = {
      pendingReward: { giftId, uid, wonAt, expiresAt },
      referralsJoined: 0,
      channelsSubscribed: 0,
      spinsWithPremium: 0,
    }
    saveQuest(nextQuest)
    set({ quest: nextQuest })
  },

  incrementQuestStep: (step) => {
    const q = { ...get().quest }
    if (step === 1 && q.referralsJoined < 5) q.referralsJoined++
    if (step === 2 && q.channelsSubscribed < 5) q.channelsSubscribed++
    if (step === 3 && q.spinsWithPremium < 5) q.spinsWithPremium++
    saveQuest(q)
    set({ quest: q })
  },

  simulateFriendJoin: () => {
    // Для демо-тестирования: засчитывает одного премиум-друга по всем трем шагам
    const q = { ...get().quest }
    if (q.referralsJoined < 5) q.referralsJoined++
    if (q.channelsSubscribed < 5) q.channelsSubscribed++
    if (q.spinsWithPremium < 5) q.spinsWithPremium++
    saveQuest(q)
    set({ quest: q })
  },

  clearQuestReward: () => {
    const nextQuest: FreeQuestState = {
      pendingReward: null,
      referralsJoined: 0,
      channelsSubscribed: 0,
      spinsWithPremium: 0,
    }
    saveQuest(nextQuest)
    set({ quest: nextQuest })
  },

  isQuestCompleted: () => {
    const q = get().quest
    return (
      q.referralsJoined >= 5 &&
      q.channelsSubscribed >= 5 &&
      q.spinsWithPremium >= 5 &&
      q.pendingReward !== null &&
      Date.now() < q.pendingReward.expiresAt
    )
  },
}))
