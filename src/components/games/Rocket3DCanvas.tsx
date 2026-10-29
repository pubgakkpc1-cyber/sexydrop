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
    hullBorder: 'rgba(56, 189, 248, 0.45)',
    accentColor: '#38bdf8',
    accentGlow: '#00f0ff',
    wingFill: ['#1e293b', '#0f172a'],
    wingBorder: '#38bdf8',
    wingtipLight: '#38bdf8',
    nozzleFill: '#111827',
    nozzleRing: '#38bdf8',
    decalColor: '#e2e8f0',
    decalSubtext: 'MK-III TON',
    canopyGradient: ['rgba(56, 189, 248, 0.35)', 'rgba(2, 132, 199, 0.55)', 'rgba(8, 47, 73, 0.75)'],
    canopyBorder: '#bae6fd',
    canopyReflection: 'rgba(255, 255, 255, 0.85)',
    flameCore: ['#ffffff', '#38bdf8', '#818cf8', 'rgba(168, 85, 247, 0)'],
    flameAura: ['rgba(56, 189, 248, 0.75)', 'rgba(129, 140, 248, 0.35)'],
    trailColors: ['#38bdf8', '#818cf8', '#ffffff', '#67e8f9'],
    pilotType: 0,
  },
  {
    id: 1,
    name: 'Emerald Viper',
    nameRu: 'Изумрудный Вайпер',
    pilotNameRu: 'Кибер Пепе',
    hullGradient: ['#1c3829', '#0d2217', '#08140e', '#020504'],
    hullBorder: 'rgba(0, 255, 136, 0.5)',
    accentColor: '#00ff88',
    accentGlow: '#00ff88',
    wingFill: ['#091a11', '#030805'],
    wingBorder: '#00ff88',
    wingtipLight: '#00ff88',
    nozzleFill: '#06130c',
    nozzleRing: '#00ff88',
    decalColor: '#00ff88',
    decalSubtext: 'VIP DROP',
    canopyGradient: ['rgba(0, 255, 136, 0.35)', 'rgba(5, 46, 22, 0.65)', 'rgba(2, 20, 10, 0.85)'],
    canopyBorder: '#86efac',
    canopyReflection: 'rgba(230, 255, 240, 0.9)',
    flameCore: ['#ffffff', '#86efac', '#00ff88', 'rgba(16, 185, 129, 0)'],
    flameAura: ['rgba(0, 255, 136, 0.85)', 'rgba(16, 185, 129, 0.4)'],
    trailColors: ['#00ff88', '#34d399', '#ffffff', '#a7f3d0'],
    pilotType: 1,
  },
  {
    id: 2,
    name: 'Supernova Gold',
    nameRu: 'Супернова 24K',
    pilotNameRu: 'Король Пепе',
    hullGradient: ['#fef08a', '#d4af37', '#451a03', '#1c1917'],
    hullBorder: 'rgba(250, 204, 21, 0.6)',
    accentColor: '#fbbf24',
    accentGlow: '#ffd700',
    wingFill: ['#292524', '#0c0a09'],
    wingBorder: '#ffd700',
    wingtipLight: '#ffd700',
    nozzleFill: '#1c1917',
    nozzleRing: '#ffd700',
    decalColor: '#ffd700',
    decalSubtext: 'ROYAL 999',
    canopyGradient: ['rgba(251, 191, 36, 0.38)', 'rgba(180, 83, 9, 0.65)', 'rgba(69, 26, 3, 0.85)'],
    canopyBorder: '#fef08a',
    canopyReflection: 'rgba(255, 250, 220, 0.92)',
    flameCore: ['#ffffff', '#fde047', '#f59e0b', 'rgba(239, 68, 68, 0)'],
    flameAura: ['rgba(251, 191, 36, 0.85)', 'rgba(239, 68, 68, 0.4)'],
    trailColors: ['#ffd700', '#fbbf24', '#ffffff', '#f59e0b'],
    pilotType: 2,
  },
]

interface Rocket3DCanvasProps {
  phase: CrashPhase
  multiplier: number
  roundId?: number
  skinIndex?: number
  className?: string
}

export function Rocket3DCanvas({
  phase,
  multiplier,
  roundId,
  skinIndex,
  className,
}: Rocket3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const prevPhaseRef = useRef<CrashPhase>(phase)

  // Держим свежие пропсы для цикла анимации
  const propsRef = useRef({ phase, multiplier, roundId, skinIndex })
  useEffect(() => {
    propsRef.current = { phase, multiplier, roundId, skinIndex }
  }, [phase, multiplier, roundId, skinIndex])

  // Внутреннее состояние анимации
  const stateRef = useRef<{
    time: number
    shake: number
    stars: Star[]
    trail: TrailParticle[]
    explosion: ExplosionParticle[]
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
    shockwaveRadius: 0,
    shockwaveAlpha: 0,
    flashAlpha: 0,
    rocketPos: { x: 0, y: 0, angle: 0 },
  })

  // Инициализация фоновых звёзд (Starfield)
  useEffect(() => {
    const stars: Star[] = []
    const count = 75
    for (let i = 0; i < count; i++) {
      const layer = Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 3
      stars.push({
        x: Math.random() * 1000,
        y: Math.random() * 600,
        size: layer === 1 ? 1 + Math.random() : layer === 2 ? 1.8 + Math.random() : 2.8 + Math.random() * 1.5,
        speed: layer === 1 ? 0.4 + Math.random() * 0.3 : layer === 2 ? 1.2 + Math.random() * 0.6 : 2.5 + Math.random() * 1.2,
        opacity: layer === 1 ? 0.35 + Math.random() * 0.3 : layer === 2 ? 0.6 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15,
        layer,
      })
    }
    stateRef.current.stars = stars
  }, [])

  // Триггер взрыва при переходе в crashed
  useEffect(() => {
    if (prevPhaseRef.current !== 'crashed' && phase === 'crashed') {
      const state = stateRef.current
      const rx = state.rocketPos.x || 300
      const ry = state.rocketPos.y || 200

      state.shake = 18 // амплитуда тряски
      state.flashAlpha = 0.85 // вспышка
      state.shockwaveRadius = 15
      state.shockwaveAlpha = 1.0

      // Создаём 55 частиц взрыва
      const exp: ExplosionParticle[] = []
      const colors = ['#ffffff', '#38bdf8', '#00ff88', '#fbbf24', '#ef4444', '#fb923c']
      for (let i = 0; i < 55; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 9
        const maxLife = 40 + Math.floor(Math.random() * 35)
        exp.push({
          x: rx,
          y: ry,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 6,
          alpha: 1,
          color: colors[Math.floor(Math.random() * colors.length)] ?? '#fbbf24',
          life: 0,
          maxLife,
          spin: (Math.random() - 0.5) * 0.3,
          angle: Math.random() * Math.PI * 2,
        })
      }
      state.explosion = exp
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

      const width = canvas.clientWidth || 360
      const height = canvas.clientHeight || 280
      const dpr = Math.min(2, window.devicePixelRatio || 1)

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

      // --- 1. Пролетающие фоновые звёзды (Starfield с эффектом скорости) ---
      const flightSpeedFactor =
        currentPhase === 'flying' ? Math.min(6, 1.2 + Math.log2(currentMult) * 1.5) : 0.6

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

      // Позиция ракеты на арене
      const progress = Math.min(1, Math.max(0, Math.log2(currentMult) / 2.8))
      const targetX = width * (0.32 + progress * 0.22)
      const targetY = height * (0.58 - progress * 0.08)

      // Плавное парение (аэродинамическое покачивание)
      const hoverY = Math.sin(state.time * 4) * 4
      const hoverAngle = Math.sin(state.time * 3) * 2.5

      const currentX = targetX
      const currentY = targetY + hoverY
      const currentAngle = -14 + Math.min(8, progress * 5) + hoverAngle

      state.rocketPos = { x: currentX, y: currentY, angle: currentAngle }

      // --- 2. Шлейф плазмы и выхлопа (Trail Particles) в полёте ---
      if (currentPhase === 'flying') {
        const rad = (currentAngle * Math.PI) / 180
        const nozzleDist = 52
        const nozzleX = currentX - Math.cos(rad) * nozzleDist
        const nozzleY = currentY - Math.sin(rad) * nozzleDist

        for (let i = 0; i < 3; i++) {
          const spread = (Math.random() - 0.5) * 9
          const perpX = -Math.sin(rad) * spread
          const perpY = Math.cos(rad) * spread
          const pSpeed = 4.5 + Math.random() * 5.5
          const pAngle = rad + Math.PI + (Math.random() - 0.5) * 0.35

          state.trail.push({
            x: nozzleX + perpX,
            y: nozzleY + perpY,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            size: 4 + Math.random() * 5,
            alpha: 0.9,
            color: skin.trailColors[Math.floor(Math.random() * skin.trailColors.length)] ?? '#38bdf8',
            life: 0,
            maxLife: 28 + Math.floor(Math.random() * 18),
          })
        }
      }

      // Отрисовка частиц шлейфа
      ctx.save()
      for (let i = state.trail.length - 1; i >= 0; i--) {
        const p = state.trail[i]!
        p.life++
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.94
        p.vy *= 0.94
        p.alpha = Math.max(0, 1 - p.life / p.maxLife)
        p.size *= 1.025

        if (p.life >= p.maxLife || p.alpha <= 0.02) {
          state.trail.splice(i, 1)
          continue
        }

        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha * 0.75
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // --- 3. Отрисовка высокодетализированной 3D Ракеты с NFT Plush Pepe ---
      if (currentPhase === 'flying') {
        ctx.save()
        ctx.translate(currentX, currentY)
        ctx.rotate((currentAngle * Math.PI) / 180)

        // Зацикленное пульсирование/дыхание двигателя (Engine Breathing Cycle)
        const breathe = 1.0 + Math.sin(state.time * 6.5) * 0.038
        ctx.scale(breathe, breathe)

        // 3.1. Реактивное пламя двигателя (Twin-Core Plasma Jet)
        const flameFlicker = 0.88 + Math.random() * 0.25
        const flameLen = (68 + Math.min(42, currentMult * 4)) * flameFlicker
        const flameWidth = 17 * breathe

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
        // Нижнее (дальнее) крыло
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

        // Верхнее (ближнее) крыло с градиентом и отсветом
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

        // Габаритный неоновый маркер на конце крыла
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
        ctx.moveTo(56, 0) // Нос
        ctx.bezierCurveTo(45, -19, 10, -22, -50, -16) // Верхняя дуга
        ctx.lineTo(-50, 16) // Корма
        ctx.bezierCurveTo(10, 22, 45, 19, 56, 0) // Нижняя дуга
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Аэродинамические швы и обшивка фюзеляжа
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

        // Неоновая кибер-полоса вдоль борта
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
        // Небольшая, стильная, аэрокосмическая маркировка на борту
        ctx.save()
        // Металлическая подложка для читаемости
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
        ctx.beginPath()
        ctx.roundRect(-30, 2.5, 34, 12.5, 2.5)
        ctx.fill()

        // Тень от букв (вдавленный эффект тиснения)
        ctx.font = "900 10px 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.fillText('SEXY', -13, 8.8)

        // Основной текст SEXY в цвете обшивки скина
        ctx.fillStyle = skin.decalColor
        ctx.fillText('SEXY', -13, 7.8)

        // Микро-маркировка под надписью (реализм аэрокосмического корабля)
        ctx.font = "700 3.8px -apple-system, BlinkMacSystemFont, sans-serif"
        ctx.fillStyle = skin.accentColor
        ctx.fillText(skin.decalSubtext, -13, 12.6)
        ctx.restore()

        // 3.6. Пилот: Картунный NFT Plush Pepe внутри кабины
        // Приборная панель и руль
        ctx.save()
        // Внутренний интерьер кабины
        ctx.fillStyle = '#090d16'
        ctx.beginPath()
        ctx.ellipse(12, -7, 18, 9, 0, 0, Math.PI * 2)
        ctx.fill()

        // Миниатюрные светящиеся датчики телеметрии кабины
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

        // Штурвал управления полетом
        ctx.strokeStyle = '#475569'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(17, -2)
        ctx.lineTo(23, -2)
        ctx.stroke()

        // Картунный NFT Плюш Пепе (строго мультяшный NFT стиль)
        const pepeBob = Math.sin(state.time * 6.5) * 0.7
        const px = 12
        const py = -9 + pepeBob

        // Туловище / костюм пилота
        if (skin.pilotType === 0) {
          // Космонавт Пепе: белый скафандр с бирюзовым воротником
          ctx.fillStyle = '#e2e8f0'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 7, 9, 5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#38bdf8'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 4.5, 6, 2, 0, 0, Math.PI * 2)
          ctx.fill()
        } else if (skin.pilotType === 1) {
          // Киберпанк Пепе: темный кибер-комбинезон с неоновыми швами
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
          // Королевский Пепе: фиолетовая королевская мантия с золотом
          ctx.fillStyle = '#581c87'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 7, 9, 5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#ffd700'
          ctx.beginPath()
          ctx.ellipse(px + 2, py + 4.5, 6, 1.8, 0, 0, Math.PI * 2)
          ctx.fill()
        }

        // Лапки Пепе держат штурвал
        ctx.fillStyle = '#4ade80'
        ctx.beginPath()
        ctx.arc(px + 4, py + 5.5, 2.2, 0, Math.PI * 2)
        ctx.arc(px + 10, py + 5.5, 2.2, 0, Math.PI * 2)
        ctx.fill()

        // Голова Плюш Пепе (картунная форма лягушонка)
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

        // Нижняя губа/щеки Пепе (характерная светлая область)
        ctx.fillStyle = '#86efac'
        ctx.beginPath()
        ctx.ellipse(px + 1, py + 2.6, 6.2, 2.6, 0, 0, Math.PI * 2)
        ctx.fill()

        // Фирменная улыбка Пепе
        ctx.strokeStyle = '#14532d'
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.moveTo(px - 4, py + 2.5)
        ctx.quadraticCurveTo(px, py + 4.2, px + 5, py + 2.0)
        ctx.stroke()

        // Плюшевый декоративный шов (NFT Plush seam)
        ctx.strokeStyle = 'rgba(20, 83, 45, 0.45)'
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.moveTo(px - 5, py - 2)
        ctx.lineTo(px - 5, py + 1)
        ctx.moveTo(px - 6, py - 0.5)
        ctx.lineTo(px - 4, py - 0.5)
        ctx.stroke()

        // Большие картунные глаза Пепе
        const drawCartoonEye = (ex: number, ey: number) => {
          // Белок глаза
          ctx.fillStyle = '#ffffff'
          ctx.strokeStyle = '#14532d'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.ellipse(ex, ey, 3.4, 3.8, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()

          // Зрачок (смотрит вперед-вверх на полет)
          ctx.fillStyle = '#0f172a'
          ctx.beginPath()
          ctx.arc(ex + 1.0, ey - 0.5, 1.8, 0, Math.PI * 2)
          ctx.fill()

          // Блик в глазу (мультяшная искра)
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(ex + 0.5, ey - 1.2, 0.8, 0, Math.PI * 2)
          ctx.fill()

          // Верхнее зеленое веко
          ctx.fillStyle = '#16a34a'
          ctx.beginPath()
          ctx.arc(ex, ey - 1.8, 3.2, Math.PI, Math.PI * 2)
          ctx.fill()
        }

        drawCartoonEye(px - 2.8, py - 3.8)
        drawCartoonEye(px + 3.6, py - 3.8)

        // 3 ОСОБЫХ АТРИБУТА ПИЛОТОВ:
        if (skin.pilotType === 0) {
          // Пилот 0: Классический кадет — авиагарнитура с синим огоньком
          ctx.fillStyle = '#38bdf8'
          ctx.beginPath()
          ctx.arc(px - 6.5, py - 1.5, 1.8, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 0.6
          ctx.stroke()
        } else if (skin.pilotType === 1) {
          // Пилот 1: Киберпанк Пепе — светящийся неоновый визор на глазах
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

          // Диагональный блик на кибер-визоре
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.moveTo(px - 3, py - 2.2)
          ctx.lineTo(px + 2, py - 5.6)
          ctx.stroke()

          // Микрофон пилота
          ctx.strokeStyle = '#64748b'
          ctx.lineWidth = 1.0
          ctx.beginPath()
          ctx.moveTo(px - 6.5, py - 1.5)
          ctx.lineTo(px - 2, py + 2.5)
          ctx.stroke()
          ctx.restore()
        } else {
          // Пилот 2: Король Пепе — миниатюрная 24K золотая корона с рубином
          ctx.save()
          const crownGrad = ctx.createLinearGradient(px - 5, py - 12, px + 5, py - 7)
          crownGrad.addColorStop(0, '#ffd700')
          crownGrad.addColorStop(1, '#b45309')
          ctx.fillStyle = crownGrad
          ctx.strokeStyle = '#78350f'
          ctx.lineWidth = 0.8

          // 3 зубца золотой короны
          ctx.beginPath()
          ctx.moveTo(px - 4.5, py - 7.5)
          ctx.lineTo(px - 5.5, py - 12.5) // Левый зубец
          ctx.lineTo(px - 1.5, py - 9.5)
          ctx.lineTo(px + 0.5, py - 14.0) // Центральный высокий зубец
          ctx.lineTo(px + 2.5, py - 9.5)
          ctx.lineTo(px + 6.0, py - 12.5) // Правый зубец
          ctx.lineTo(px + 5.0, py - 7.5)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()

          // Рубиновый камень в центре короны
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

        // 3.7. Стекло фонаря кабины (Cockpit Glass Canopy с реалистичными бликами поверх Пепе)
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

        // Световые изогнутые блики на стекле (Apple Liquid Glass Specular Glare)
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

        // Заклепки на титановом ободе фонаря
        ctx.fillStyle = skin.accentColor
        ctx.beginPath()
        ctx.arc(-3, -3.5, 0.9, 0, Math.PI * 2)
        ctx.arc(14, -0.5, 0.9, 0, Math.PI * 2)
        ctx.arc(32, -1.8, 0.9, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }

      // --- 4. Анимация Взрыва при Crash (Shockwave & Debris) ---
      if (currentPhase === 'crashed') {
        const rx = state.rocketPos.x || width / 2
        const ry = state.rocketPos.y || height / 2

        if (state.flashAlpha > 0.01) {
          ctx.fillStyle = `rgba(255, 255, 255, ${state.flashAlpha * 0.4})`
          ctx.fillRect(-20, -20, width + 40, height + 40)
          state.flashAlpha *= 0.88
        }

        if (state.shockwaveAlpha > 0.02) {
          ctx.save()
          ctx.strokeStyle = `rgba(239, 68, 68, ${state.shockwaveAlpha})`
          ctx.lineWidth = 3
          ctx.shadowColor = '#ef4444'
          ctx.shadowBlur = 12
          ctx.beginPath()
          ctx.arc(rx, ry, state.shockwaveRadius, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()

          state.shockwaveRadius += 4.5
          state.shockwaveAlpha *= 0.92
        }

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
        zIndex: 2,
      }}
      aria-hidden
    />
  )
}
