import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getWebApp, isTelegramEnv } from '../../lib/telegram'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { CubeIcon, GiftIcon, RocketIcon, SlotIcon, TonIcon } from './icons'
import styles from './MobileShell.module.css'

/**
 * Оболочка приложения:
 * - В Telegram (на мобильном и в Telegram Desktop): чистый, быстрый, нативный вид во всю высоту окна Telegram без лишних рамок и без размытия текста.
 * - В обычном браузере на ПК (>1024px): боковая информационная панель с QR-кодом и центрированное приложение.
 */
export function MobileShell() {
  const location = useLocation()
  const navigate = useNavigate()

  const [inTelegram] = useState(() => isTelegramEnv())
  const isCustomHeaderScreen = location.pathname === '/games/crash'
  const [isWideScreen, setIsWideScreen] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 1024
  })

  // Синхронизация системной кнопки Telegram «Назад»
  useEffect(() => {
    const backButton = getWebApp()?.BackButton
    if (!backButton) return
    const onBack = () => navigate(-1)
    if (location.pathname === '/') {
      backButton.hide()
    } else {
      backButton.onClick(onBack)
      backButton.show()
    }
    return () => {
      backButton.offClick(onBack)
    }
  }, [location.pathname, navigate])

  // Отслеживание изменения размера окна в обычном браузере
  useEffect(() => {
    if (inTelegram) return
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [inTelegram])

  // Внутри Telegram (на мобильном или в Telegram Desktop) отображаем нативно без внешних сайдбаров
  if (inTelegram || !isWideScreen) {
    return (
      <div className={styles.rootWrapper}>
        <div className={styles.shellContainer}>
          {!isCustomHeaderScreen && <Header />}
          <main
            className={isCustomHeaderScreen ? `${styles.main} ${styles.mainCustomHeader}` : styles.main}
            key={location.pathname}
          >
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </div>
    )
  }

  // В обычном браузере на большом мониторе ПК
  return (
    <div className={styles.rootWrapper}>
      <div className={styles.browserDesktopContainer}>
        {/* Информационная панель слева */}
        <aside className={styles.browserSidebar}>
          <div className={styles.brandCard}>
            <div className={styles.brandHeader}>
              <div className={styles.brandLogo}>
                <GiftIcon style={{ width: '24px', height: '24px', color: '#c7696d' }} />
              </div>
              <div>
                <h1 className={styles.brandTitle}>SEXY DROP</h1>
                <div className={styles.badgeRow}>
                  <span className={styles.tgBadge}>Telegram Mini App</span>
                  <span className={styles.onlineBadge}>● Online</span>
                </div>
              </div>
            </div>
            <p className={styles.brandDesc}>
              Премиальная платформа кейсов подарков Telegram, Ракетка (Crash), Mines, Plinko и PVP турниры.
            </p>
          </div>

          <div className={styles.featuresCard}>
            <div className={styles.featureItem}>
              <CubeIcon style={{ width: '16px', height: '16px', color: '#c7696d', flexShrink: 0 }} />
              <span>22 уникальных кейса с RTP 98%</span>
            </div>
            <div className={styles.featureItem}>
              <TonIcon style={{ width: '16px', height: '16px', color: '#ab3f45', flexShrink: 0 }} />
              <span>122 эксклюзивных 3D-подарка</span>
            </div>
            <div className={styles.featureItem}>
              <SlotIcon style={{ width: '16px', height: '16px', color: '#ba464b', flexShrink: 0 }} />
              <span>7 игровых режимов + PVP арена</span>
            </div>
          </div>

          <div className={styles.qrCard}>
            <div className={styles.qrWrap}>
              <img src="/tg-qr.svg" alt="QR-код для Telegram" className={styles.qrImage} />
            </div>
            <div className={styles.qrInfo}>
              <strong>Играйте на телефоне</strong>
              <p>Отсканируйте камерой смартфона</p>
              <a
                href="https://t.me/sexydropbot"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.tgLinkBtn}
              >
                <RocketIcon style={{ width: '15px', height: '15px', marginRight: '4px' }} />
                <span>Открыть бота</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </aside>

        {/* Рабочая область приложения */}
        <div className={styles.shellContainer}>
          {!isCustomHeaderScreen && <Header />}
          <main className={styles.main} key={location.pathname}>
            <Outlet />
          </main>
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
