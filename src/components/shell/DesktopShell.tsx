import { useEffect, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { hapticImpact, openOwnerChat, openTelegramUrl } from '../../lib/telegram'
import { useInventoryStore } from '../../store/inventory'
import { Header } from './Header'
import { LiveFeed } from './LiveFeed'
import { GameTopBar } from './GameTopBar'
import { NavEarnIcon, NavHomeIcon, NavInventoryIcon, NavInviteIcon, NavTrophyIcon } from './NavIcons'
import { BombIcon, GamepadIcon, RocketIcon, TargetIcon, ZapIcon } from './icons'
import styles from './DesktopShell.module.css'

interface Item {
  to: string
  label: string
  icon: ComponentType<{ className?: string; active?: boolean }>
  end?: boolean
  badge?: number
}

/** Иконки игр не знают про `active` — не пробрасываем его в <svg>. */
const plain = (Icon: ComponentType<{ className?: string }>) =>
  function PlainIcon({ className }: { className?: string; active?: boolean }) {
    return <Icon className={className} />
  }

const GAMES: readonly Item[] = [
  { to: '/games/crash', label: 'Ракетка', icon: plain(RocketIcon) },
  { to: '/games/upgrade', label: 'Апгрейд', icon: plain(TargetIcon) },
  { to: '/games/mines', label: 'Мины', icon: plain(BombIcon) },
  { to: '/games/clicker', label: 'Кликалка', icon: plain(ZapIcon) },
  { to: '/games', label: 'Все игры', icon: plain(GamepadIcon), end: true },
]

/**
 * Оболочка для ПК (Telegram Desktop / macOS, окно от 1100px): не растянутый телефон, а своя раскладка —
 * боковое меню слева, контент по центру, колонка Live-дропов справа (на главной и разделах, не в играх).
 */
export function DesktopShell({ isCustomHeaderScreen, isMiniGame }: { isCustomHeaderScreen: boolean; isMiniGame: boolean }) {
  const location = useLocation()
  const inventoryCount = useInventoryStore((s) => s.items.length)
  const showLive = !isMiniGame && !isCustomHeaderScreen

  // Метка для стилей экранов: «сейчас ПК-раскладка» (html[data-shell='pc'])
  useEffect(() => {
    document.documentElement.dataset.shell = 'pc'
    return () => {
      delete document.documentElement.dataset.shell
    }
  }, [])

  const main: readonly Item[] = [
    { to: '/', label: 'Главная', icon: NavHomeIcon, end: true },
    { to: '/inventory', label: 'Инвентарь', icon: NavInventoryIcon, badge: inventoryCount },
    { to: '/invite', label: 'Пригласить', icon: NavInviteIcon },
    { to: '/rating', label: 'Рейтинг', icon: NavTrophyIcon },
    { to: '/rewards', label: 'Заработок', icon: NavEarnIcon },
  ]

  const renderItem = (it: Item) => {
    const active = it.end ? location.pathname === it.to : location.pathname.startsWith(it.to)
    return (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.end}
        className={({ isActive }) => cx(styles.navItem, isActive && styles.navActive)}
        onClick={() => hapticImpact('light')}
      >
        <it.icon className={styles.navIcon} active={active} />
        <span className={styles.navLabel}>{it.label}</span>
        {it.badge !== undefined && it.badge > 0 && <span className={styles.navBadge}>{it.badge > 99 ? '99+' : it.badge}</span>}
      </NavLink>
    )
  }

  return (
    <div className={cx(styles.root, !showLive && styles.noLive)}>
      <aside className={styles.side}>
        <Link to="/" className={styles.logo} aria-label="SEXY DROP — на главную">
          SEXY<span>DROP</span>
        </Link>

        <nav className={styles.nav} aria-label="Основная навигация">
          {main.map(renderItem)}
        </nav>

        <div className={styles.groupTitle}>Игры</div>
        <nav className={styles.nav} aria-label="Игры">
          {GAMES.map(renderItem)}
        </nav>

        <div className={styles.sideFoot}>
          <button type="button" className={styles.footLink} onClick={() => openTelegramUrl('https://t.me/SexyDrop_official')}>
            Канал
          </button>
          <button type="button" className={styles.footLink} onClick={() => openOwnerChat()}>
            Поддержка
          </button>
        </div>
      </aside>

      <div className={styles.center}>
        {isMiniGame && <GameTopBar />}
        {!isCustomHeaderScreen && !isMiniGame && <Header />}
        <main className={cx(styles.main, isCustomHeaderScreen && styles.mainCustom)} key={location.pathname}>
          <Outlet />
        </main>
      </div>

      {showLive && (
        <aside className={styles.live}>
          <LiveFeed variant="rail" />
        </aside>
      )}
    </div>
  )
}
