import { useEffect, useRef } from 'react'
import { MULT_TIER_STYLE, multTier } from '../../lib/multTier'
import { RocketArtIcon } from '../shell/icons'
import styles from './CrashLoop.module.css'

const FLIGHT_S = 3.4
const CRASH_S = 0.9
const PAUSE_S = 0.35
const CYCLE_S = FLIGHT_S + CRASH_S + PAUSE_S

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  hue: number
}

/**
 * Зацикленная «живая» сцена для баннера Ракетки: ракета летит по кривой, оставляя след,
 * икс растёт, затем вспышка-взрыв и новый круг. Рисуется на canvas (лёгкий rAF-цикл),
 * ставится на паузу, когда баннер не виден или вкладка скрыта.
 */
export function CrashLoop() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rocketRef = useRef<HTMLSpanElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const rocket = rocketRef.current
    const pill = pillRef.current
    if (!wrap || !canvas || !rocket || !pill) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let W = 0
    let H = 0
    const resize = () => {
      const r = wrap.getBoundingClientRect()
      W = Math.max(1, r.width)
      H = Math.max(1, r.height)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(wrap)

    let target = 3
    let particles: Particle[] = []
    let trail: { x: number; y: number }[] = []
    let lastCycle = -1
    let crashedBurst = false
    let raf = 0
    let visible = true
    let start = performance.now()

    const stars = Array.from({ length: 14 }, (_, i) => ({ x: (i * 0.137) % 1, y: (i * 0.291) % 1, s: 0.6 + (i % 3) * 0.5, sp: 0.02 + (i % 4) * 0.012 }))

    const pos = (p: number) => {
      const e = 1 - Math.pow(1 - p, 1.7)
      return { x: W * (0.1 + 0.74 * e), y: H * (0.84 - 0.62 * Math.pow(p, 1.5)) }
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      const t = ((now - start) / 1000) % CYCLE_S
      const cycle = Math.floor((now - start) / 1000 / CYCLE_S)
      if (cycle !== lastCycle) {
        lastCycle = cycle
        target = [1.28, 2.47, 3.8, 5.6, 1.9, 9.4, 14.2][cycle % 7]!
        trail = []
        particles = []
        crashedBurst = false
      }
      ctx.clearRect(0, 0, W, H)

      // звёздная пыль плывёт влево
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      for (const s of stars) {
        const x = (((s.x - ((now / 1000) * s.sp)) % 1) + 1) % 1
        ctx.globalAlpha = 0.25 + 0.4 * s.s
        ctx.fillRect(x * W, s.y * H, s.s * 1.6, s.s * 1.6)
      }
      ctx.globalAlpha = 1

      const flying = t < FLIGHT_S
      const p = Math.min(1, t / FLIGHT_S)
      const { x, y } = pos(p)
      const mult = 1 + (target - 1) * Math.pow(p, 1.35)

      if (flying) {
        trail.push({ x, y })
        if (trail.length > 70) trail.shift()
        // пламя-частицы
        if (!reduced) {
          particles.push({ x, y, vx: -30 - Math.random() * 25, vy: 14 + Math.random() * 20, life: 1, hue: 20 + Math.random() * 25 })
        }
      } else if (!crashedBurst) {
        crashedBurst = true
        for (let i = 0; i < 26; i += 1) {
          const a = (i / 26) * Math.PI * 2
          const v = 40 + Math.random() * 90
          particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, hue: 5 + Math.random() * 40 })
        }
      }

      // след
      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i += 1) {
          const a = i / trail.length
          ctx.strokeStyle = `rgba(255, 255, 255, ${a * (flying ? 0.75 : 0.3)})`
          ctx.lineWidth = 1 + a * 3.2
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(trail[i - 1]!.x, trail[i - 1]!.y)
          ctx.lineTo(trail[i]!.x, trail[i]!.y)
          ctx.stroke()
        }
      }

      // частицы
      const dt = 1 / 60
      for (const q of particles) {
        q.x += q.vx * dt
        q.y += q.vy * dt
        q.life -= flying ? 0.055 : 0.028
        if (q.life > 0) {
          ctx.fillStyle = `hsla(${q.hue}, 95%, ${flying ? 62 : 68}%, ${q.life})`
          ctx.beginPath()
          ctx.arc(q.x, q.y, (flying ? 2.4 : 3) * q.life + 0.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      particles = particles.filter((q) => q.life > 0)

      // ракета
      if (flying) {
        const p2 = Math.min(1, p + 0.02)
        const n = pos(p2)
        const ang = (Math.atan2(n.x - x, -(n.y - y)) * 180) / Math.PI
        rocket.style.opacity = '1'
        rocket.style.transform = `translate(${x - 22}px, ${y - 22}px) rotate(${ang}deg)`
      } else {
        rocket.style.opacity = '0'
      }

      // плашка икса
      const shown = flying ? mult : target
      const tier = MULT_TIER_STYLE[multTier(shown)]
      pill.textContent = `x${(Math.floor(shown * 100) / 100).toFixed(2)}`
      pill.style.background = flying ? tier.color : '#555961'
      pill.style.opacity = t > CYCLE_S - PAUSE_S ? '0.3' : '1'
      pill.style.transform = `translate(${Math.min(W - 74, Math.max(2, x - 70))}px, ${Math.min(H - 26, Math.max(4, y + 2))}px)`
      if (!flying) pill.style.transform = `translate(${Math.min(W - 74, Math.max(2, x - 70))}px, ${Math.min(H - 26, Math.max(4, y + 2))}px) scale(0.92)`
    }

    const onVisibility = () => {
      visible = !document.hidden
    }
    document.addEventListener('visibilitychange', onVisibility)
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting && !document.hidden })
      : null
    io?.observe(wrap)

    if (reduced) {
      // статичный кадр: ракета в середине полёта
      start = performance.now() - 1700
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div ref={wrapRef} className={styles.wrap} aria-hidden>
      <canvas ref={canvasRef} className={styles.canvas} />
      <span ref={rocketRef} className={styles.rocket}>
        <RocketArtIcon className={styles.rocketIcon} />
      </span>
      <span ref={pillRef} className={styles.pill}>x1.00</span>
    </div>
  )
}
