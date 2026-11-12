import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { adminFetch } from '../../lib/adminApi'
import { cx } from '../../lib/cx'
import { AdminBroadcastTab } from './AdminBroadcastTab'
import { AdminChancesTab } from './AdminChancesTab'
import { AdminGiveTab } from './AdminGiveTab'
import { AdminPlayersTab } from './AdminPlayersTab'
import { AdminStatsTab } from './AdminStatsTab'
import { AdminSystemTab } from './AdminSystemTab'
import { AdminWithdrawalsTab } from './AdminWithdrawalsTab'
import { ago, signedTon, ton } from './adminFormat'
import { AdminErrorBoundary } from './AdminErrorBoundary'
import styles from './AdminConsole.module.css'

type SectionId = 'stats' | 'players' | 'chances' | 'broadcast' | 'give' | 'withdrawals' | 'system'

interface Section {
  id: SectionId
  group: 'people' | 'settings'
  title: string
  /** Коротко на карточке: что внутри. */
  hint: string
  /** Подробно вверху раздела: что тут делать — простыми словами. */
  intro: string
  icon: ReactNode
  view: () => ReactNode
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const SECTIONS: readonly Section[] = [
  {
    id: 'stats',
    group: 'people',
    title: 'Обзор',
    hint: 'Игроки, деньги, графики',
    intro:
      'Общая картина проекта: сколько людей пришло и играет, сколько пополнили, сколько заработало казино. Зелёное — хорошо для казино, красное — казино в минусе.',
    icon: icon('M4 20V10M10 20V4M16 20v-7M22 20H2'),
    view: () => <AdminStatsTab />,
  },
  {
    id: 'players',
    group: 'people',
    title: 'Игроки',
    hint: 'Поиск и карточка игрока',
    intro:
      'Список всех, кто открывал приложение. Найдите игрока по имени, @юзернейму или ID и нажмите на него: увидите баланс, пополнения, ставки, выигрыши, подарки и друзей.',
    icon: icon('M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 21c0-4 3.6-6 8-6s8 2 8 6'),
    view: () => <AdminPlayersTab />,
  },
  {
    id: 'withdrawals',
    group: 'people',
    title: 'Выводы',
    hint: 'Заявки на подарки',
    intro:
      'Игроки, которые нажали «Вывести» на подарке. Отправьте подарок в Telegram и нажмите «Выдал». Если отправить не получилось — «Вернуть»: подарок снова появится у игрока.',
    icon: icon('M12 3v12M7 10l5 5 5-5M5 21h14'),
    view: () => <AdminWithdrawalsTab />,
  },
  {
    id: 'give',
    group: 'people',
    title: 'Выдача TON',
    hint: 'Начислить или вычесть TON',
    intro:
      'Начислить TON на баланс игрока по его @юзернейму. Игрок должен хотя бы раз открыть приложение. Деньги появятся у него сразу.',
    icon: icon('M12 3v18M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7'),
    view: () => <AdminGiveTab />,
  },
  {
    id: 'chances',
    group: 'settings',
    title: 'Шансы кейсов',
    hint: 'Что и как часто выпадает',
    intro:
      'Шанс каждого приза в каждом кейсе. Меняйте проценты и смотрите внизу: RTP — сколько из потраченного возвращается игрокам, остальное — прибыль казино.',
    icon: icon('M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4'),
    view: () => <AdminChancesTab />,
  },
  {
    id: 'broadcast',
    group: 'settings',
    title: 'Рассылка',
    hint: 'Рассылка от бота',
    intro:
      'Сообщение от бота всем игрокам или части. Сначала отправьте тест себе, проверьте, как выглядит, потом — всем.',
    icon: icon('M3 11l18-8-8 18-2-8-8-2Z'),
    view: () => <AdminBroadcastTab />,
  },
  {
    id: 'system',
    group: 'settings',
    title: 'Система',
    hint: 'Банк, цены, технические',
    intro:
      'Работает ли бот и способы пополнения. Здесь же опасные кнопки: сброс прибыли и обнуление балансов — они спрашивают подтверждение.',
    icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z'),
    view: () => <AdminSystemTab />,
  },
]

const GROUPS: ReadonlyArray<{ id: Section['group']; title: string }> = [
  { id: 'people', title: 'Люди и деньги' },
  { id: 'settings', title: 'Настройки' },
]

interface QuickStats {
  users_total: number
  users_24h: number
  users_new_24h: number
  house_profit?: number
  deposited_total?: number
  deposited_24h?: number
  balances_total?: number
  withdrawals_pending?: number
  locked_gifts?: number
  profit_since?: number | null
}

interface AdminPanelModalProps {
  open: boolean
  onClose: () => void
}

/** 1 игрок ждёт, 3 игрока ждут, 5 игроков ждут. */
function playersWait(n: number): string {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return 'игрок ждёт'
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'игрока ждут'
  return 'игроков ждут'
}

/** Одна понятная цифра на главной: подпись, число и пояснение мелко. */
function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <strong className={cx(styles.kpiValue, tone && styles[tone])}>{value}</strong>
      <span className={styles.kpiNote}>{note}</span>
    </div>
  )
}

/** Админка: отдельное окно на весь экран. Главная — сводка и разделы, внутри раздела — «Назад» и подсказка. */
export function AdminPanelModal({ open, onClose }: AdminPanelModalProps) {
  const [section, setSection] = useState<SectionId | null>(null)
  const [quick, setQuick] = useState<QuickStats | null>(null)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)

  const loadQuick = useCallback(() => {
    let dead = false
    void adminFetch<QuickStats>('/api/admin/stats').then((r) => {
      if (dead) return
      if (r.ok) {
        setQuick(r.data)
        setQuickError(null)
        setLoadedAt(Math.floor(Date.now() / 1000))
      } else setQuickError(r.error)
    })
    return () => {
      dead = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setSection(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  // вернулись из раздела на главную — свежие цифры
  useEffect(() => {
    if (open && section === null) return loadQuick()
  }, [open, section, loadQuick])

  if (!open) return null
  const current = SECTIONS.find((s) => s.id === section) ?? null
  const pending = quick?.withdrawals_pending ?? 0
  const profit = quick?.house_profit ?? 0

  return createPortal(
    <div className={styles.screen} role="dialog" aria-modal="true" aria-label="Панель администратора">
      <header className={styles.bar}>
        {current ? (
          <button type="button" className={cx(styles.barBtn, styles.barBtnBack)} onClick={() => setSection(null)} aria-label="Назад к разделам">
            <span aria-hidden>‹</span> Назад
          </button>
        ) : (
          <span className={styles.badge}>Админ</span>
        )}
        <h2 className={styles.titleBar}>{current ? current.title : 'Админка'}</h2>
        <button type="button" className={cx(styles.barBtn, styles.barBtnClose)} onClick={onClose} aria-label="Закрыть админку">
          <span aria-hidden>✕</span>
          <span className={styles.barBtnText}>Закрыть</span>
        </button>
      </header>

      <main className={styles.content}>
        {current ? (
          <>
            <AdminErrorBoundary resetKey={current.id} onBack={() => setSection(null)}>
              {current.view()}
            </AdminErrorBoundary>
          </>
        ) : (
          <>
            <div className={styles.hello}>
              <h1 className={styles.titleHello}>Что сейчас происходит</h1>
              <button type="button" className={styles.refreshBtn} onClick={() => loadQuick()}>
                ↻ Обновить
              </button>
            </div>
            <p className={styles.helloSub}>{loadedAt ? `Обновлено ${ago(loadedAt)}` : 'Загружаем…'}</p>

            {quickError && <div className={cx(styles.alert, styles.alertBad)}>Не удалось загрузить цифры: {quickError}</div>}

            {pending > 0 && (
              <button type="button" className={cx(styles.alert, styles.alertBad)} onClick={() => setSection('withdrawals')}>
                <span className={styles.alertIcon}>!</span>
                <span className={styles.alertText}>
                  <b>{pending} {playersWait(pending)} вывод подарка</b>
                </span>
                <span className={styles.alertGo}>Открыть ›</span>
              </button>
            )}
            {quick && profit < 0 && (
              <button type="button" className={cx(styles.alert, styles.alertWarn)} onClick={() => setSection('stats')}>
                <span className={styles.alertIcon}>↓</span>
                <span className={styles.alertText}>
                  <b>Казино в минусе на {ton(-profit)}</b>
                </span>
                <span className={styles.alertGo}>Обзор ›</span>
              </button>
            )}

            {quick && (
              <div className={styles.kpiGrid}>
                <Kpi label="Пользователей" value={String(quick.users_total)} note="всего в боте" />
                <Kpi label="Новых за сутки" value={`+${quick.users_new_24h}`} note="за 24 часа" />
                <Kpi label="Заходили за сутки" value={String(quick.users_24h)} note="были в приложении" />
                <Kpi label="Пополнили за сутки" value={ton(quick.deposited_24h ?? 0)} note={`всего ${ton(quick.deposited_total ?? 0)}`} />
                <Kpi
                  label="Прибыль казино"
                  value={signedTon(profit)}
                  tone={profit > 0 ? 'good' : profit < 0 ? 'bad' : undefined}
                  note={
                    quick.profit_since
                      ? `с ${new Date(quick.profit_since * 1000).toLocaleDateString('ru-RU')}`
                      : 'за всё время'
                  }
                />
                <Kpi label="Лежит у игроков" value={ton(quick.balances_total ?? 0)} note="TON на балансах" />
              </div>
            )}

            <nav aria-label="Разделы админки">
              {GROUPS.map((g) => (
                <section key={g.id} className={styles.group}>
                  <h3 className={styles.groupTitle}>{g.title}</h3>
                  <div className={styles.grid}>
                    {SECTIONS.filter((s) => s.group === g.id).map((s) => {
                      const badge = s.id === 'withdrawals' && pending > 0 ? pending : null
                      return (
                        <button key={s.id} type="button" className={styles.card} onClick={() => setSection(s.id)}>
                          <span className={styles.cardTop}>
                            <span className={styles.cardIcon}>{s.icon}</span>
                            {badge !== null && <span className={styles.cardBadge}>{badge}</span>}
                          </span>
                          <span className={styles.titleCard}>{s.title}</span>
                          <span className={styles.cardHint}>{s.hint}</span>
                          <span className={styles.cardGo} aria-hidden>
                            Открыть ›
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </nav>
          </>
        )}
      </main>
    </div>,
    document.body,
  )
}
