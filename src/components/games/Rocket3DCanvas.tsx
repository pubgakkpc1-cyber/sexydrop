import { useEffect, useRef } from 'react'
import type { CrashPhase } from '../../store/crash'

interface Star {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  layer: number
}

interface TrailParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  color: string
  life: number
  maxLife: number
  /** 0 — круг, 1 — звёздочка, 2 — капля (отсылка к DROP) */
  shape: 0 | 1 | 2
}

interface ExplosionParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  color: string
  life: number
  maxLife: number
  spin: number
  angle: number
}

interface DebrisShard {
  type: 'nose' | 'wing_top' | 'wing_bot' | 'canopy' | 'fuselage_shard' | 'nozzle' | 'pepe_bubble'
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  alpha: number
  life: number
  maxLife: number
}


function safeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
  } else {
    const radius = Math.min(r, w / 2, h / 2)
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y + h, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
  }
}

interface SpeedStreak {
  x: number
  y: number
  len: number
  speed: number
  alpha: number
  width: number
}

export interface RocketSkinConfig {
  id: number
  name: string
  nameRu: string
  pilotNameRu: string
  hullGradient: [string, string, string, string] // [topHighlight, midUpper, midLower, bottomShadow]
  hullBorder: string
  accentColor: string
  accentGlow: string
  wingFill: [string, string]
  wingBorder: string
  wingtipLight: string
  nozzleFill: string
  nozzleRing: string
  decalColor: string
  decalSubtext: string
  canopyGradient: [string, string, string]
  canopyBorder: string
  canopyReflection: string
  flameCore: [string, string, string, string]
  flameAura: [string, string]
  trailColors: string[]
  pilotType: 0 | 1 | 2 // 0: Classic Cosmonaut Pepe, 1: Cyber Visor Pepe, 2: Golden King Pepe
}

export const ROCKET_SKINS: RocketSkinConfig[] = [
  {
    id: 0,
    name: 'Chrono Titanium',
    nameRu: 'Хроно Титан',
    pilotNameRu: 'Пепе Кадет',
    hullGradient: ['#ffffff', '#f1f5f9', '#cbd5e1', '#64748b'],
    hullBorder: 'rgba(0, 152, 234, 0.85)',
    accentColor: '#0098ea',
    accentGlow: '#38bdf8',
    wingFill: ['#334155', '#1e293b'],
    wingBorder: '#0098ea',
    wingtipLight: '#38bdf8',
    nozzleFill: '#0f172a',
    nozzleRing: '#0098ea',
    decalColor: '#0098ea',
    decalSubtext: 'SEXY DROP',
    canopyGradient: ['rgba(255, 255, 255, 0.75)', 'rgba(56, 189, 248, 0.28)', 'rgba(0, 152, 234, 0.08)'],
    canopyBorder: '#bae6fd',
    canopyReflection: 'rgba(255, 255, 255, 0.98)',
    flameCore: ['#ffffff', '#7dd3fc', '#0098ea', 'rgba(0, 152, 234, 0)'],
    flameAura: ['rgba(0, 152, 234, 0.85)', 'rgba(56, 189, 248, 0.35)'],
    trailColors: ['#0098ea', '#38bdf8', '#ffffff', '#7dd3fc', '#0284c7'],
    pilotType: 0,
  },
  {
    id: 1,
    name: 'Cyber Stealth',
    nameRu: 'Кибер Стелс',
    pilotNameRu: 'Кибер Пепе',
    hullGradient: ['#475569', '#334155', '#1e293b', '#0f172a'],
    hullBorder: 'rgba(56, 189, 248, 0.85)',
    accentColor: '#38bdf8',
    accentGlow: '#0284c7',
    wingFill: ['#1e293b', '#0f172a'],
    wingBorder: '#38bdf8',
    wingtipLight: '#7dd3fc',
    nozzleFill: '#0a0e17',
    nozzleRing: '#38bdf8',
    decalColor: '#38bdf8',
    decalSubtext: 'STEALTH · 99',
    canopyGradient: ['rgba(255, 255, 255, 0.7)', 'rgba(56, 189, 248, 0.25)', 'rgba(15, 23, 42, 0.1)'],
    canopyBorder: '#7dd3fc',
    canopyReflection: 'rgba(255, 255, 255, 0.95)',
    flameCore: ['#ffffff', '#38bdf8', '#0284c7', 'rgba(2, 132, 199, 0)'],
    flameAura: ['rgba(56, 189, 248, 0.85)', 'rgba(14, 165, 233, 0.35)'],
    trailColors: ['#38bdf8', '#0098ea', '#ffffff', '#67e8f9', '#0284c7'],
    pilotType: 1,
  },
  {
    id: 2,
    name: 'Imperial 24K',
    nameRu: 'Империал 24K',
    pilotNameRu: 'Король Пепе',
    hullGradient: ['#fffbeb', '#fde047', '#eab308', '#ca8a04'],
    hullBorder: 'rgba(234, 179, 8, 0.9)',
    accentColor: '#fbbf24',
    accentGlow: '#f59e0b',
    wingFill: ['#1e293b', '#0f172a'],
    wingBorder: '#fde047',
    wingtipLight: '#fef08a',
    nozzleFill: '#0f172a',
    nozzleRing: '#fbbf24',
    decalColor: '#fbbf24',
    decalSubtext: 'ROYAL · VIP',
    canopyGradient: ['rgba(255, 255, 255, 0.8)', 'rgba(254, 240, 138, 0.25)', 'rgba(245, 158, 11, 0.08)'],
    canopyBorder: '#fef08a',
    canopyReflection: 'rgba(255, 255, 255, 0.98)',
    flameCore: ['#ffffff', '#fde047', '#f59e0b', 'rgba(245, 158, 11, 0)'],
    flameAura: ['rgba(245, 158, 11, 0.85)', 'rgba(251, 191, 36, 0.4)'],
    trailColors: ['#fbbf24', '#f59e0b', '#ffffff', '#fde68a', '#d97706'],
    pilotType: 2,
  },
]

interface Rocket3DCanvasProps {
  phase: CrashPhase
  multiplier: number
  roundId?: number
  skinIndex?: number
  fullscreen?: boolean
  className?: string
}

export function Rocket3DCanvas({
  phase,
  multiplier,
  roundId,
  skinIndex,
  fullscreen = false,
  className,
}: Rocket3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const prevPhaseRef = useRef<CrashPhase>(phase)

  // Держим свежие пропсы для цикла анимации (синхронное обновление)
  const propsRef = useRef({ phase, multiplier, roundId, skinIndex, fullscreen })
  propsRef.current = { phase, multiplier, roundId, skinIndex, fullscreen }

  // Внутреннее состояние анимации
  const stateRef = useRef<{
    time: number
    shake: number
    stars: Star[]
    speedStreaks: SpeedStreak[]
    trail: TrailParticle[]
    explosion: ExplosionParticle[]
    debris: DebrisShard[]
    shockwaveRadius: number
    shockwaveAlpha: number
    flashAlpha: number
    rocketPos: { x: number; y: number; angle: number }
    flightSeconds: number
    lastFrameTime: number
    rocketSmooth: { x: number; y: number; angle: number }
    /** сглаженный «надув» корпуса, растёт с множителем */
    inflate: number
    /** секунды с начала предвзрывного раздувания; -1 — не идёт */
    swellT: number
    burstFn?: () => void
  }>({
    time: 0,
    shake: 0,
    stars: [],
    speedStreaks: [],
    trail: [],
    explosion: [],
    debris: [],
    shockwaveRadius: 0,
    shockwaveAlpha: 0,
    flashAlpha: 0,
    rocketPos: { x: 0, y: 0, angle: 0 },
    flightSeconds: 0,
    lastFrameTime: 0,
    rocketSmooth: { x: 0, y: 0, angle: 0 },
    inflate: 1,
    swellT: -1,
  })

  // Инициализация фоновых звёзд по всему экрану (Starfield)
  useEffect(() => {
    const stars: Star[] = []
    const count = 90
    for (let i = 0; i < count; i++) {
      const layer = Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 3
      stars.push({
        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
        y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 900),
        size: layer === 1 ? 1 + Math.random() : layer === 2 ? 1.8 + Math.random() : 2.8 + Math.random() * 1.5,
        speed: layer === 1 ? 0.35 + Math.random() * 0.25 : layer === 2 ? 1.0 + Math.random() * 0.5 : 2.2 + Math.random() * 1.1,
        opacity: layer === 1 ? 0.35 + Math.random() * 0.3 : layer === 2 ? 0.6 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15,
        layer,
      })
    }
    stateRef.current.stars = stars
  }, [])

  // Триггер смены фаз (старт полета, взрыв и распад ракеты на кусочки)
  useEffect(() => {
    const state = stateRef.current
    if (phase === 'betting') {
      state.trail = []
      state.speedStreaks = []
      state.explosion = []
      state.debris = []
      state.shake = 0
      state.flightSeconds = 0
      state.rocketSmooth = { x: 0, y: 0, angle: 0 }
      state.swellT = -1
      state.burstFn = undefined
      state.inflate = 1
    } else if (prevPhaseRef.current !== 'flying' && phase === 'flying') {
      state.flightSeconds = 0
      state.trail = []
      state.speedStreaks = []
      state.explosion = []
      state.debris = []
      state.shake = 0
      state.rocketSmooth = { x: 0, y: 0, angle: 0 }
      state.swellT = -1
      state.burstFn = undefined
    } else if (prevPhaseRef.current !== 'crashed' && phase === 'crashed') {
      // Сначала ракета «надувается» (0.16 c), затем лопается: взрыв запускается из цикла отрисовки
      state.swellT = 0
      state.burstFn = () => {
        const rx = state.rocketPos.x > 0 ? state.rocketPos.x : (typeof window !== 'undefined' ? window.innerWidth * 0.52 : 200)
        const ry = state.rocketPos.y > 0 ? state.rocketPos.y : (typeof window !== 'undefined' ? window.innerHeight * 0.36 : 100)

        state.shake = 22 // амплитуда тряски
        state.flashAlpha = 0.9 // вспышка взрыва
        state.shockwaveRadius = 16
        state.shockwaveAlpha = 1.0

        // 1. Создаём частицы огненного взрыва
        const exp: ExplosionParticle[] = []
        const colors = ['#ffffff', '#38bdf8', '#60a5fa', '#fbbf24', '#ef4444', '#fb923c']
        for (let i = 0; i < 65; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = 2.5 + Math.random() * 10
          const maxLife = 40 + Math.floor(Math.random() * 40)
          exp.push({
            x: rx,
            y: ry,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 7,
            alpha: 1,
            color: colors[Math.floor(Math.random() * colors.length)] ?? '#fbbf24',
            life: 0,
            maxLife,
            spin: (Math.random() - 0.5) * 0.35,
            angle: Math.random() * Math.PI * 2,
          })
        }
        state.explosion = exp

        // 2. Создаём РАЗЛЕТАЮЩИЕСЯ КУСКИ РАКЕТЫ (Debris Shards):
        // Носовой конус, дельта-крылья, стекло кабины, сопло, обшивка с надписью SEXY, и капсула с Пепе!
        const debris: DebrisShard[] = [
          // Носовой конус — летит вперед и вверх
          {
            type: 'nose',
            x: rx + 25,
            y: ry - 4,
            vx: 4.5 + Math.random() * 2.5,
            vy: -5.5 - Math.random() * 2.5,
            angle: 0.2,
            spin: 0.14,
            alpha: 1,
            life: 0,
            maxLife: 80,
          },
          // Верхнее крыло — взлетает вверх
          {
            type: 'wing_top',
            x: rx - 10,
            y: ry - 18,
            vx: -2 + Math.random() * 2,
            vy: -7 - Math.random() * 2.5,
            angle: -0.4,
            spin: -0.16,
            alpha: 1,
            life: 0,
            maxLife: 75,
          },
          // Нижнее крыло — отлетает вниз
          {
            type: 'wing_bot',
            x: rx - 10,
            y: ry + 16,
            vx: -1.5 + Math.random() * 2,
            vy: 6 + Math.random() * 3,
            angle: 0.5,
            spin: 0.18,
            alpha: 1,
            life: 0,
            maxLife: 75,
          },
          // Осколок стекла фонаря кабины
          {
            type: 'canopy',
            x: rx + 8,
            y: ry - 10,
            vx: 2.2 + Math.random() * 2.5,
            vy: -4 - Math.random() * 2,
            angle: 0.1,
            spin: 0.22,
            alpha: 1,
            life: 0,
            maxLife: 70,
          },
          // Титановое сопло двигателя — отлетает назад
          {
            type: 'nozzle',
            x: rx - 35,
            y: ry,
            vx: -6.5 - Math.random() * 2.5,
            vy: -1 + Math.random() * 3,
            angle: -0.2,
            spin: -0.12,
            alpha: 1,
            life: 0,
            maxLife: 85,
          },
          // Обломки обшивки фюзеляжа с маркировкой
          {
            type: 'fuselage_shard',
            x: rx - 5,
            y: ry + 5,
            vx: -3 + Math.random() * 3,
            vy: -3.5 + Math.random() * 4,
            angle: 0,
            spin: 0.15,
            alpha: 1,
            life: 0,
            maxLife: 70,
          },
          {
            type: 'fuselage_shard',
            x: rx - 15,
            y: ry - 5,
            vx: 3 + Math.random() * 2,
            vy: 3 + Math.random() * 3,
            angle: 0.8,
            spin: -0.2,
            alpha: 1,
            life: 0,
            maxLife: 70,
          },
          // Спасательная капсула с картунным Пепе!
          {
            type: 'pepe_bubble',
            x: rx,
            y: ry - 14,
            vx: 1.2 + Math.random() * 2,
            vy: -6 - Math.random() * 2,
            angle: 0,
            spin: 0.08,
            alpha: 1,
            life: 0,
            maxLife: 95,
          },
        ]
        state.debris = debris
      }
    }
    prevPhaseRef.current = phase
  }, [phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof canvas.getContext !== 'function') return
    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      return
    }
    if (!ctx) return

    let animId: number

    const render = () => {
      animId = requestAnimationFrame(render)
      if (!ctx || !canvas) return
      const currentProps = propsRef.current
      const currentPhase = currentProps.phase
      const currentMult = currentProps.multiplier

      // Выбор активного скина ракеты и пилота Пепе
      const activeSkinIndex =
        currentProps.skinIndex !== undefined
          ? Math.abs(currentProps.skinIndex) % ROCKET_SKINS.length
          : Math.abs(currentProps.roundId ?? 0) % ROCKET_SKINS.length
      const skin = ROCKET_SKINS[activeSkinIndex] ?? ROCKET_SKINS[0]!

      // Размеры холста (при fullscreen — на всё окно экрана)
      const width = currentProps.fullscreen && typeof window !== 'undefined'
        ? window.innerWidth
        : (canvas.clientWidth || 360)
      const height = currentProps.fullscreen && typeof window !== 'undefined'
        ? window.innerHeight
        : (canvas.clientHeight || 280)
      const dpr = Math.min(2, typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1)

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      ctx.save()
      try {
        ctx.scale(dpr, dpr)

        const state = stateRef.current
        const now = performance.now()
        const lastTime = state.lastFrameTime || now
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000))
        state.lastFrameTime = now
        state.time += dt

        // Тряска экрана при взрыве
        if (state.shake > 0.1) {
          const ox = (Math.random() - 0.5) * state.shake
          const oy = (Math.random() - 0.5) * state.shake
          ctx.translate(ox, oy)
          state.shake *= 0.9
        } else {
          state.shake = 0
        }

        // Очистка холста
        ctx.clearRect(-20, -20, width + 40, height + 40)

        // --- 1. Пролетающие фоновые звёзды ПО ВСЕМУ ЭКРАНУ (Starfield) ---
        const flightSpeedFactor =
          currentPhase === 'flying' ? Math.min(6.5, 1.2 + Math.log2(Math.max(1, currentMult)) * 1.6) : 0.65

        ctx.save()
        for (const star of state.stars) {
          star.x -= star.speed * flightSpeedFactor
          if (star.x < 0) {
            star.x = width + Math.random() * 50
            star.y = Math.random() * height
          }

          if (currentPhase === 'flying' && star.layer >= 2) {
            const streakLen = star.speed * flightSpeedFactor * 4.5
            const grad = ctx.createLinearGradient(star.x, star.y, star.x + streakLen, star.y)
            grad.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`)
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
            ctx.strokeStyle = grad
            ctx.lineWidth = star.size * 0.75
            ctx.beginPath()
            ctx.moveTo(star.x, star.y)
            ctx.lineTo(star.x + streakLen, star.y)
            ctx.stroke()
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
            ctx.beginPath()
            ctx.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.restore()

        // --- 1.1 Космические полосы скорости (Speed Streaks) в фазе полёта ---
        if (currentPhase === 'flying') {
          if (state.speedStreaks.length < 10 && Math.random() < 0.35) {
            state.speedStreaks.push({
              x: width + 20,
              y: height * 0.12 + Math.random() * (height * 0.72),
              len: 30 + Math.random() * 55,
              speed: (14 + Math.random() * 16) * Math.min(2.5, 1 + Math.log2(Math.max(1, currentMult)) * 0.4),
              alpha: 0.25 + Math.random() * 0.4,
              width: 1.2 + Math.random() * 1.0,
            })
          }

          ctx.save()
          for (let i = state.speedStreaks.length - 1; i >= 0; i--) {
            const s = state.speedStreaks[i]!
            s.x -= s.speed
            if (s.x + s.len < -20) {
              state.speedStreaks.splice(i, 1)
              continue
            }
            ctx.strokeStyle = `rgba(255, 255, 255, ${s.alpha})`
            ctx.lineWidth = s.width
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(s.x, s.y)
            ctx.lineTo(s.x + s.len, s.y)
            ctx.stroke()
          }
          ctx.restore()
        }

        // Во время отсчёта (betting) ракета не отображается (показывается только таймер)
        if (currentPhase === 'betting') {
          state.trail = []
          state.speedStreaks = []
          return
        }

        // --- 2. Позиция ракеты: Плавный взлёт на старте и ОСТАНОВКА НА БАРЬЕРЕ ---
        state.flightSeconds += dt

        // Точка старта (нижняя левая область арены)
        const launchX = width * 0.20
        const launchY = height * 0.58
        const launchAngle = -28

        // Точка круизного барьера (центр/верх арены — ракета доходит сюда и ОСТАНАВЛИВАЕТСЯ)
        const barrierX = width * 0.52
        const barrierY = height * 0.36
        const barrierAngle = -6

        // Плавный и аккуратный взлёт на старте: ровно за ~1.2 секунды ракета подходит к барьеру
        const riseDuration = 1.2
        const riseProgress = Math.min(1, state.flightSeconds / riseDuration)
        // easeOutCubic: быстрый мягкий подъём с замедлением до полной остановки
        const easeRise = 1 - Math.pow(1 - riseProgress, 3)

        // Целевые координаты (строго останавливаются у барьера, НЕ улетают!)
        const targetX = launchX + (barrierX - launchX) * easeRise
        const targetY = launchY + (barrierY - launchY) * easeRise
        const targetAngle = launchAngle + (barrierAngle - launchAngle) * easeRise

        // Естественные микро-колебания полёта на барьере
        const hoverY = Math.sin(state.flightSeconds * 3.2) * 2.5
        const hoverAngle = Math.sin(state.flightSeconds * 2.0) * 1.0

        // Frame-rate independent экспоненциальное сглаживание (полное исключение лагов и телепортов!)
        const lerpFactor = 1 - Math.exp(-dt * 14)
        if (state.rocketSmooth.x === 0 && state.rocketSmooth.y === 0) {
          state.rocketSmooth.x = targetX
          state.rocketSmooth.y = targetY + hoverY
          state.rocketSmooth.angle = targetAngle + hoverAngle
        } else {
          state.rocketSmooth.x += (targetX - state.rocketSmooth.x) * lerpFactor
          state.rocketSmooth.y += (targetY + hoverY - state.rocketSmooth.y) * lerpFactor
          state.rocketSmooth.angle += (targetAngle + hoverAngle - state.rocketSmooth.angle) * lerpFactor
        }

        const currentX = state.rocketSmooth.x
        const currentY = state.rocketSmooth.y
        const currentAngle = state.rocketSmooth.angle

        state.rocketPos = { x: currentX, y: currentY, angle: currentAngle }

        // --- 2. Неоновая дуговая траектория полёта и шлейф плазмы ---
        if (currentPhase === 'flying') {
          const rad = (currentAngle * Math.PI) / 180
          const nozzleDist = 50 * 1.22
          const nozzleX = currentX - Math.cos(rad) * nozzleDist
          const nozzleY = currentY - Math.sin(rad) * nozzleDist

          // Старт дуги из точки запуска в левом нижнем секторе
          const startArcX = width * 0.08
          const startArcY = height * 0.72

          // Плавная выпуклая контрольная точка
          const ctrlX = startArcX + (nozzleX - startArcX) * 0.52
          const ctrlY = startArcY + (nozzleY - startArcY) * 0.15

          ctx.save()
          ctx.lineCap = 'round'

          // 1. Внешнее мягкое неоновое свечение шлейфа (Electric Glow)
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)'
          ctx.lineWidth = 10
          ctx.shadowColor = skin.accentColor
          ctx.shadowBlur = 18
          ctx.beginPath()
          ctx.moveTo(startArcX, startArcY)
          ctx.quadraticCurveTo(ctrlX, ctrlY, nozzleX, nozzleY)
          ctx.stroke()

          // 2. Внутреннее яркое градиентное ядро дуги (плавное появление от старта к соплу)
          const arcGrad = ctx.createLinearGradient(startArcX, startArcY, nozzleX, nozzleY)
          arcGrad.addColorStop(0, 'rgba(56, 189, 248, 0.05)')
          arcGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.55)')
          arcGrad.addColorStop(1, skin.accentGlow)
          ctx.strokeStyle = arcGrad
          ctx.lineWidth = 3.6
          ctx.shadowBlur = 8
          ctx.shadowColor = skin.accentGlow
          ctx.beginPath()
          ctx.moveTo(startArcX, startArcY)
          ctx.quadraticCurveTo(ctrlX, ctrlY, nozzleX, nozzleY)
          ctx.stroke()
          ctx.restore()

        // 3. Аккуратные частицы плазмы непосредственно за соплом
        for (let n = 0; n < 2; n++) {
          if (Math.random() > 0.55) continue
          const spread = (Math.random() - 0.5) * 9
          const perpX = -Math.sin(rad) * spread
          const perpY = Math.cos(rad) * spread
          const shapeRoll = Math.random()
          const pSpeed = 2.6 + Math.random() * 3.8
          const pAngle = rad + Math.PI + (Math.random() - 0.5) * 0.25

          state.trail.push({
            x: nozzleX + perpX,
            y: nozzleY + perpY,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            size: 3 + Math.random() * 5,
            alpha: 0.9,
            color: skin.trailColors[Math.floor(Math.random() * skin.trailColors.length)] ?? skin.accentColor,
            life: 0,
            maxLife: 26 + Math.floor(Math.random() * 18),
            shape: shapeRoll < 0.22 ? 2 : shapeRoll < 0.45 ? 1 : 0,
          })
        }
      }

      // Отрисовка частиц выхлопа (аддитивное свечение без shadowBlur — дёшево для слабых устройств)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = state.trail.length - 1; i >= 0; i--) {
        const p = state.trail[i]!
        p.life++
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.95
        p.vy *= 0.95
        p.alpha = Math.max(0, 1 - p.life / p.maxLife)
        p.size *= 0.98

        if (p.life >= p.maxLife || p.alpha <= 0.02) {
          state.trail.splice(i, 1)
          continue
        }

        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha * 0.8
        ctx.beginPath()
        const r = p.size / 2
        if (p.shape === 1) {
          // четырёхлучевая звёздочка-искра
          ctx.moveTo(p.x, p.y - r * 1.9)
          ctx.quadraticCurveTo(p.x, p.y, p.x + r * 1.9, p.y)
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r * 1.9)
          ctx.quadraticCurveTo(p.x, p.y, p.x - r * 1.9, p.y)
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r * 1.9)
        } else if (p.shape === 2) {
          // капля — отсылка к DROP
          ctx.moveTo(p.x, p.y - r * 1.7)
          ctx.bezierCurveTo(p.x + r * 1.5, p.y - r * 0.2, p.x + r * 1.2, p.y + r * 1.3, p.x, p.y + r * 1.3)
          ctx.bezierCurveTo(p.x - r * 1.2, p.y + r * 1.3, p.x - r * 1.5, p.y - r * 0.2, p.x, p.y - r * 1.7)
        } else {
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        }
        ctx.fill()
      }
      ctx.restore()

      // Плавный «надув» корпуса по мере роста множителя (лёгкое надувание)
      const inflateTarget = currentPhase === 'flying' ? 1 + Math.min(0.14, Math.log2(Math.max(1, currentMult)) * 0.04) : 1
      state.inflate += (inflateTarget - state.inflate) * Math.min(1, dt * 2.5)

      // Предвзрывное раздувание: ракета пухнет и лопается
      const SWELL_DURATION = 0.16
      let swelling = false
      if (currentPhase === 'crashed' && state.swellT >= 0) {
        state.swellT += dt
        if (state.swellT >= SWELL_DURATION) {
          state.burstFn?.()
          state.burstFn = undefined
          state.swellT = -1
        } else {
          swelling = true
        }
      }

      // --- 3. Отрисовка высокодетализированной 3D Ракеты с NFT Plush Pepe (в полёте и при раздувании) ---
      if (currentPhase === 'flying' || swelling) {
        ctx.save()
        ctx.translate(currentX, currentY)
        ctx.rotate((currentAngle * Math.PI) / 180)

        // Зацикленное пульсирование/дыхание двигателя (Engine Breathing Cycle)
        const breathe = 1.0 + Math.sin(state.time * 6.5) * 0.035
        // Медленный вдох-выдох + рост «надува»; перед взрывом корпус раздувается до ×1.5
        const puff = state.inflate * (1 + Math.sin(state.time * 2.2) * 0.022)
        const swellK = swelling ? 1 + Math.pow(state.swellT / SWELL_DURATION, 2) * 0.5 : 1
        ctx.scale(1.22 * breathe * swellK * (1 + (puff - 1) * 0.5), 1.22 * breathe * swellK * puff)

        // 3.1. Реактивное пламя двигателя форсажа (при раздувании двигатель уже заглох)
        if (!swelling) {
          const flameFlicker = 0.9 + Math.random() * 0.2
          const flameLen = (65 + Math.min(38, currentMult * 3.5)) * flameFlicker
          const flameWidth = 16 * breathe

          // Внешняя аристократическая аура пламени
          const flameAuraGrad = ctx.createRadialGradient(-50, 0, 5, -50 - flameLen * 0.6, 0, flameLen)
          flameAuraGrad.addColorStop(0, skin.flameAura[0])
          flameAuraGrad.addColorStop(0.55, skin.flameAura[1])
          flameAuraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
          ctx.fillStyle = flameAuraGrad
          ctx.beginPath()
          ctx.ellipse(-50 - flameLen * 0.4, 0, flameLen * 0.7, flameWidth * 1.9, 0, 0, Math.PI * 2)
          ctx.fill()

          // Основное реактивное ядро плазмы
          ctx.beginPath()
          ctx.moveTo(-50, -flameWidth / 2)
          ctx.quadraticCurveTo(-50 - flameLen * 0.5, -flameWidth * 0.65, -50 - flameLen, 0)
          ctx.quadraticCurveTo(-50 - flameLen * 0.5, flameWidth * 0.65, -50, flameWidth / 2)
          ctx.closePath()

          const coreFlameGrad = ctx.createLinearGradient(-50, 0, -50 - flameLen, 0)
          coreFlameGrad.addColorStop(0, skin.flameCore[0])
          coreFlameGrad.addColorStop(0.25, skin.flameCore[1])
          coreFlameGrad.addColorStop(0.7, skin.flameCore[2])
          coreFlameGrad.addColorStop(1, skin.flameCore[3])
          ctx.fillStyle = coreFlameGrad
          ctx.fill()

          // Сверхзвуковые узлы плазмы (Mach Diamonds)
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.ellipse(-66, 0, 5, 2.2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = skin.accentColor
          ctx.beginPath()
          ctx.ellipse(-84, 0, 3.8, 1.8, 0, 0, Math.PI * 2)
          ctx.fill()
        }

        // 3.2. Сопло двигателя (Тёмный полированный титан с неоновым кольцом)
        ctx.fillStyle = skin.nozzleFill
        ctx.strokeStyle = skin.nozzleRing
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.ellipse(-48, 0, 5.5, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // 3.3. 3D Дельта-Крылья ракеты (Стреловидные аэрокосмические стабилизаторы)
        // Верхнее крыло (Dorsal Stabilizer)
        const topWingGrad = ctx.createLinearGradient(-14, -14, -42, -32)
        topWingGrad.addColorStop(0, skin.wingFill[0])
        topWingGrad.addColorStop(1, skin.wingFill[1])
        ctx.fillStyle = topWingGrad
        ctx.strokeStyle = skin.wingBorder
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(-12, -13)
        ctx.lineTo(-42, -32)
        ctx.quadraticCurveTo(-44, -34, -41, -30)
        ctx.lineTo(-28, -11)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Нижнее крыло (Ventral Wing)
        const botWingGrad = ctx.createLinearGradient(-14, 14, -40, 30)
        botWingGrad.addColorStop(0, skin.wingFill[0])
        botWingGrad.addColorStop(1, skin.wingFill[1])
        ctx.fillStyle = botWingGrad
        ctx.strokeStyle = skin.wingBorder
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(-12, 13)
        ctx.lineTo(-40, 30)
        ctx.quadraticCurveTo(-42, 32, -39, 29)
        ctx.lineTo(-27, 11)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Огоньки габаритов на законцовках крыльев
        ctx.fillStyle = skin.wingtipLight
        ctx.shadowColor = skin.wingtipLight
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(-41, -31, 2.2, 0, Math.PI * 2)
        ctx.arc(-39, 29, 2.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // 3.4. Основной фюзеляж ракеты (3D Volumetric Fuselage - стреловидный чистый корпус)
        const hullGrad = ctx.createLinearGradient(0, -20, 0, 20)
        hullGrad.addColorStop(0, skin.hullGradient[0])
        hullGrad.addColorStop(0.24, skin.hullGradient[1])
        hullGrad.addColorStop(0.70, skin.hullGradient[2])
        hullGrad.addColorStop(1, skin.hullGradient[3])

        ctx.fillStyle = hullGrad
        ctx.strokeStyle = skin.hullBorder
        ctx.lineWidth = 1.4

        ctx.beginPath()
        ctx.moveTo(56, 0) // Элегантный носовой конус
        ctx.bezierCurveTo(46, -15, 16, -18, -48, -13) // Плавный верхний контур
        ctx.lineTo(-48, 13) // Корма
        ctx.bezierCurveTo(16, 18, 46, 15, 56, 0) // Плавный нижний контур
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Чистые технологичные стыки обшивки фюзеляжа (без кривого текста!)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(28, -14)
        ctx.quadraticCurveTo(30, 0, 28, 14)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(-16, -16)
        ctx.quadraticCurveTo(-14, 0, -16, 16)
        ctx.stroke()

        // Сверхзвуковая неоновая лазерная линия по центру фюзеляжа
        ctx.strokeStyle = skin.accentColor
        ctx.lineWidth = 2.4
        ctx.shadowColor = skin.accentGlow
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(-36, 0)
        ctx.lineTo(34, 0)
        ctx.stroke()
        ctx.shadowBlur = 0

        // SEXY DROP — надпись на борту (отсылка к названию бота) + капля
        ctx.save()
        ctx.font = '800 7.6px system-ui, -apple-system, "Segoe UI", Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        try {
          ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '1.1px'
        } catch {
          /* старые WebView без letterSpacing */
        }
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2.2
        ctx.strokeStyle = 'rgba(8, 12, 28, 0.6)'
        ctx.strokeText('SEXY DROP', -4, 9.6)
        ctx.fillStyle = '#ffffff'
        ctx.fillText('SEXY DROP', -4, 9.6)
        // капля у кормы
        ctx.fillStyle = skin.accentColor
        ctx.beginPath()
        ctx.moveTo(-37, 5.4)
        ctx.bezierCurveTo(-34.6, 8, -34.6, 11.6, -37, 11.6)
        ctx.bezierCurveTo(-39.4, 11.6, -39.4, 8, -37, 5.4)
        ctx.fill()
        ctx.restore()

        // 3.5. Пилот: Мультяшный NFT Plush Pepe в кабине
        ctx.save()
        // Тёмная глубина ниши кабины
        ctx.fillStyle = '#0a0f1d'
        ctx.beginPath()
        ctx.ellipse(14, -7, 16, 8, 0, 0, Math.PI * 2)
        ctx.fill()

        const pepeBob = Math.sin(state.time * 6.5) * 0.7
        const px = 14
        const py = -9 + pepeBob

        // Туловище в скафандре
        const suitGrad = ctx.createLinearGradient(px - 6, py + 2, px + 6, py + 8)
        suitGrad.addColorStop(0, '#f1f5f9')
        suitGrad.addColorStop(1, '#94a3b8')
        ctx.fillStyle = suitGrad
        ctx.beginPath()
        ctx.ellipse(px + 2, py + 6.5, 8.5, 4.5, 0, 0, Math.PI * 2)
        ctx.fill()

        // Лапки пилота
        ctx.fillStyle = '#4ade80'
        ctx.beginPath()
        ctx.arc(px + 4, py + 5.2, 1.8, 0, Math.PI * 2)
        ctx.arc(px + 9, py + 5.2, 1.8, 0, Math.PI * 2)
        ctx.fill()

        // Голова Пепе
        const headGrad = ctx.createLinearGradient(px - 7, py - 7, px + 7, py + 5)
        headGrad.addColorStop(0, '#4ade80')
        headGrad.addColorStop(1, '#16a34a')
        ctx.fillStyle = headGrad
        ctx.strokeStyle = '#14532d'
        ctx.lineWidth = 0.9
        ctx.beginPath()
        ctx.ellipse(px, py, 7.8, 6.2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Щёчки и милая улыбка
        ctx.fillStyle = '#86efac'
        ctx.beginPath()
        ctx.ellipse(px + 1, py + 2.4, 5.5, 2.2, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = '#14532d'
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.moveTo(px - 3.5, py + 2.2)
        ctx.quadraticCurveTo(px + 0.5, py + 3.8, px + 4.5, py + 1.8)
        ctx.stroke()

        // Выразительные круглые глаза с яркими бликами
        const drawCartoonEye = (ex: number, ey: number) => {
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = '#14532d'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.ellipse(ex, ey, 3.2, 3.6, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()

          // Зрачок
          ctx.fillStyle = '#0f172a'
          ctx.beginPath()
          ctx.arc(ex + 0.8, ey - 0.4, 1.7, 0, Math.PI * 2)
          ctx.fill()

          // Блики
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(ex + 0.3, ey - 1.1, 0.8, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(ex + 1.4, ey + 0.2, 0.4, 0, Math.PI * 2)
          ctx.fill()
        }

        drawCartoonEye(px - 2.6, py - 3.6)
        drawCartoonEye(px + 3.4, py - 3.6)

        // Аксессуары пилота
        if (skin.pilotType === 0) {
          // Антенна связи скафандра
          ctx.strokeStyle = '#94a3b8'
          ctx.lineWidth = 1.0
          ctx.beginPath()
          ctx.moveTo(px - 6.5, py - 1.0)
          ctx.lineTo(px - 8.5, py - 5.0)
          ctx.stroke()
          ctx.fillStyle = '#38bdf8'
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 4
          ctx.beginPath()
          ctx.arc(px - 8.5, py - 5.0, 1.4, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
        } else if (skin.pilotType === 1) {
          // Кибер-визор
          ctx.save()
          ctx.fillStyle = 'rgba(56, 189, 248, 0.85)'
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 1.0
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 6
          ctx.beginPath()
          safeRoundRect(ctx, px - 5.8, py - 5.8, 12.5, 4.8, 1.8)
          ctx.fill()
          ctx.stroke()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.0
          ctx.beginPath()
          ctx.moveTo(px - 3, py - 2.5)
          ctx.lineTo(px + 2, py - 5.0)
          ctx.stroke()
          ctx.restore()
        } else {
          // Золотая корона
          ctx.save()
          const crownGrad = ctx.createLinearGradient(px - 4, py - 12, px + 4, py - 7)
          crownGrad.addColorStop(0, '#fde047')
          crownGrad.addColorStop(1, '#ca8a04')
          ctx.fillStyle = crownGrad
          ctx.strokeStyle = '#854d0e'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.moveTo(px - 4.0, py - 7.0)
          ctx.lineTo(px - 5.0, py - 11.5)
          ctx.lineTo(px - 1.2, py - 8.8)
          ctx.lineTo(px + 0.5, py - 13.0)
          ctx.lineTo(px + 2.2, py - 8.8)
          ctx.lineTo(px + 5.5, py - 11.5)
          ctx.lineTo(px + 4.5, py - 7.0)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#ef4444'
          ctx.beginPath()
          ctx.arc(px + 0.5, py - 9.2, 1.3, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        ctx.restore()

        // 3.6. Стекло фонаря кабины (Кристальный ультра-прозрачный аэрокосмический купол)
        const canopyGrad = ctx.createLinearGradient(12, -22, 16, 2)
        canopyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)') // Верхняя кристальная грань
        canopyGrad.addColorStop(0.2, skin.canopyGradient[0])
        canopyGrad.addColorStop(0.65, skin.canopyGradient[1])
        canopyGrad.addColorStop(1, skin.canopyGradient[2])

        ctx.fillStyle = canopyGrad
        ctx.strokeStyle = skin.canopyBorder
        ctx.lineWidth = 1.2

        ctx.beginPath()
        ctx.moveTo(33, -1)
        ctx.bezierCurveTo(27, -19, 3, -19, -4, -3)
        ctx.bezierCurveTo(6, 0, 24, 0, 33, -1)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Верхний дуговой глянцевый блик стекла
        ctx.strokeStyle = skin.canopyReflection
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.ellipse(14, -14, 11, 2.5, -0.15, Math.PI * 0.9, Math.PI * 1.9)
        ctx.stroke()

        // Дополнительный искрящийся блик на переднем скате стекла
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.ellipse(24, -8, 4.5, 1.5, -0.28, Math.PI * 0.8, Math.PI * 1.8)
        ctx.stroke()

        // Звёздная искорка на стекле (Glint Sparkle)
        const glintX = 26
        const glintY = -11
        ctx.save()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(glintX - 3.5, glintY)
        ctx.lineTo(glintX + 3.5, glintY)
        ctx.moveTo(glintX, glintY - 3.5)
        ctx.lineTo(glintX, glintY + 3.5)
        ctx.stroke()
        ctx.restore()

        ctx.restore()
      }

      // --- 4. Анимация Взрыва и Разлетающихся Обломков Ракеты (Crash Debris & Shatter) ---
      if (currentPhase === 'crashed') {
        const rx = state.rocketPos.x || width / 2
        const ry = state.rocketPos.y || (currentProps.fullscreen ? Math.min(height * 0.35, 240) : height / 2)

        // Мягкая радиальная вспышка взрыва (БЕЗ прямоугольных рамок и границ холста!)
        if (state.flashAlpha > 0.01) {
          ctx.save()
          const flashGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, 150)
          flashGrad.addColorStop(0, `rgba(255, 255, 255, ${state.flashAlpha * 0.85})`)
          flashGrad.addColorStop(0.25, `rgba(56, 189, 248, ${state.flashAlpha * 0.45})`)
          flashGrad.addColorStop(0.65, `rgba(14, 165, 233, ${state.flashAlpha * 0.15})`)
          flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
          ctx.fillStyle = flashGrad
          ctx.beginPath()
          ctx.arc(rx, ry, 150, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          state.flashAlpha *= 0.86
        }

        // Ударная волна взрыва (Shockwave Ring)
        if (state.shockwaveAlpha > 0.02) {
          ctx.save()
          ctx.strokeStyle = `rgba(239, 68, 68, ${state.shockwaveAlpha})`
          ctx.lineWidth = 3
          ctx.shadowColor = '#ef4444'
          ctx.shadowBlur = 14
          ctx.beginPath()
          ctx.arc(rx, ry, state.shockwaveRadius, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()

          state.shockwaveRadius += 5
          state.shockwaveAlpha *= 0.92
        }

        // 4.1. Отрисовка разлетающихся обломков ракеты (Debris Shatter)
        ctx.save()
        for (let i = state.debris.length - 1; i >= 0; i--) {
          const d = state.debris[i]!
          d.life++
          d.x += d.vx
          d.y += d.vy
          d.vy += 0.16 // гравитация
          d.vx *= 0.985 // сопротивление
          d.angle += d.spin
          d.alpha = Math.max(0, 1 - d.life / d.maxLife)

          if (d.life >= d.maxLife || d.alpha <= 0.02) {
            state.debris.splice(i, 1)
            continue
          }

          ctx.save()
          ctx.translate(d.x, d.y)
          ctx.rotate(d.angle)
          ctx.globalAlpha = d.alpha

          if (d.type === 'nose') {
            // Металлический носовой конус
            ctx.fillStyle = skin.hullGradient[1]
            ctx.strokeStyle = skin.hullBorder
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(18, 0)
            ctx.lineTo(-8, -9)
            ctx.lineTo(-8, 9)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
          } else if (d.type === 'wing_top' || d.type === 'wing_bot') {
            // Оторванное дельта-крыло с неоновым огоньком
            ctx.fillStyle = skin.wingFill[0]
            ctx.strokeStyle = skin.wingBorder
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.moveTo(-12, 0)
            ctx.lineTo(12, -18)
            ctx.lineTo(6, 6)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = skin.wingtipLight
            ctx.beginPath()
            ctx.arc(12, -18, 2.2, 0, Math.PI * 2)
            ctx.fill()
          } else if (d.type === 'canopy') {
            // Осколок стекла фонаря
            ctx.fillStyle = skin.canopyGradient[0]
            ctx.strokeStyle = skin.canopyBorder
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(-10, -4)
            ctx.quadraticCurveTo(0, -12, 10, 0)
            ctx.quadraticCurveTo(0, 4, -10, -4)
            ctx.fill()
            ctx.stroke()
          } else if (d.type === 'nozzle') {
            // Сопло двигателя
            ctx.fillStyle = skin.nozzleFill
            ctx.strokeStyle = skin.nozzleRing
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.ellipse(0, 0, 5, 9, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
          } else if (d.type === 'fuselage_shard') {
            // Обломок обшивки фюзеляжа с технологической линией
            ctx.fillStyle = skin.hullGradient[2]
            ctx.strokeStyle = skin.accentColor
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.rect(-9, -6, 18, 12)
            ctx.fill()
            ctx.stroke()
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.moveTo(-6, 0)
            ctx.lineTo(6, 0)
            ctx.stroke()
          } else if (d.type === 'pepe_bubble') {
            // Спасательная капсула с картунным Пепе со спиральными глазами
            ctx.fillStyle = 'rgba(56, 189, 248, 0.35)'
            ctx.strokeStyle = '#38bdf8'
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.arc(0, 0, 11, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = '#4ade80'
            ctx.beginPath()
            ctx.arc(0, 1, 6.5, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = '#ffffff'
            ctx.beginPath()
            ctx.arc(-2.5, -1, 2.5, 0, Math.PI * 2)
            ctx.arc(2.5, -1, 2.5, 0, Math.PI * 2)
            ctx.fill()

            ctx.strokeStyle = '#0f172a'
            ctx.lineWidth = 0.8
            ctx.beginPath()
            ctx.arc(-2.5, -1, 1.2, 0, Math.PI * 1.5)
            ctx.arc(2.5, -1, 1.2, 0, Math.PI * 1.5)
            ctx.stroke()
          }

          ctx.restore()
        }
        ctx.restore()

        // 4.2. Отрисовка частиц огня и искр взрыва
        ctx.save()
        for (let i = state.explosion.length - 1; i >= 0; i--) {
          const exp = state.explosion[i]!
          exp.life++
          exp.x += exp.vx
          exp.y += exp.vy
          exp.vx *= 0.96
          exp.vy *= 0.96
          exp.angle += exp.spin
          exp.alpha = Math.max(0, 1 - exp.life / exp.maxLife)

          if (exp.life >= exp.maxLife || exp.alpha <= 0.01) {
            state.explosion.splice(i, 1)
            continue
          }

          ctx.fillStyle = exp.color
          ctx.globalAlpha = exp.alpha
          ctx.shadowColor = exp.color
          ctx.shadowBlur = 6

          ctx.beginPath()
          ctx.arc(exp.x, exp.y, exp.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    } catch (e) {
        /* prevent frame crash on mobile WebViews */
      } finally {
        ctx.restore()
      }
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      aria-hidden
    />
  )
}
