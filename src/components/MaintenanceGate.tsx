import { useEffect, useState, type ReactNode } from 'react'
import { getWebApp, openTelegramUrl } from '../lib/telegram'
import styles from './MaintenanceGate.module.css'

type Gate = 'loading' | 'on' | 'off'

async function check(): Promise<boolean> {
  const initData = (getWebApp() as unknown as { initData?: string } | undefined)?.initData
  const res = await fetch('/api/maintenance', {
    cache: 'no-store',
    headers: initData ? { 'X-Telegram-Init-Data': initData } : undefined,
  })
  if (!res.ok) return false
  const body = (await res.json()) as { on?: boolean; admin?: boolean }
  return Boolean(body.on) && !body.admin
}

/**
 * Пока на сервере включены технические работы, вместо приложения — экран на весь экран (вход по любой ссылке).
 * Админ проходит внутрь. Когда работы выключат, экран сам обновляет страницу.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>('loading')

  useEffect(() => {
    let dead = false
    const timeout = window.setTimeout(() => !dead && setGate((g) => (g === 'loading' ? 'off' : g)), 3000)
    check()
      .then((on) => !dead && setGate(on ? 'on' : 'off'))
      .catch(() => !dead && setGate('off'))
    return () => {
      dead = true
      window.clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (gate !== 'on') return
    const t = window.setInterval(() => {
      void check()
        .then((on) => {
          if (!on) window.location.reload()
        })
        .catch(() => undefined)
    }, 30_000)
    return () => window.clearInterval(t)
  }, [gate])

  if (gate === 'loading') return <div className={styles.blank} />
  if (gate === 'on') {
    return (
      <div className={styles.screen} role="alert">
        <div className={styles.icon} aria-hidden>
          🛠
        </div>
        <h1 className={styles.title}>Технические работы</h1>
        <p className={styles.lead}>Бот временно не работает: мы обновляем SEXY DROP.</p>
        <p className={styles.big}>Это займёт 1–2 дня</p>
        <ul className={styles.list}>
          <li>Баланс, подарки и звёзды сохранены</li>
          <li>Игры, кейсы, вывод и задания недоступны до конца работ</li>
          <li>Ничего делать не нужно — просто подождите</li>
        </ul>
        <button type="button" className={styles.btn} onClick={() => openTelegramUrl('https://t.me/SexyDrop_official')}>
          Канал @SexyDrop_official
        </button>
      </div>
    )
  }
  return <>{children}</>
}
