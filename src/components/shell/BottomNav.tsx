import { useEffect, useRef, useState, type ComponentType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { hapticImpact } from '../../lib/telegram'
import { useInventoryStore } from '../../store/inventory'
import { NavEarnIcon, NavHomeIcon, NavInventoryIcon, NavInviteIcon, NavTrophyIcon } from './NavIcons'
import styles from './BottomNav.module.css'

interface Tab {
  to: string
  label: string
  id: string
  icon: ComponentType<{ className?: string; active?: boolean }>
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
    { to: '/inventory', id: 'inventory', label: 'Инвентарь', icon: NavInventoryIcon, badge: inventoryCount },
    { to: '/invite', id: 'invite', label: 'Пригласить', icon: NavInviteIcon },
    { to: '/', id: 'home', label: 'Главная', icon: NavHomeIcon, end: true },
    { to: '/rating', id: 'rating', label: 'Рейтинг', icon: NavTrophyIcon },
    { to: '/rewards', id: 'earn', label: 'Заработок', icon: NavEarnIcon },
  ]

  const activeIndex = tabs.findIndex((tab) =>
    tab.end ? location.pathname === tab.to : location.pathname.startsWith(tab.to),
  )

  // Всплеск капель при смене вкладки (ключ меняется — анимация проигрывается заново)
  const [burst, setBurst] = useState<{ key: number; index: number } | null>(null)
  const prevIndex = useRef(activeIndex)
  const burstKey = useRef(0)
  useEffect(() => {
    if (activeIndex >= 0 && activeIndex !== prevIndex.current) {
      burstKey.current += 1
      setBurst({ key: burstKey.current, index: activeIndex })
    }
    prevIndex.current = activeIndex
  }, [activeIndex])

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
          {/* фирменная капля над активной вкладкой: «падает» на место при переключении */}
          <span key={activeIndex} className={styles.dropMark} />
        </div>
      )}

      {burst && (
        <div
          key={burst.key}
          className={styles.burst}
          style={{ left: `${burst.index * 20 + 10}%` }}
          aria-hidden="true"
        >
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} style={{ '--a': `${-150 + i * 50}deg`, '--d': `${22 + (i % 3) * 7}px` } as React.CSSProperties} />
          ))}
        </div>
      )}

      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => cx(styles.tab, styles[`tab_${tab.id}`], isActive && styles.active)}
          onClick={() => hapticImpact('light')}
        >
          <div className={styles.tabInner}>
            <span className={styles.iconWrap}>
              <tab.icon className={styles.icon} active={tab.end ? location.pathname === tab.to : location.pathname.startsWith(tab.to)} />
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
