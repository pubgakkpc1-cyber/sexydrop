import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { adminFetch } from '../../lib/adminApi'
import { AdminBroadcastTab } from './AdminBroadcastTab'
import { AdminChancesTab } from './AdminChancesTab'
import { AdminGiveTab } from './AdminGiveTab'
import { AdminPlayersTab } from './AdminPlayersTab'
import { AdminStatsTab } from './AdminStatsTab'
import { AdminSystemTab } from './AdminSystemTab'
import { AdminWithdrawalsTab } from './AdminWithdrawalsTab'
import { ton } from './adminFormat'
import styles from './AdminConsole.module.css'

type SectionId = 'stats' | 'players' | 'chances' | 'broadcast' | 'give' | 'withdrawals' | 'system'

interface Section {
  id: SectionId
  title: string
  hint: string
  icon: ReactNode
  view: () => ReactNode
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const SECTIONS: readonly Section[] = [
  { id: 'stats', title: 'Обзор', hint: 'Игроки, оборот, прибыль казны, игры и кейсы', icon: icon('M4 20V10M10 20V4M16 20v-7M22 20H2'), view: () => <AdminStatsTab /> },
  { id: 'players', title: 'Игроки', hint: 'Каждый игрок: пополнения, ставки, выигрыши, подарки, друзья', icon: icon('M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 21c0-4 3.6-6 8-6s8 2 8 6'), view: () => <AdminPlayersTab /> },
  { id: 'chances', title: 'Шансы кейсов', hint: 'Впишите шанс приза, смотрите RTP и прибыль', icon: icon('M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4'), view: () => <AdminChancesTab /> },
  { id: 'broadcast', title: 'Рассылка', hint: 'Сообщение от бота всем или части игроков', icon: icon('M3 11l18-8-8 18-2-8-8-2Z'), view: () => <AdminBroadcastTab /> },
  { id: 'give', title: 'Выдача TON', hint: 'Начислить TON игроку по юзернейму', icon: icon('M12 3v18M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7'), view: () => <AdminGiveTab /> },
  { id: 'withdrawals', title: 'Выводы', hint: 'Заявки игроков на вывод подарков', icon: icon('M12 3v12M7 10l5 5 5-5M5 21h14'), view: () => <AdminWithdrawalsTab /> },
  { id: 'system', title: 'Система', hint: 'Бот, вебхук, способы пополнения, каналы', icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z'), view: () => <AdminSystemTab /> },
]

interface QuickStats {
  users_total: number
  users_24h: number
  users_new_24h: number
  deposited_total?: number
}

interface AdminPanelModalProps {
  open: boolean
  onClose: () => void
}

/** Админка: отдельное окно на весь экран. Главная — карточки разделов, внутри раздела — кнопка «Назад». */
export function AdminPanelModal({ open, onClose }: AdminPanelModalProps) {
  const [section, setSection] = useState<SectionId | null>(null)
  const [quick, setQuick] = useState<QuickStats | null>(null)

  useEffect(() => {
    if (!open) return
    setSection(null)
    let dead = false
    void adminFetch<QuickStats>('/api/admin/stats').then((r) => {
      if (!dead && r.ok) setQuick(r.data)
    })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dead = true
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const current = SECTIONS.find((s) => s.id === section) ?? null

  return createPortal(
    <div className={styles.screen} role="dialog" aria-modal="true" aria-label="Панель администратора">
      <header className={styles.bar}>
        {current ? (
          <button type="button" className={styles.barBtn} onClick={() => setSection(null)} aria-label="Назад к разделам">
            ‹ Назад
          </button>
        ) : (
          <span className={styles.badge}>Админ · @zapixxgarant</span>
        )}
        <h2 className={styles.titleBar}>{current ? current.title : 'Админка'}</h2>
        <button type="button" className={styles.barBtn} onClick={onClose} aria-label="Закрыть админку">
          Закрыть
        </button>
      </header>

      <main className={styles.content}>
        {current ? (
          current.view()
        ) : (
          <>
            {quick && (
              <div className={styles.summary}>
                <div>
                  <span className={styles.sumNum}>{quick.users_total}</span>
                  <span className={styles.sumLabel}>пользователей в боте</span>
                </div>
                <div>
                  <span className={styles.sumNum}>{quick.users_24h}</span>
                  <span className={styles.sumLabel}>заходили за 24 ч</span>
                </div>
                <div>
                  <span className={styles.sumNum}>+{quick.users_new_24h}</span>
                  <span className={styles.sumLabel}>новых за 24 ч</span>
                </div>
                <div>
                  <span className={styles.sumNum}>{ton(quick.deposited_total ?? 0)}</span>
                  <span className={styles.sumLabel}>пополнено всего</span>
                </div>
              </div>
            )}
            <nav className={styles.grid} aria-label="Разделы админки">
              {SECTIONS.map((s) => (
                <button key={s.id} type="button" className={styles.card} onClick={() => setSection(s.id)}>
                  <span className={styles.cardIcon}>{s.icon}</span>
                  <span className={styles.titleCard}>{s.title}</span>
                  <span className={styles.cardHint}>{s.hint}</span>
                </button>
              ))}
            </nav>
          </>
        )}
      </main>
    </div>,
    document.body,
  )
}
