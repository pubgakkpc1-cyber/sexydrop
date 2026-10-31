import { useEffect, useRef } from 'react'
import { MULT_TIER_STYLE, multTier } from '../../lib/multTier'
import { ROCKET_SKINS, drawCartoonRocket } from '../games/Rocket3DCanvas'
import styles from './CrashLoop.module.css'

const FLIGHT_S = 3.6
const CRASH_S = 0.8
const PAUSE_S = 0.5
const CYCLE_S = FLIGHT_S + CRASH_S + PAUSE_S
const TARGETS = [2.47, 5.8, 1.64, 9.2, 3.35, 14.6, 1.92] as const

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  hue: number
  size: number
}

/**
 * Мини-арена Ракетки внутри баннера: тот же мультяшный корабль с Plush Pepe, что и в игре,
 * летит по растущей кривой со светящимся следом, икс растёт и меняет цвет, затем взрыв и
 * новый круг. Рисуется на canvas; ставится на паузу, когда баннер не виден.
 */
export function CrashLoop() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const multRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const multEl = multRef.current
    if (!wrap || !canvas || !multEl) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const skin = ROCKET_SKINS[0]!

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

    let particles: Particle[] = []
    let trail: { x: number; y: number }[] = []
    let lastCycle = -1
    let burst = false
    let target = 2.47
    let raf = 0
    let visible = true
    let start = performance.now()
    if (reduced) start -= 2200

    const stars = Array.from({ length: 22 }, (_, i) => ({
      x: (i * 0.371) % 1,
      y: (i * 0.173 + 0.07) % 1,
      s: 0.5 + (i % 3) * 0.5,
      sp: 0.03 + (i % 5) * 0.015,
    }))

    // Кривая роста: быстрый старт и плавный подъём вправо-вверх
    const pos = (p: number) => ({
      x: W * (0.14 + 0.66 * (1 - Math.pow(1 - p, 1.6))),
      y: H * (0.8 - 0.56 * Math.pow(p, 1.35)),
    })

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      const el = (now - start) / 1000
      const t = el % CYCLE_S
      const cycle = Math.floor(el / CYCLE_S)
      if (cycle !== lastCycle) {
        lastCycle = cycle
        target = TARGETS[cycle % TARGETS.length]!
        trail = []
        particles = []
        burst = false
      }
      ctx.clearRect(0, 0, W, H)

      // сетка арены и звёзды
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let i = 1; i < 4; i += 1) {
        ctx.beginPath()
        ctx.moveTo(0, (H * i) / 4)
        ctx.lineTo(W, (H * i) / 4)
        ctx.stroke()
      }
      ctx.fillStyle = '#fff'
      for (const s of stars) {
        const x = (((s.x - el * s.sp) % 1) + 1) % 1
        ctx.globalAlpha = 0.2 + s.s * 0.25
        ctx.fillRect(x * W, s.y * H, s.s * 1.5, s.s * 1.5)
      }
      ctx.globalAlpha = 1

      const flying = t < FLIGHT_S
      const p = Math.min(1, t / FLIGHT_S)
      const { x, y } = pos(p)
      const mult = 1 + (target - 1) * Math.pow(p, 1.25)
      const tier = MULT_TIER_STYLE[multTier(flying ? mult : target)]

      if (flying) {
        trail.push({ x, y })
        if (trail.length > 90) trail.shift()
        if (!reduced) {
          for (let i = 0; i < 2; i += 1) {
            particles.push({
              x: x - 14,
              y: y + 3,
              vx: -40 - Math.random() * 30,
              vy: (Math.random() - 0.3) * 22,
              life: 1,
              hue: 18 + Math.random() * 28,
              size: 1.6 + Math.random() * 1.6,
            })
          }
        }
      } else if (!burst) {
        burst = true
        for (let i = 0; i < 34; i += 1) {
          const a = (i / 34) * Math.PI * 2 + Math.random() * 0.2
          const v = 50 + Math.random() * 110
          particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, hue: 8 + Math.random() * 40, size: 2 + Math.random() * 2.6 })
        }
      }

      // светящийся след
      if (trail.length > 1) {
        ctx.lineCap = 'round'
        for (let pass = 0; pass < 2; pass += 1) {
          for (let i = 1; i < trail.length; i += 1) {
            const a = i / trail.length
            ctx.strokeStyle = pass === 0
              ? `rgba(255, 90, 100, ${a * (flying ? 0.28 : 0.12)})`
              : `rgba(255, 235, 235, ${a * (flying ? 0.85 : 0.3)})`
            ctx.lineWidth = pass === 0 ? 2 + a * 9 : 1 + a * 2.4
            ctx.beginPath()
            ctx.moveTo(trail[i - 1]!.x, trail[i - 1]!.y)
            ctx.lineTo(trail[i]!.x, trail[i]!.y)
            ctx.stroke()
          }
        }
      }

      // частицы пламени / взрыва
      for (const q of particles) {
        q.x += q.vx / 60
        q.y += q.vy / 60
        q.life -= flying ? 0.06 : 0.026
        if (q.life > 0) {
          ctx.fillStyle = `hsla(${q.hue}, 96%, ${flying ? 60 : 66}%, ${q.life})`
          ctx.beginPath()
          ctx.arc(q.x, q.y, q.size * q.life + 0.3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      particles = particles.filter((q) => q.life > 0)

      // корабль (тот же, что в игре), нос по касательной к кривой
      if (flying) {
        const n = pos(Math.min(1, p + 0.02))
        const ang = Math.atan2(n.y - y, n.x - x)
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(ang)
        ctx.scale(0.4, 0.4)
        drawCartoonRocket(ctx, skin, el, mult, true)
        ctx.restore()
      } else if (t < FLIGHT_S + 0.18) {
        // вспышка на месте взрыва
        const k = 1 - (t - FLIGHT_S) / 0.18
        const g = ctx.createRadialGradient(x, y, 0, x, y, 34)
        g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`)
        g.addColorStop(1, 'rgba(255,120,110,0)')
        ctx.fillStyle = g
        ctx.fillRect(x - 34, y - 34, 68, 68)
      }

      // икс
      const shown = flying ? mult : target
      multEl.textContent = `x${(Math.floor(shown * 100) / 100).toFixed(2)}`
      multEl.style.color = flying ? tier.color : '#8c9099'
      multEl.style.textShadow = flying ? tier.glow : 'none'
      multEl.style.opacity = t > CYCLE_S - PAUSE_S * 0.6 ? '0.35' : '1'
    }

    const sync = () => {
      visible = !document.hidden
    }
    document.addEventListener('visibilitychange', sync)
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting && !document.hidden })
      : null
    io?.observe(wrap)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return (
    <div ref={wrapRef} className={styles.wrap} aria-hidden>
      <canvas ref={canvasRef} className={styles.canvas} />
      <span ref={multRef} className={styles.mult}>x1.00</span>
    </div>
  )
}
