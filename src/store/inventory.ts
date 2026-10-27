import { create } from 'zustand'

export type InventorySource =
  | 'case-open'
  | 'free-case'
  | 'upgrade'
  | 'craft'
  | 'raffle'
  | 'crash-drop'
  | 'crash-win'

export interface InventoryItem {
  uid: string
  giftId: string
  acquiredAt: number
  source: InventorySource
}

export interface InventoryEvent {
  at: number
  type: 'acquire' | 'remove'
  uid: string
  giftId: string
  detail: string
}

interface InventoryState {
  items: InventoryItem[]
  /** Журнал изменений инвентаря (основа 3.5). */
  history: InventoryEvent[]
  addGifts: (giftIds: readonly string[], source: InventorySource) => InventoryItem[]
  removeUids: (uids: readonly string[], reason: string) => void
}

let uidSeq = 0
function makeUid(): string {
  uidSeq += 1
  return `item-${Date.now().toString(36)}-${uidSeq}`
}

/**
 * Инвентарь. В production операции валидируются сервером и выполняются
 * атомарно с балансом (TIER 7); здесь — demo-хранилище с тем же контрактом.
 */
export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  history: [],

  addGifts: (giftIds, source) => {
    const now = Date.now()
    const added = giftIds.map((giftId) => ({
      uid: makeUid(),
      giftId,
      acquiredAt: now,
      source,
    }))
    set((state) => ({
      items: [...state.items, ...added],
      history: [
        ...added.map((item) => ({
          at: now,
          type: 'acquire' as const,
          uid: item.uid,
          giftId: item.giftId,
          detail: source,
        })),
        ...state.history,
      ],
    }))
    return added
  },

  removeUids: (uids, reason) => {
    const uidSet = new Set(uids)
    const now = Date.now()
    set((state) => {
      const removed = state.items.filter((item) => uidSet.has(item.uid))
      if (removed.length !== uidSet.size) {
        throw new Error('Attempt to remove unknown inventory items')
      }
      return {
        items: state.items.filter((item) => !uidSet.has(item.uid)),
        history: [
          ...removed.map((item) => ({
            at: now,
            type: 'remove' as const,
            uid: item.uid,
            giftId: item.giftId,
            detail: reason,
          })),
          ...state.history,
        ],
      }
    })
  },
}))
