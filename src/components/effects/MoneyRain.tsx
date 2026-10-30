import React, { useEffect, useMemo } from 'react'
import { TonIcon } from '../shell/icons'
import styles from './MoneyRain.module.css'

interface MoneyRainProps {
  onComplete?: () => void
  durationMs?: number
}

interface ParticleConfig {
  id: number
  left: number
  delay: number
  duration: number
  drift: number
  rot: number
  scale: number
  type: 'coin' | 'gem' | 'sparkle'
}

function GoldCoinSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="url(#goldCoinGrad)" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 2" />
      <path
        d="M13 10h6c1.1 0 2 .9 2 2 0 .74-.4 1.38-1 1.72V14c.6.34 1 .98 1 1.72 0 1.1-.9 2-2 2h-6V10zm2 1.8v1.6h3.5c.44 0 .8-.36.8-.8s-.36-.8-.8-.8H15zm0 3.2v1.8h3.8c.44 0 .8-.36.8-.8s-.36-.8-.8-.8H15z"
        fill="#78350f"
      />
      <path
        d="M16 8v2M16 21v3"
        stroke="#78350f"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <defs>
        <radialGradient
          id="goldCoinGrad"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(11 10) rotate(52.7) scale(20.4)"
        >
          <stop stopColor="#fef08a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </radialGradient>
      </defs>
    </svg>
  )
}

function SparkleSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        fill="#fde047"
      />
    </svg>
  )
}

export function MoneyRain({ onComplete, durationMs = 2100 }: MoneyRainProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [onComplete, durationMs])

  // Фиксированный набор лёгких частиц (10 штук) — детерминированный, 
  // чтобы не вызывать лишних ре-рендеров и не тратить CPU на слабых смартфонах
  const particles = useMemo<ParticleConfig[]>(() => {
    const positions = [8, 18, 28, 38, 48, 58, 68, 78, 88, 94]
    return positions.map((left, idx) => {
      const type: 'coin' | 'gem' | 'sparkle' =
        idx % 3 === 0 ? 'gem' : idx % 3 === 1 ? 'coin' : 'sparkle'
      return {
        id: idx,
        left,
        delay: ((idx * 53) % 40) / 100, // 0.00s .. 0.39s
        duration: 1.35 + ((idx * 37) % 35) / 100, // 1.35s .. 1.70s
        drift: ((idx * 17) % 50) - 25, // -25px .. +25px
        rot: ((idx * 79) % 360) - 180, // -180deg .. +180deg
        scale: 0.8 + ((idx * 23) % 35) / 100, // 0.80 .. 1.15
        type,
      }
    })
  }, [])

  return (
    <div className={styles.moneyRainContainer} aria-hidden="true">
      {particles.map((p) => {
        const style: React.CSSProperties & Record<string, string | number> = {
          left: `${p.left}%`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
          ['--drift' as string]: `${p.drift}px`,
          ['--rot' as string]: `${p.rot}deg`,
          ['--scale' as string]: p.scale,
        }

        return (
          <div key={p.id} className={styles.particle} style={style}>
            {p.type === 'coin' && <GoldCoinSvg className={styles.coinIcon} />}
            {p.type === 'gem' && <TonIcon className={styles.gemIcon} />}
            {p.type === 'sparkle' && <SparkleSvg className={styles.sparkleIcon} />}
          </div>
        )
      })}
    </div>
  )
}
