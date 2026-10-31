import { useEffect, useMemo, useState } from 'react'
import { getTelegramUser, hapticImpact } from '../../lib/telegram'
import { UserAvatar } from '../ui/UserAvatar'
import { FlameIcon, SparkleIcon } from './icons'
import styles from './SplashScreen.module.css'

interface SplashScreenProps {
  onFinish: () => void
}

const FAN_GIFTS = [
  '/gifts/heart_locket_1.png',
  '/gifts/plush_pepe_1.png',
  '/gifts/mini_oscar_1.png',
] as const
const WORDMARK = 'SEXY DROP'.split('')

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [progress, setProgress] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const tgUser = useMemo(() => getTelegramUser(), [])

  const userName = tgUser?.first_name || tgUser?.username || 'Игрок'

  useEffect(() => {
    // Плавное заполнение прогресс-бара от 0 до 100 за ~1.5 секунды
    const startTime = performance.now()
    const duration = 1400

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime
      const current = Math.min(100, Math.round((elapsed / duration) * 100))
      setProgress(current)

      if (current >= 100) {
        clearInterval(interval)
        hapticImpact('light')
        setIsExiting(true)
        setTimeout(() => {
          onFinish()
        }, 400)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [onFinish])

  const statusMessage = useMemo(() => {
    if (progress < 30) return 'Синхронизация профиля Telegram...'
    if (progress < 65) return 'Загрузка кейсов и 3D-подарков...'
    if (progress < 90) return 'Проверка честности RTP 98%...'
    return 'Добро пожаловать в игру!'
  }, [progress])

  return (
    <div
      className={`${styles.splashBackdrop} ${isExiting ? styles.exiting : ''}`}
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

      {/* Веер NFT-подарков: «выпадают» снизу и парят */}
      <div className={styles.giftFan} aria-hidden>
        {FAN_GIFTS.map((src, i) => (
          <img key={src} src={src} alt="" className={`${styles.fanCard} ${styles[`fan${i}`]}`} />
        ))}
      </div>

      <div className={styles.content}>
        {/* Моушн-аватар с вращающимся градиентным кольцом и пульсирующими волнами */}
        <div className={styles.avatarWrapper}>
          <div className={styles.pulseWave} aria-hidden />
          <div className={styles.pulseWaveSecond} aria-hidden />
          <div className={styles.rotatingRing} aria-hidden />

          <div className={styles.avatarInner}>
            <UserAvatar size={80} />
            <span className={styles.badgeStar} aria-hidden>
              <SparkleIcon style={{ width: '13px', height: '13px', color: '#c35c61' }} />
            </span>
          </div>
        </div>

        {/* Логотип: буквы по очереди «падают» (drop) */}
        <div className={styles.wordmark} aria-hidden>
          {WORDMARK.map((ch, i) => (
            <span key={i} className={styles.wordLetter} style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </div>

        {/* Приветствие с именем пользователя */}
        <h1 className={styles.greetingTitle}>Привет, {userName}!</h1>
        <div className={styles.brandSub}>
          <FlameIcon style={{ width: '14px', height: '14px', color: '#be5156' }} />
          <span>SEXY DROP Mini App</span>
        </div>

        {/* Полоса загрузки с динамическим статусом */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBarTrack}>
            <div className={styles.progressBarFill} style={{ width: `${progress}%` }}>
              <span className={styles.shimmer} aria-hidden />
            </div>
          </div>
          <span className={styles.statusText}>{statusMessage}</span>
        </div>
      </div>
    </div>
  )
}
