import { create } from 'zustand'
import { FREE_COOLDOWNS, type FreeCaseId } from '../data/catalog'

interface FreeCasesState {
  /** Время последнего получения бесплатного кейса (epoch ms), demo-хранилище. */
  lastClaimAt: Record<FreeCaseId, number>
  claim: (id: FreeCaseId, at: number) => void
  nextAvailableAt: (id: FreeCaseId) => number
}

const STORAGE_KEY = 'giftcase.demo.freeCases'

function load(): Record<FreeCaseId, number> {
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

function save(state: Record<FreeCaseId, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* localStorage может быть недоступен — кулдауны просто не переживут перезагрузку */
  }
}

/**
 * Кулдауны бесплатных кейсов. В Demo Mode хранятся локально и честно помечены
 * как демо; в production право получения, кулдауны и лимиты проверяет backend
 * по серверному времени UTC (TIER 7) — клиентское время не является источником.
 */
export const useFreeCasesStore = create<FreeCasesState>((set, get) => ({
  lastClaimAt: load(),

  claim: (id, at) => {
    const next = { ...get().lastClaimAt, [id]: at }
    save(next)
    set({ lastClaimAt: next })
  },

  nextAvailableAt: (id) => {
    const last = get().lastClaimAt[id]
    return last === 0 ? 0 : last + FREE_COOLDOWNS[id]
  },
}))
