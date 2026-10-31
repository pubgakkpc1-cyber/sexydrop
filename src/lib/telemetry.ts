import { getWebApp } from './telegram'

export type TelemetryEvent =
  | { type: 'open' }
  | { type: 'game'; game: string; stake: number; delta: number }
  | { type: 'case'; case: string; price: number; prize: number }
  | { type: 'deposit'; method: 'ton' | 'crypto' | 'stars' | 'demo'; amount: number }

/**
 * Отправляет событие в серверную статистику админ-панели. Личность берётся на сервере из
 * подписанного initData; вне Telegram (нет initData) и при ошибках сети событие тихо пропускается,
 * игре это не мешает.
 */
export function track(event: TelemetryEvent): void {
  const initData = (getWebApp() as unknown as { initData?: string } | undefined)?.initData
  if (!initData) return
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: initData, event }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    /* статистика не критична */
  }
}
