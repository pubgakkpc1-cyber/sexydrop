/**
 * Идемпотентность операций (контракт TIER 7): тот же client_request_id → тот же
 * результат. Память ограничена: карта помнит последние N запросов (вытеснение
 * по возрасту вставки). В production роль выполняет БД с TTL-индексом;
 * здесь тот же контракт для demo-сервисов и сим-тестов (4.10).
 */
export interface RequestMemo<T> {
  get: (key: string) => T | undefined
  set: (key: string, value: T) => void
  clear: () => void
}

const DEFAULT_CAPACITY = 4096

export function createRequestMemo<T>(capacity = DEFAULT_CAPACITY): RequestMemo<T> {
  const map = new Map<string, T>()
  return {
    get: (key) => map.get(key),
    set: (key, value) => {
      if (map.has(key)) {
        map.set(key, value) // обновление без изменения возраста
        return
      }
      map.set(key, value)
      if (map.size > capacity) {
        const oldest = map.keys().next().value
        if (oldest !== undefined) map.delete(oldest)
      }
    },
    clear: () => map.clear(),
  }
}
