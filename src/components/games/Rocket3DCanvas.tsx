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
    hullGradient: ['#ffffff', '#cbd5e1', '#334155', '#0f172a'],
    hullBorder: 'rgba(56, 189, 248, 0.7)',
    accentColor: '#38bdf8',
    accentGlow: '#00c6ff',
    wingFill: ['#1e293b', '#0f172a'],
    wingBorder: '#38bdf8',
    wingtipLight: '#38bdf8',
    nozzleFill: '#111827',
    nozzleRing: '#38bdf8',
    decalColor: '#38bdf8',
    decalSubtext: 'SEXY · TON',
    canopyGradient: ['rgba(56, 189, 248, 0.25)', 'rgba(2, 132, 199, 0.35)', 'rgba(15, 23, 42, 0.6)'],
    canopyBorder: '#38bdf8',
    canopyReflection: 'rgba(255, 255, 255, 0.9)',
    flameCore: ['#ffffff', '#38bdf8', '#0284c7', 'rgba(2, 132, 199, 0)'],
    flameAura: ['rgba(56, 189, 248, 0.85)', 'rgba(2, 132, 199, 0.4)'],
    trailColors: ['#38bdf8', '#00c6ff', '#ffffff', '#0284c7', '#93c5fd'],
    pilotType: 0,
  },
  {
    id: 1,
    name: 'Cyber Stealth',
    nameRu: 'Кибер Стелс',
    pilotNameRu: 'Кибер Пепе',
    hullGradient: ['#282e3d', '#1a1f29', '#10131a', '#080a0e'],
    hullBorder: 'rgba(129, 140, 248, 0.75)',
    accentColor: '#818cf8',
    accentGlow: '#38bdf8',
    wingFill: ['#161922', '#0a0d13'],
    wingBorder: '#818cf8',
    wingtipLight: '#a5b4fc',
    nozzleFill: '#0a0d13',
    nozzleRing: '#818cf8',
    decalColor: '#818cf8',
    decalSubtext: 'STEALTH · 99',
    canopyGradient: ['rgba(129, 140, 248, 0.25)', 'rgba(56, 189, 248, 0.35)', 'rgba(11, 15, 24, 0.6)'],
    canopyBorder: '#a5b4fc',
    canopyReflection: 'rgba(240, 245, 255, 0.92)',
    flameCore: ['#ffffff', '#a5b4fc', '#818cf8', 'rgba(129, 140, 248, 0)'],
    flameAura: ['rgba(129, 140, 248, 0.85)', 'rgba(56, 189, 248, 0.4)'],
    trailColors: ['#818cf8', '#38bdf8', '#ffffff', '#a5b4fc', '#c7d2fe'],
    pilotType: 1,
  },
  {
    id: 2,
    name: 'Imperial 24K',
    nameRu: 'Империал 24K',
    pilotNameRu: 'Король Пепе',
    hullGradient: ['#fef08a', '#d4af37', '#451a03', '#1c1917'],
    hullBorder: 'rgba(245, 158, 11, 0.8)',
    accentColor: '#fbbf24',
    accentGlow: '#f59e0b',
    wingFill: ['#1e293b', '#0f172a'],
    wingBorder: '#fbbf24',
    wingtipLight: '#fde68a',
    nozzleFill: '#0f172a',
    nozzleRing: '#fbbf24',
    decalColor: '#fbbf24',
    decalSubtext: 'ROYAL · VIP',
    canopyGradient: ['rgba(251, 191, 36, 0.28)', 'rgba(245, 158, 11, 0.35)', 'rgba(15, 23, 42, 0.6)'],
    canopyBorder: '#fde68a',
    canopyReflection: 'rgba(255, 250, 220, 0.95)',
    flameCore: ['#ffffff', '#fde68a', '#fbbf24', 'rgba(245, 158, 11, 0)'],
    flameAura: ['rgba(251, 191, 36, 0.85)', 'rgba(245, 158, 11, 0.45)'],
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

  // Держим свежие пропсы для цикла анимации
  const propsRef = useRef({ phase, multiplier, roundId, skinIndex, fullscreen })
  useEffect(() => {
    propsRef.current = { phase, multiplier, roundId, skinIndex, fullscreen }
  }, [phase, multiplier, roundId, skinIndex, fullscreen])

  // Внутреннее состояние анимации
  const stateRef = useRef<{
    time: number
    shake: number
    stars: Star[]
    trail: TrailParticle[]
    explosion: ExplosionParticle[]
    debris: DebrisShard[]
    shockwaveRadius: number
    shockwaveAlpha: number
    flashAlpha: number
    rocketPos: { x: number; y: number; angle: number }
  }>({
    time: 0,
    shake: 0,
    stars: [],
    trail: [],
    explosion: [],
    debris: [],
    shockwaveRadius: 0,
    shockwaveAlpha: 0,
    flashAlpha: 0,
    rocketPos: { x: 0, y: 0, angle: 0 },
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

  // Триггер взрыва и распада ракеты на кусочки при переходе в crashed
  useEffect(() => {
    if (prevPhaseRef.current !== 'crashed' && phase === 'crashed') {
      const state = stateRef.current
      const rx = state.rocketPos.x || 300
      const ry = state.rocketPos.y || 200

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
      ctx.scale(dpr, dpr)

      const state = stateRef.current
      state.time += 0.016

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
        currentPhase === 'flying' ? Math.min(6.5, 1.2 + Math.log2(currentMult) * 1.6) : 0.65

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

      // Во время отсчёта (betting) ракета не отображается (показывается только таймер)
      if (currentPhase === 'betting') {
        state.trail = []
        ctx.restore()
        return
      }

      // Позиция ракеты внутри арены полёта (плавный взлёт с космодрома и уверенный полёт)
      let currentX: number
      let currentY: number
      let currentAngle: number

      // 1. Плавный взлёт с левого нижнего угла (Старт ракеты)
      const launchProgress = Math.min(1, Math.max(0, (currentMult - 1.0) / 0.35))
      const easeLaunch = 1 - Math.pow(1 - launchProgress, 3)

      const launchX = width * 0.12
      const launchY = height * 0.88
      const launchAngle = -38

      const cruiseProgress = Math.min(1, Math.max(0, Math.log2(Math.max(1, currentMult)) / 3.0))
      const targetCruiseX = width * (0.42 + cruiseProgress * 0.20)
      const targetCruiseY = height * (0.50 - cruiseProgress * 24)
      const cruiseAngle = -16 + cruiseProgress * 6

      // Естественные микро-колебания полёта (без намёков на краш, чтобы нельзя было абузить)
      const hoverY = Math.sin(state.time * 3.6) * 3.2
      const hoverAngle = Math.sin(state.time * 2.8) * 1.6

      currentX = launchX + (targetCruiseX - launchX) * easeLaunch
      currentY = launchY + (targetCruiseY - launchY) * easeLaunch + hoverY * easeLaunch
      currentAngle = launchAngle + (cruiseAngle - launchAngle) * easeLaunch + hoverAngle * easeLaunch

      state.rocketPos = { x: currentX, y: currentY, angle: currentAngle }

      // --- 2. Неоновая дуговая траектория полёта и шлейф плазмы (В точности по референсу ZAP GIFTS) ---
      if (currentPhase === 'flying') {
        const rad = (currentAngle * Math.PI) / 180
        const nozzleDist = 52 * 1.22
        const nozzleX = currentX - Math.cos(rad) * nozzleDist
        const nozzleY = currentY - Math.sin(rad) * nozzleDist

        // Старт дуги из точки запуска в левом нижнем углу
        const startArcX = width * 0.08
        const startArcY = height * 0.88

        // Плавная выпуклая аэродинамическая контрольная точка
        const ctrlX = startArcX + (nozzleX - startArcX) * 0.58
        const ctrlY = startArcY

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
        if (Math.random() < 0.65) {
          const spread = (Math.random() - 0.5) * 8
          const perpX = -Math.sin(rad) * spread
          const perpY = Math.cos(rad) * spread
          const pSpeed = 3.2 + Math.random() * 4.5
          const pAngle = rad + Math.PI + (Math.random() - 0.5) * 0.25

          state.trail.push({
            x: nozzleX + perpX,
            y: nozzleY + perpY,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            size: 3 + Math.random() * 4.5,
            alpha: 0.85,
            color: skin.trailColors[Math.floor(Math.random() * skin.trailColors.length)] ?? skin.accentColor,
            life: 0,
            maxLife: 18 + Math.floor(Math.random() * 12),
          })
        }
      }

      // Отрисовка частиц выхлопа
      ctx.save()
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
        ctx.globalAlpha = p.alpha * 0.7
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // --- 3. Отрисовка высокодетализированной 3D Ракеты с NFT Plush Pepe (только в полёте) ---
      if (currentPhase === 'flying') {
        ctx.save()
        ctx.translate(currentX, currentY)
        ctx.rotate((currentAngle * Math.PI) / 180)

        // Зацикленное пульсирование/дыхание двигателя (Engine Breathing Cycle)
        const breathe = 1.0 + Math.sin(state.time * 6.5) * 0.035
        ctx.scale(1.22 * breathe, 1.22 * breathe)

        // 3.1. Реактивное пламя двигателя форсажа
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

        // 3.2. Сопло двигателя (Тёмный титан с полированным кольцом)
        ctx.fillStyle = skin.nozzleFill
        ctx.strokeStyle = skin.nozzleRing
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.ellipse(-50, 0, 6, 11, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // 3.3. 3D Дельта-Крылья ракеты (Aerospace Delta Wings)
        ctx.fillStyle = skin.wingFill[1]
        ctx.strokeStyle = skin.wingBorder
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(-24, 8)
        ctx.lineTo(-44, 36)
        ctx.lineTo(-16, 16)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        const wingGrad = ctx.createLinearGradient(-24, -8, -46, -38)
        wingGrad.addColorStop(0, skin.wingFill[0])
        wingGrad.addColorStop(1, skin.wingFill[1])
        ctx.fillStyle = wingGrad
        ctx.strokeStyle = skin.wingBorder
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(-24, -8)
        ctx.lineTo(-46, -38)
        ctx.lineTo(-14, -16)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = skin.wingtipLight
        ctx.shadowColor = skin.wingtipLight
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(-46, -38, 2.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(-44, 36, 2.0, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // 3.4. Основной фюзеляж ракеты (3D Volumetric Fuselage)
        const hullGrad = ctx.createLinearGradient(0, -22, 0, 22)
        hullGrad.addColorStop(0, skin.hullGradient[0])
        hullGrad.addColorStop(0.22, skin.hullGradient[1])
        hullGrad.addColorStop(0.68, skin.hullGradient[2])
        hullGrad.addColorStop(1, skin.hullGradient[3])

        ctx.fillStyle = hullGrad
        ctx.strokeStyle = skin.hullBorder
        ctx.lineWidth = 1.4

        ctx.beginPath()
        ctx.moveTo(56, 0)
        ctx.bezierCurveTo(45, -19, 10, -22, -50, -16)
        ctx.lineTo(-50, 16)
        ctx.bezierCurveTo(10, 22, 45, 19, 56, 0)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(22, -18)
        ctx.bezierCurveTo(24, -5, 24, 5, 22, 18)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(-16, -20)
        ctx.bezierCurveTo(-14, -5, -14, 5, -16, 20)
        ctx.stroke()

        ctx.strokeStyle = skin.accentColor
        ctx.lineWidth = 2.2
        ctx.shadowColor = skin.accentGlow
        ctx.shadowBlur = 7
        ctx.beginPath()
        ctx.moveTo(-34, 0)
        ctx.lineTo(28, 0)
        ctx.stroke()
        ctx.shadowBlur = 0

        // 3.5. Реалистичная надпись "SEXY" (Aerospace Stencil Decal)
        ctx.save()
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
        ctx.beginPath()
        ctx.roundRect(-30, 2.5, 34, 12.5, 2.5)
        ctx.fill()

        ctx.font = "900 10px 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.fillText('SEXY', -13, 8.8)

        ctx.fillStyle = skin.decalColor
        ctx.fillText('SEXY', -13, 7.8)

        ctx.font = "700 3.8px -apple-system, BlinkMacSystemFont, sans-serif"
        ctx.fillStyle = skin.accentColor
        ctx.fillText(skin.decalSubtext, -13, 12.6)
        ctx.restore()

        // 3.6. Пилот: Мультяшный NFT Plush Pepe в кабине
        ctx.save()
        ctx.fillStyle = '#090d16'
        ctx.beginPath()
        ctx.ellipse(12, -7, 18, 9, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#10b981'
        ctx.beginPath()
        ctx.arc(24, -3, 1.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#38bdf8'
        ctx.beginPath()
        ctx.arc(28, -3, 1.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(20, -3, 1.2, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = '#475569'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(17, -2)
        ctx.lineTo(23, -2)
        ctx.stroke()

        const pepeBob = Math.sin(state.time * 6.5) * 0.7
        const px = 12
        const py = -9 + pepeBob

        if (skin.pilotType === 0) {
          ctx.fillStyle = '#e2e8f0'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 7, 9, 5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#38bdf8'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 4.5, 6, 2, 0, 0, Math.PI * 2)
          ctx.fill()
        } else if (skin.pilotType === 1) {
          ctx.fillStyle = '#0f172a'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 7, 9, 5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#00ff88'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(px - 4, py + 7)
          ctx.lineTo(px + 8, py + 7)
          ctx.stroke()
        } else {
          ctx.fillStyle = '#581c87'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 7, 9, 5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffd700'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 4.5, 6, 1.8, 0, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.fillStyle = '#4ade80'
        ctx.beginPath()
        ctx.arc(px + 4, py + 5.5, 2.2, 0, Math.PI * 2)
        ctx.arc(px + 10, py + 5.5, 2.2, 0, Math.PI * 2)
        ctx.fill()

        const headGrad = ctx.createLinearGradient(px - 8, py - 8, px + 8, py + 6)
        if (skin.pilotType === 2) {
          headGrad.addColorStop(0, '#34d399')
          headGrad.addColorStop(1, '#059669')
        } else {
          headGrad.addColorStop(0, '#4ade80')
          headGrad.addColorStop(1, '#16a34a')
        }
        ctx.fillStyle = headGrad
        ctx.strokeStyle = '#14532d'
        ctx.lineWidth = 0.9

        ctx.beginPath()
        ctx.ellipse(px, py, 8.5, 6.8, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#86efac'
        ctx.beginPath()
        ctx.ellipse(px + 1, py + 2.6, 6.2, 2.6, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = '#14532d'
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.moveTo(px - 4, py + 2.5)
        ctx.quadraticCurveTo(px, py + 4.2, px + 5, py + 2.0)
        ctx.stroke()

        ctx.strokeStyle = 'rgba(20, 83, 45, 0.45)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.moveTo(px - 5, py - 2)
        ctx.lineTo(px - 5, py + 1)
        ctx.moveTo(px - 6, py - 0.5)
        ctx.lineTo(px - 4, py - 0.5)
        ctx.stroke()

        const drawCartoonEye = (ex: number, ey: number) => {
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = '#14532d'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.ellipse(ex, ey, 3.4, 3.8, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#0f172a'
          ctx.beginPath()
          ctx.arc(ex + 1.0, ey - 0.5, 1.8, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(ex + 0.5, ey - 1.2, 0.8, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = '#16a34a'
          ctx.beginPath()
          ctx.arc(ex, ey - 1.8, 3.2, Math.PI, Math.PI * 2)
          ctx.fill()
        }

        drawCartoonEye(px - 2.8, py - 3.8)
        drawCartoonEye(px + 3.6, py - 3.8)

        if (skin.pilotType === 0) {
          ctx.fillStyle = '#38bdf8'
          ctx.beginPath()
          ctx.arc(px - 6.5, py - 1.5, 1.8, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 0.6
          ctx.stroke()
        } else if (skin.pilotType === 1) {
          ctx.save()
          ctx.fillStyle = 'rgba(0, 255, 136, 0.82)'
          ctx.strokeStyle = '#00ff88'
          ctx.lineWidth = 1.0
          ctx.shadowColor = '#00ff88'
          ctx.shadowBlur = 6
          ctx.beginPath()
          ctx.roundRect(px - 6.2, py - 6.2, 13.5, 5.2, 2.0)
          ctx.fill()
          ctx.stroke()

          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(px - 3, py - 2.2)
          ctx.lineTo(px + 2, py - 5.6)
          ctx.stroke()

          ctx.strokeStyle = '#64748b'
          ctx.lineWidth = 1.0
          ctx.beginPath()
          ctx.moveTo(px - 6.5, py - 1.5)
          ctx.lineTo(px - 2, py + 2.5)
          ctx.stroke()
          ctx.restore()
        } else {
          ctx.save()
          const crownGrad = ctx.createLinearGradient(px - 5, py - 12, px + 5, py - 7)
          crownGrad.addColorStop(0, '#ffd700')
          crownGrad.addColorStop(1, '#b45309')
          ctx.fillStyle = crownGrad
          ctx.strokeStyle = '#78350f'
          ctx.lineWidth = 0.8

          ctx.beginPath()
          ctx.moveTo(px - 4.5, py - 7.5)
          ctx.lineTo(px - 5.5, py - 12.5)
          ctx.lineTo(px - 1.5, py - 9.5)
          ctx.lineTo(px + 0.5, py - 14.0)
          ctx.lineTo(px + 2.5, py - 9.5)
          ctx.lineTo(px + 6.0, py - 12.5)
          ctx.lineTo(px + 5.0, py - 7.5)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#ef4444'
          ctx.beginPath()
          ctx.arc(px + 0.5, py - 9.8, 1.4, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(px + 0.2, py - 10.2, 0.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        ctx.restore()

        // 3.7. Стекло фонаря кабины
        const canopyGrad = ctx.createLinearGradient(6, -18, 22, 2)
        canopyGrad.addColorStop(0, skin.canopyGradient[0])
        canopyGrad.addColorStop(0.5, skin.canopyGradient[1])
        canopyGrad.addColorStop(1, skin.canopyGradient[2])

        ctx.fillStyle = canopyGrad
        ctx.strokeStyle = skin.canopyBorder
        ctx.lineWidth = 1.3

        ctx.beginPath()
        ctx.moveTo(34, -2)
        ctx.bezierCurveTo(28, -20, 2, -20, -5, -4)
        ctx.bezierCurveTo(6, 0, 25, 0, 34, -2)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        ctx.strokeStyle = skin.canopyReflection
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.ellipse(15, -14, 11, 2.5, -0.15, Math.PI * 0.9, Math.PI * 1.9)
        ctx.stroke()

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.ellipse(23, -8, 5, 1.8, -0.28, Math.PI * 0.8, Math.PI * 1.8)
        ctx.stroke()

        ctx.fillStyle = skin.accentColor
        ctx.beginPath()
        ctx.arc(-3, -3.5, 0.9, 0, Math.PI * 2)
        ctx.arc(14, -0.5, 0.9, 0, Math.PI * 2)
        ctx.arc(32, -1.8, 0.9, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }

      // --- 4. Анимация Взрыва и Разлетающихся Обломков Ракеты (Crash Debris & Shatter) ---
      if (currentPhase === 'crashed') {
        const rx = state.rocketPos.x || width / 2
        const ry = state.rocketPos.y || (currentProps.fullscreen ? Math.min(height * 0.35, 240) : height / 2)

        // Вспышка взрыва
        if (state.flashAlpha > 0.01) {
          ctx.fillStyle = `rgba(255, 255, 255, ${state.flashAlpha * 0.45})`
          ctx.fillRect(-20, -20, width + 40, height + 40)
          state.flashAlpha *= 0.88
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
            // Обломок обшивки фюзеляжа
            ctx.fillStyle = skin.hullGradient[2]
            ctx.strokeStyle = skin.accentColor
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.rect(-9, -6, 18, 12)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = skin.decalColor
            ctx.font = '700 5px sans-serif'
            ctx.fillText('SE', -4, 2)
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

      animId = requestAnimationFrame(render)
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
