import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getWebApp, hapticImpact } from '../../lib/telegram'
import { UserAvatar } from '../ui/UserAvatar'
import { FlameIcon } from './icons'
import styles from './SplashScreen.module.css'

interface SplashScreenProps {
  onFinish: () => void
}

const DURATION_MS = 1100
/** На ПК заставка крупнее и чуть дольше: успевает сыграть целиком после разворота окна на весь экран. */
const DESKTOP_DURATION_MS = 1700

function isDesktop(): boolean {
  if (typeof window === 'undefined') return false
  const platform = String((getWebApp() as unknown as { platform?: string } | undefined)?.platform ?? '')
  return ['tdesktop', 'macos', 'unigram', 'weba', 'webk'].includes(platform) || window.innerWidth >= 1000
}

/**
 * Ждём, пока окно готово: шрифты загружены и (на ПК) Telegram закончил разворачивать мини-приложение
 * на весь экран. Иначе анимация начинается «не с нуля» — первые кадры уходят на разворот окна.
 */
async function waitUntilReady(desktop: boolean): Promise<void> {
  const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? Promise.resolve()
  const fullscreen = new Promise<void>((resolve) => {
    const wa = getWebApp() as unknown as { isFullscreen?: boolean; onEvent?: (e: string, cb: () => void) => void; offEvent?: (e: string, cb: () => void) => void } | undefined
    if (!desktop || !wa || wa.isFullscreen) return resolve()
    const done = () => {
      wa.offEvent?.('fullscreenChanged', done)
      resolve()
    }
    wa.onEvent?.('fullscreenChanged', done)
    window.setTimeout(done, 700)
  })
  await Promise.race([Promise.all([fonts, fullscreen]), new Promise((r) => window.setTimeout(r, 1200))])
  const frame = () =>
    new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : window.setTimeout(r, 16)))
  await frame()
  await frame()
}
const WORDMARK = 'SEXY DROP'.split('')
/** Подарки вылетают из точки удара в свои места (dx/dy в px от центра, поворот). */
const FAN = [
  { src: '/gifts/heart_locket_1.webp', x: -108, y: -150, r: -14 },
  { src: '/gifts/plush_pepe_1.webp', x: 108, y: -168, r: 12 },
  { src: '/gifts/mini_oscar_1.webp', x: -112, y: -22, r: 10 },
  { src: '/gifts/ion_gem_1.webp', x: 112, y: -10, r: -10 },
] as const
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  a: (i / 16) * 360 + (i % 2) * 8,
  d: 110 + (i % 4) * 34,
}))

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [progress, setProgress] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [desktop] = useState(isDesktop)
  // вне Telegram (браузер, тесты) ждать нечего — анимация идёт сразу
  const [running, setRunning] = useState(() => !getWebApp())

  useEffect(() => {
    if (running) return
    let alive = true
    // страховка: даже если что-то не ответило, заставка стартует не позже чем через 1.5 с
    void Promise.race([waitUntilReady(desktop).catch(() => undefined), new Promise((r) => window.setTimeout(r, 1500))]).then(
      () => alive && setRunning(true),
    )
    return () => {
      alive = false
    }
  }, [desktop])

  useEffect(() => {
    if (!running) return
    const total = desktop ? DESKTOP_DURATION_MS : DURATION_MS
    const startTime = performance.now()
    let impacted = false

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime
      const current = Math.min(100, Math.round((elapsed / total) * 100))
      setProgress(current)

      // Момент удара капли — тактильный отклик
      if (!impacted && elapsed >= 520) {
        impacted = true
        hapticImpact('heavy')
      }

      if (current >= 100) {
        clearInterval(interval)
        hapticImpact('light')
        setIsExiting(true)
        setTimeout(() => {
          onFinish()
        }, 250)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [onFinish, running, desktop])

  const statusMessage = useMemo(() => {
    if (progress < 30) return 'Синхронизация профиля Telegram...'
    if (progress < 65) return 'Загрузка кейсов и 3D-подарков...'
    if (progress < 90) return 'Подготовка кейсов и выплат...'
    return 'Добро пожаловать в игру!'
  }, [progress])

  return (
    <div
      className={`${styles.splashBackdrop} ${running ? styles.run : ''} ${desktop ? styles.desktop : ''} ${isExiting ? styles.exiting : ''}`}
      role="status"
      aria-label="Загрузка приложения"
      onClick={() => {
        if (!isExiting) {
          hapticImpact('light')
          setIsExiting(true)
          setTimeout(onFinish, 250)
        }
      }}
    >
      <div className={styles.ambientGlow} aria-hidden />
      <div className={styles.flash} aria-hidden />

      {/* Сцена: всё, что происходит в точке удара, трясётся при ударе */}
      <div className={styles.stage}>
        {/* Падающая капля со шлейфом */}
        <div className={styles.dropWrap} aria-hidden>
          <span className={styles.dropTrail} />
          <svg viewBox="0 0 24 24" className={styles.dropSvg}>
            <path d="M12 1.8c3.9 4.6 6.4 8 6.4 11.6a6.4 6.4 0 0 1-12.8 0c0-3.6 2.5-7 6.4-11.6z" fill="currentColor" />
          </svg>
        </div>

        {/* Ударные кольца */}
        <span className={`${styles.ring} ${styles.ring1}`} aria-hidden />
        <span className={`${styles.ring} ${styles.ring2}`} aria-hidden />
        <span className={`${styles.ring} ${styles.ring3}`} aria-hidden />

        {/* Искры разлетаются от удара */}
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className={styles.spark}
            aria-hidden
            style={{ '--a': `${s.a}deg`, '--d': `${s.d}px`, animationDelay: `${0.52 + (i % 3) * 0.03}s` } as CSSProperties}
          />
        ))}

        {/* Подарки вылетают веером */}
        {FAN.map((g, i) => (
          <img
            key={g.src}
            src={g.src}
            alt=""
            aria-hidden
            className={styles.fanCard}
            style={
              { '--x': `${g.x}px`, '--y': `${g.y}px`, '--r': `${g.r}deg`, '--i': i } as CSSProperties
            }
          />
        ))}

        <div className={styles.avatarWrapper}>
          <div className={styles.rotatingRing} data-gfx-keep aria-hidden />
          <div className={styles.avatarInner}>
            <UserAvatar size={80} />
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Логотип: буквы вылетают после удара, затем проходит блик */}
        <div className={styles.wordmark} aria-hidden>
          {WORDMARK.map((ch, i) => (
            <span
              key={i}
              className={styles.wordLetter}
              style={{ animationDelay: `${0.62 + i * 0.05}s`, '--i': i } as CSSProperties}
            >
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
          <span className={styles.wordShine} />
        </div>

        <div className={styles.brandSub}>
          <FlameIcon style={{ width: '14px', height: '14px', color: '#be5156' }} />
          <span>SEXY DROP Mini App</span>
        </div>

        <div className={styles.progressContainer}>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} style={{ width: `${progress}%` }}>
              <span className={styles.shimmer} data-gfx-keep aria-hidden />
            </div>
          </div>
          <span className={styles.statusText}>{statusMessage}</span>
        </div>
      </div>
    </div>
  )
}
