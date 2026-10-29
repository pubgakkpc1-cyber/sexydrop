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

interface Rocket3DCanvasProps {
  phase: CrashPhase
  multiplier: number
  className?: string
}

export function Rocket3DCanvas({ phase, multiplier, className }: Rocket3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const prevPhaseRef = useRef<CrashPhase>(phase)

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

  // Инициализация фоновых звёзд
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

      // Создаём 50 частиц взрыва
      const exp: ExplosionParticle[] = []
      const colors = ['#ffffff', '#38bdf8', '#818cf8', '#f59e0b', '#ef4444', '#fb923c']
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
          color: colors[Math.floor(Math.random() * colors.length)] ?? '#f59e0b',
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

      // --- 1. Пролетающие фоновые звёзды (Starfield) ---
      // В полёте скорость звёзд зависит от множителя (эффект гиперпространства)
      const flightSpeedFactor = phase === 'flying' ? Math.min(6, 1.2 + Math.log2(multiplier) * 1.5) : 0.6

      ctx.save()
      for (const star of state.stars) {
        star.x -= star.speed * flightSpeedFactor
        if (star.x < 0) {
          star.x = width + Math.random() * 50
          star.y = Math.random() * height
        }

        // Если ракета летит быстро, рисуем звёзды в виде шлейфов (speed streaks)
        if (phase === 'flying' && star.layer >= 2) {
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

      // Позиция ракеты
      const progress = Math.min(1, Math.max(0, Math.log2(multiplier) / 2.8))
      const targetX = width * (0.32 + progress * 0.22)
      const targetY = height * (0.58 - progress * 0.08)

      // Плавное парение (aerodynamic hover wave)
      const hoverY = Math.sin(state.time * 4) * 4
      const hoverAngle = Math.sin(state.time * 3) * 2.5 // наклон +-2.5 deg

      const currentX = targetX
      const currentY = targetY + hoverY
      const currentAngle = -14 + Math.min(8, progress * 5) + hoverAngle

      state.rocketPos = { x: currentX, y: currentY, angle: currentAngle }

      // --- 2. Шлейф плазмы и выхлопа (Trail Particles) ---
      if (phase === 'flying') {
        // Координаты сопла (задняя часть ракеты)
        const rad = (currentAngle * Math.PI) / 180
        const nozzleDist = 48
        const nozzleX = currentX - Math.cos(rad) * nozzleDist
        const nozzleY = currentY - Math.sin(rad) * nozzleDist

        // Генерируем 2-4 частицы выхлопа за кадр
        for (let i = 0; i < 3; i++) {
          const spread = (Math.random() - 0.5) * 8
          const perpX = -Math.sin(rad) * spread
          const perpY = Math.cos(rad) * spread
          const pSpeed = 4 + Math.random() * 5
          const pAngle = rad + Math.PI + (Math.random() - 0.5) * 0.35

          state.trail.push({
            x: nozzleX + perpX,
            y: nozzleY + perpY,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            size: 4 + Math.random() * 5,
            alpha: 0.9,
            color: Math.random() < 0.4 ? '#38bdf8' : Math.random() < 0.75 ? '#818cf8' : '#fbbf24',
            life: 0,
            maxLife: 28 + Math.floor(Math.random() * 18),
          })
        }
      }

      // Отрисовка и обновление шлейфа
      ctx.save()
      for (let i = state.trail.length - 1; i >= 0; i--) {
        const p = state.trail[i]!
        p.life++
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.94
        p.vy *= 0.94
        p.alpha = Math.max(0, 1 - p.life / p.maxLife)
        p.size *= 1.025 // частицы расширяются по мере удаления

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

      // --- 3. Отрисовка 3D Ракеты (только в полёте) ---
      if (phase === 'flying') {
        ctx.save()
        ctx.translate(currentX, currentY)
        ctx.rotate((currentAngle * Math.PI) / 180)

        // Зацикленное пульсирование/дыхание двигателя (Engine Breathing / Chamber Flare)
        const breathe = 1.0 + Math.sin(state.time * 7) * 0.035
        ctx.scale(breathe, breathe)

        // А. Пламя двигателя (Реактивная струя сопла)
        const flameFlicker = 0.85 + Math.random() * 0.3
        const flameLen = (52 + Math.min(30, multiplier * 3)) * flameFlicker
        const flameWidth = 14 * breathe

        // Внешнее свечение пламени (Outer violet/cyan aura)
        const flameAuraGrad = ctx.createRadialGradient(-38, 0, 4, -38 - flameLen * 0.6, 0, flameLen)
        flameAuraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.75)')
        flameAuraGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.45)')
        flameAuraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = flameAuraGrad
        ctx.beginPath()
        ctx.ellipse(-38 - flameLen * 0.4, 0, flameLen * 0.7, flameWidth * 1.8, 0, 0, Math.PI * 2)
        ctx.fill()

        // Основное реактивное ядро (Inner bright plasma tongue)
        ctx.beginPath()
        ctx.moveTo(-38, -flameWidth / 2)
        ctx.quadraticCurveTo(-38 - flameLen * 0.5, -flameWidth * 0.6, -38 - flameLen, 0)
        ctx.quadraticCurveTo(-38 - flameLen * 0.5, flameWidth * 0.6, -38, flameWidth / 2)
        ctx.closePath()

        const coreFlameGrad = ctx.createLinearGradient(-38, 0, -38 - flameLen, 0)
        coreFlameGrad.addColorStop(0, '#ffffff')
        coreFlameGrad.addColorStop(0.2, '#38bdf8')
        coreFlameGrad.addColorStop(0.7, '#818cf8')
        coreFlameGrad.addColorStop(1, 'rgba(236, 72, 153, 0)')
        ctx.fillStyle = coreFlameGrad
        ctx.fill()

        // Б. Сопло двигателя (Тёмный титан с полированным кольцом)
        ctx.fillStyle = '#1e1b2e'
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.ellipse(-38, 0, 5, 9, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // В. Крылья ракеты (3D Delta Wings с неоновыми гранями)
        // Нижнее/дальнее крыло (с тенью)
        ctx.fillStyle = '#0f172a'
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(-18, 6)
        ctx.lineTo(-32, 28)
        ctx.lineTo(-12, 12)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Верхнее крыло (с отражением света)
        const wingGrad = ctx.createLinearGradient(-18, -6, -32, -30)
        wingGrad.addColorStop(0, '#334155')
        wingGrad.addColorStop(1, '#0f172a')
        ctx.fillStyle = wingGrad
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(-18, -6)
        ctx.lineTo(-34, -28)
        ctx.lineTo(-10, -12)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Неоновый габаритный маркер на конце крыла
        ctx.fillStyle = '#38bdf8'
        ctx.shadowColor = '#38bdf8'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(-34, -28, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Г. Основной фюзеляж ракеты (3D Volumetric Fuselage)
        // Объёмный градиент корпуса: верх светлый хром, низ тёмная тень
        const hullGrad = ctx.createLinearGradient(0, -16, 0, 16)
        hullGrad.addColorStop(0, '#f8fafc')
        hullGrad.addColorStop(0.2, '#94a3b8')
        hullGrad.addColorStop(0.65, '#1e293b')
        hullGrad.addColorStop(1, '#090d16')

        ctx.fillStyle = hullGrad
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
        ctx.lineWidth = 1.2

        ctx.beginPath()
        ctx.moveTo(42, 0) // нос
        ctx.bezierCurveTo(34, -14, 5, -16, -38, -12) // верхняя дуга
        ctx.lineTo(-38, 12) // корма
        ctx.bezierCurveTo(5, 16, 34, 14, 42, 0) // нижняя дуга
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Декоративная неоновая кибер-полоса вдоль борта
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2
        ctx.shadowColor = '#38bdf8'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.moveTo(-24, 0)
        ctx.lineTo(22, 0)
        ctx.stroke()
        ctx.shadowBlur = 0

        // Д. Стекло фонаря кабины (Cockpit Canopy с бирюзовым стеклом и отражением)
        const canopyGrad = ctx.createLinearGradient(4, -10, 18, 4)
        canopyGrad.addColorStop(0, '#38bdf8')
        canopyGrad.addColorStop(0.4, '#0284c7')
        canopyGrad.addColorStop(1, '#082f49')

        ctx.fillStyle = canopyGrad
        ctx.strokeStyle = '#e0f2fe'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(26, -2)
        ctx.bezierCurveTo(22, -10, 4, -10, 0, -3)
        ctx.bezierCurveTo(8, 2, 20, 2, 26, -2)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Световой блик на стекле (Specular Glare)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.beginPath()
        ctx.ellipse(14, -6, 5, 1.5, -0.2, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }

      // --- 4. Анимация Взрыва при Crash (Shockwave & Debris) ---
      if (phase === 'crashed') {
        const rx = state.rocketPos.x || width / 2
        const ry = state.rocketPos.y || height / 2

        // Вспышка взрыва
        if (state.flashAlpha > 0.01) {
          ctx.fillStyle = `rgba(255, 255, 255, ${state.flashAlpha * 0.4})`
          ctx.fillRect(-20, -20, width + 40, height + 40)
          state.flashAlpha *= 0.88
        }

        // Расширяющаяся ударная волна (Shockwave Ring)
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

        // Отрисовка частиц взрыва
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
  }, [phase, multiplier])

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
