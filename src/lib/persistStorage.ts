import { createJSONStorage, type PersistStorage } from 'zustand/middleware'

/**
 * Безопасное хранилище для zustand persist: localStorage может быть недоступен
 * (приватный режим, заблокированные данные сайта) — тогда состояние просто не сохраняется.
 */
export function safeJsonStorage<T>(): PersistStorage<T> | undefined {
  return createJSONStorage<T>(() => ({
    getItem: (key) => {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem: (key, value) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* нет места или доступа — пропускаем */
      }
    },
    removeItem: (key) => {
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* no-op */
      }
    },
  }))
}
