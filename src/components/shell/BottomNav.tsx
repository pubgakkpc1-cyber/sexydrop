import type { ComponentType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { hapticImpact } from '../../lib/telegram'
import { useInventoryStore } from '../../store/inventory'
import { CoinsRewardIcon, CubeIcon, HomeIcon, TrophyIcon, UserPlusIcon } from './icons'
import styles from './BottomNav.module.css'

interface Tab {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Точное совпадение (нужно для корня «/»). */
  end?: boolean
}

function itemCountLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} предмет`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} предмета`
  return `${n} предметов`
}

/**
 * Нижнее меню приложения (5 вкладок, референс @epic_gift_bot кадр frame_00).
 * Единый аккуратный стеклянный контейнер для активной вкладки, чистая типографика
 * и нативные иконки без искажений и лишних полос.
 */
export function BottomNav() {
  const location = useLocation()
  const inventoryCount = useInventoryStore((s) => s.items.length)

  const tabs: readonly (Tab & { badge?: number })[] = [
    { to: '/inventory', label: 'Инвентарь', icon: CubeIcon, badge: inventoryCount },
    { to: '/invite', label: 'Пригласить', icon: UserPlusIcon },
    { to: '/', label: 'Главная', icon: HomeIcon, end: true },
    { to: '/rating', label: 'Рейтинг', icon: TrophyIcon },
    { to: '/rewards', label: 'Награды', icon: CoinsRewardIcon },
  ]

  const activeIndex = tabs.findIndex((tab) =>
    tab.end ? location.pathname === tab.to : location.pathname.startsWith(tab.to),
  )

  return (
    <nav className={styles.nav} aria-label="Основная навигация">
      {/* Плавный скользящий стеклянный контейнер активной вкладки */}
      {activeIndex >= 0 && (
        <div
          className={styles.slidingTrack}
          style={{ transform: `translate3d(${activeIndex * 100}%, 0, 0)` }}
          aria-hidden="true"
        >
          <div className={styles.slidingPill} />
        </div>
      )}

      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => cx(styles.tab, isActive && styles.active)}
          onClick={() => hapticImpact('light')}
        >
          <div className={styles.tabInner}>
            <span className={styles.iconWrap}>
              <tab.icon className={styles.icon} />
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={styles.badge} aria-label={itemCountLabel(tab.badge)}>
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </div>
        </NavLink>
      ))}
    </nav>
  )
}
