import { GRAPHICS_PRESETS, useGraphicsStore } from '../../store/graphics'
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

/* --- Мультяшная ракета SEXY DROP: пухлый корпус, плавники и Plush Pepe сверху --- */
const OUTLINE = '#2c2b2b'

function drawFlameLayer(ctx: CanvasRenderingContext2D, len: number, w: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(-46, -w)
  ctx.quadraticCurveTo(-46 - len * 0.55, -w * 1.15, -46 - len, 0)
  ctx.quadraticCurveTo(-46 - len * 0.55, w * 1.15, -46, w)
  ctx.closePath()
  ctx.fill()
}

function drawShipClassic(
  ctx: CanvasRenderingContext2D,
  skin: RocketSkinConfig,
  t: number,
  mult: number,
  withFlame: boolean,
) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Пламя: три вложенных «капли», пляшут по синусу (без частиц)
  if (withFlame) {
    const wob = 1 + Math.sin(t * 24) * 0.07 + Math.sin(t * 13) * 0.05
    const len = (46 + Math.min(30, mult * 3)) * wob
    drawFlameLayer(ctx, len, 13, skin.flameCore[2])
    drawFlameLayer(ctx, len * 0.7, 9, skin.flameCore[1])
    drawFlameLayer(ctx, len * 0.42, 5, '#ffffff')
  }

  // Плавники (за корпусом)
  ctx.fillStyle = skin.wingBorder
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.6
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(-26, dir * 16)
    ctx.lineTo(-50, dir * 36)
    ctx.quadraticCurveTo(-52, dir * 40, -44, dir * 38)
    ctx.lineTo(-12, dir * 18)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // Сопло
  ctx.fillStyle = '#632528'
  ctx.beginPath()
  safeRoundRect(ctx, -52, -9, 11, 18, 4)
  ctx.fill()
  ctx.stroke()

  // Корпус: пухлая «пуля»
  const body = () => {
    ctx.beginPath()
    ctx.moveTo(-42, -18)
    ctx.lineTo(22, -21)
    ctx.quadraticCurveTo(54, -18, 56, 0)
    ctx.quadraticCurveTo(54, 18, 22, 21)
    ctx.lineTo(-42, 18)
    ctx.quadraticCurveTo(-52, 0, -42, -18)
    ctx.closePath()
  }
  const hull = ctx.createLinearGradient(0, -21, 0, 21)
  hull.addColorStop(0, skin.hullGradient[0])
  hull.addColorStop(0.45, skin.hullGradient[1])
  hull.addColorStop(1, skin.hullGradient[2])
  ctx.fillStyle = hull
  body()
  ctx.fill()

  ctx.save()
  body()
  ctx.clip()
  // Нос цвета акцента
  ctx.fillStyle = skin.accentColor
  ctx.fillRect(32, -26, 30, 52)
  // Полоса с названием
  ctx.fillStyle = skin.accentColor
  ctx.fillRect(-52, 2, 86, 14)
  // Глянцевый блик
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.beginPath()
  ctx.ellipse(-8, -13, 28, 4.5, -0.04, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
  ctx.fillRect(-52, 14, 110, 8)
  ctx.restore()

  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 3.2
  body()
  ctx.stroke()

  // Иллюминатор
  ctx.fillStyle = '#292727'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(22, -3, 7.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(22, -3, 4.2, Math.PI * 1.05, Math.PI * 1.55)
  ctx.stroke()

  // Надпись SEXY DROP на полосе + капля
  ctx.save()
  ctx.font = '700 7px Unbounded, "Golos Text", Roboto, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  try {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0.9px'
  } catch {
    /* старые WebView */
  }
  ctx.lineWidth = 2.4
  ctx.strokeStyle = OUTLINE
  ctx.strokeText('SEXY DROP', -6, 9.5)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('SEXY DROP', -6, 9.5)
  ctx.beginPath()
  ctx.moveTo(-40, 5.2)
  ctx.bezierCurveTo(-37.4, 8, -37.4, 12, -40, 12)
  ctx.bezierCurveTo(-42.6, 12, -42.6, 8, -40, 5.2)
  ctx.fill()
  ctx.restore()

  // Заклёпки
  ctx.fillStyle = 'rgba(44, 43, 43, 0.55)'
  for (const x of [-34, 8]) {
    ctx.beginPath()
    ctx.arc(x, -9, 1.3, 0, Math.PI * 2)
    ctx.fill()
  }

  drawPepe(ctx, skin, t, 4, -33, -19.5, skin.pilotType)
}

/** Пилот-Пепе: сидит на корабле. pilot: 0 антенна, 1 очки, 2 корона, 3 без аксессуара. */
function drawPepe(
  ctx: CanvasRenderingContext2D,
  skin: RocketSkinConfig,
  t: number,
  px: number,
  py0: number,
  handY: number,
  pilot: number,
) {
  const bob = Math.sin(t * 5.5) * 0.9
  const py = py0 + bob
  const GREEN_OUT = '#235421'

  // Шарф развевается
  const flap = Math.sin(t * 9) * 3
  ctx.fillStyle = skin.accentColor
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(px - 4, py + 10)
  ctx.quadraticCurveTo(px - 18, py + 8 + flap, px - 30, py + 13 + flap * 1.4)
  ctx.lineTo(px - 28, py + 19 + flap * 1.2)
  ctx.quadraticCurveTo(px - 16, py + 15 + flap, px - 2, py + 16)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Руки держатся за корпус
  ctx.fillStyle = '#66b756'
  ctx.strokeStyle = GREEN_OUT
  ctx.lineWidth = 1.8
  for (const hx of [px - 11, px + 12]) {
    ctx.beginPath()
    ctx.arc(hx, handY, 4.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  // Туловище
  ctx.fillStyle = '#58ab4b'
  ctx.beginPath()
  ctx.ellipse(px, py + 12, 11, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Голова
  const headGrad = ctx.createLinearGradient(px, py - 14, px, py + 12)
  headGrad.addColorStop(0, '#93ce82')
  headGrad.addColorStop(1, '#499e42')
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.ellipse(px, py, 16, 12.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Щёчки
  ctx.fillStyle = 'rgba(223, 152, 152, 0.45)'
  ctx.beginPath()
  ctx.ellipse(px - 10, py + 5, 3.4, 2.2, 0, 0, Math.PI * 2)
  ctx.ellipse(px + 11, py + 5, 3.4, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Большая улыбка с губой
  ctx.strokeStyle = GREEN_OUT
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(px - 9, py + 4.5)
  ctx.quadraticCurveTo(px + 1, py + 11, px + 12, py + 3.5)
  ctx.stroke()
  ctx.fillStyle = '#d06f6a'
  ctx.beginPath()
  ctx.ellipse(px + 1.5, py + 8.2, 6.5, 2.1, 0.05, 0, Math.PI * 2)
  ctx.fill()

  // Выпуклые глаза, смотрят вперёд
  for (const ex of [px - 6.5, px + 7.5]) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = GREEN_OUT
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(ex, py - 7, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#1d1b1b'
    ctx.beginPath()
    ctx.arc(ex + 1.8, py - 6.6, 2.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ex + 2.6, py - 7.8, 1, 0, Math.PI * 2)
    ctx.fill()
  }

  if (pilot === 0) {
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(px + 1, py - 12)
    ctx.quadraticCurveTo(px - 3, py - 19, px + 2, py - 22)
    ctx.stroke()
    ctx.fillStyle = skin.accentGlow
    ctx.beginPath()
    ctx.arc(px + 2, py - 23, 3.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (pilot === 1) {
    ctx.fillStyle = '#161515'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.6
    ctx.beginPath()
    safeRoundRect(ctx, px - 14, py - 12, 28, 10, 4)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = '#ffd35a'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(px - 9, py - 9)
    ctx.lineTo(px - 4, py - 11)
    ctx.moveTo(px + 4, py - 9)
    ctx.lineTo(px + 9, py - 11)
    ctx.stroke()
  } else if (pilot === 2) {
    ctx.fillStyle = '#ce7b7f'
    ctx.strokeStyle = '#6b282b'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(px - 9, py - 12)
    ctx.lineTo(px - 10, py - 22)
    ctx.lineTo(px - 4, py - 17)
    ctx.lineTo(px + 1, py - 24)
    ctx.lineTo(px + 6, py - 17)
    ctx.lineTo(px + 12, py - 22)
    ctx.lineTo(px + 11, py - 12)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

function flameFrom(ctx: CanvasRenderingContext2D, x0: number, len: number, w: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(x0, -w)
  ctx.quadraticCurveTo(x0 - len * 0.55, -w * 1.15, x0 - len, 0)
  ctx.quadraticCurveTo(x0 - len * 0.55, w * 1.15, x0, w)
  ctx.closePath()
  ctx.fill()
}

/** Корабль 2 — «Ретро»: тонкая чёрно-золотая сигара с плавниками, как в старых комиксах. */
function drawShipRetro(ctx: CanvasRenderingContext2D, skin: RocketSkinConfig, t: number, mult: number, withFlame: boolean) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const GOLD = '#f1c05a'
  if (withFlame) {
    const wob = 1 + Math.sin(t * 26) * 0.06 + Math.sin(t * 15) * 0.05
    const len = (66 + Math.min(34, mult * 3)) * wob
    flameFrom(ctx, -56, len, 8, '#ff8a2a')
    flameFrom(ctx, -56, len * 0.72, 5.6, '#ffd35a')
    flameFrom(ctx, -56, len * 0.4, 3, '#ffffff')
  }
  // Плавники
  ctx.fillStyle = GOLD
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.6
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(-14, dir * 11)
    ctx.lineTo(-50, dir * 36)
    ctx.lineTo(-58, dir * 36)
    ctx.lineTo(-44, dir * 11)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  // Сопло
  ctx.fillStyle = '#b5832a'
  ctx.beginPath()
  safeRoundRect(ctx, -60, -8, 13, 16, 4)
  ctx.fill()
  ctx.stroke()

  const body = () => {
    ctx.beginPath()
    ctx.moveTo(-48, -12)
    ctx.lineTo(24, -13.5)
    ctx.quadraticCurveTo(54, -11, 72, 0)
    ctx.quadraticCurveTo(54, 11, 24, 13.5)
    ctx.lineTo(-48, 12)
    ctx.quadraticCurveTo(-56, 0, -48, -12)
    ctx.closePath()
  }
  const hull = ctx.createLinearGradient(0, -14, 0, 14)
  hull.addColorStop(0, '#5b5b66')
  hull.addColorStop(0.45, '#2b2b32')
  hull.addColorStop(1, '#141418')
  ctx.fillStyle = hull
  body()
  ctx.fill()
  ctx.save()
  body()
  ctx.clip()
  ctx.fillStyle = GOLD
  for (const x of [-36, -20, -4]) ctx.fillRect(x, -16, 7, 32)
  ctx.fillRect(48, -16, 32, 32) // золотой нос
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.beginPath()
  ctx.ellipse(-2, -8.5, 34, 2.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 3
  body()
  ctx.stroke()

  // Иллюминатор с голубым стеклом
  const glass = ctx.createLinearGradient(0, -8, 0, 6)
  glass.addColorStop(0, '#b5f3ff')
  glass.addColorStop(1, '#3aa7d6')
  ctx.fillStyle = glass
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.arc(24, -1, 6.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  drawPepe(ctx, skin, t, -4, -31, -15, 1)
}

/** Корабль 3 — «Капля»: фирменная глянцевая капсула-капля розово-фиолетового цвета. */
function drawShipDrop(ctx: CanvasRenderingContext2D, skin: RocketSkinConfig, t: number, mult: number, withFlame: boolean) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (withFlame) {
    const wob = 1 + Math.sin(t * 22) * 0.08 + Math.sin(t * 11) * 0.06
    const len = (36 + Math.min(26, mult * 2.6)) * wob
    for (const [k, w, c] of [[1, 12, '#a043ff'], [0.7, 8.5, '#ff7ac2'], [0.4, 4.5, '#ffffff']] as const) {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.ellipse(-32 - (len * k) / 2, 0, (len * k) / 2, w, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Боковые плавники
  ctx.fillStyle = '#2b1b4d'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.6
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(-6, dir * 21)
    ctx.quadraticCurveTo(-34, dir * 42, -50, dir * 24)
    ctx.quadraticCurveTo(-34, dir * 22, -26, dir * 10)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  // Сопло
  ctx.fillStyle = '#1b1230'
  ctx.beginPath()
  ctx.ellipse(-30, 0, 5, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  const body = () => {
    ctx.beginPath()
    ctx.moveTo(66, 0)
    ctx.quadraticCurveTo(30, -7, 0, -22.6)
    ctx.arc(-8, 0, 24, -1.2305, 1.2305, true)
    ctx.quadraticCurveTo(30, 7, 66, 0)
    ctx.closePath()
  }
  const hull = ctx.createRadialGradient(-14, -10, 2, -8, 0, 56)
  hull.addColorStop(0, '#ffa8dc')
  hull.addColorStop(0.45, '#d247d9')
  hull.addColorStop(1, '#5d1fd1')
  ctx.fillStyle = hull
  body()
  ctx.fill()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 3.2
  body()
  ctx.stroke()

  // Глянец и бренд-капля на боку
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.beginPath()
  ctx.ellipse(-16, -13, 11, 4.6, -0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(18, -9)
  ctx.bezierCurveTo(25, -1, 25, 6, 18, 6)
  ctx.bezierCurveTo(11, 6, 11, -1, 18, -9)
  ctx.fill()

  // Пепе в стеклянном пузыре
  drawPepe(ctx, skin, t, -8, -31, -20, 3)
  ctx.fillStyle = 'rgba(190, 235, 255, 0.2)'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(-8, -27, 19, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(-8, -27, 14, Math.PI * 1.1, Math.PI * 1.45)
  ctx.stroke()
}

/** Корабль выбирается по скину: 0 — классика, 1 — ретро, 2 — капля. */
export function drawCartoonRocket(
  ctx: CanvasRenderingContext2D,
  skin: RocketSkinConfig,
  t: number,
  mult: number,
  withFlame: boolean,
) {
  const ship = Math.abs(skin.id) % 3
  if (ship === 1) return drawShipRetro(ctx, skin, t, mult, withFlame)
  if (ship === 2) return drawShipDrop(ctx, skin, t, mult, withFlame)
  return drawShipClassic(ctx, skin, t, mult, withFlame)
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
    hullGradient: ['#ffffff', '#f9f1f1', '#e1cbcc', '#7a7575'],
    hullBorder: 'rgba(171, 63, 69, 0.85)',
    accentColor: '#ab3f45',
    accentGlow: '#c7696d',
    wingFill: ['#454343', '#2d2c2c'],
    wingBorder: '#ab3f45',
    wingtipLight: '#c7696d',
    nozzleFill: '#1d1c1c',
    nozzleRing: '#ab3f45',
    decalColor: '#ab3f45',
    decalSubtext: 'SEXY DROP',
    canopyGradient: ['rgba(255, 255, 255, 0.75)', 'rgba(199, 105, 109, 0.28)', 'rgba(171, 63, 69, 0.08)'],
    canopyBorder: '#eccbcd',
    canopyReflection: 'rgba(255, 255, 255, 0.98)',
    flameCore: ['#ffffff', '#db9ea1', '#ab3f45', 'rgba(171, 63, 69, 0)'],
    flameAura: ['rgba(171, 63, 69, 0.85)', 'rgba(199, 105, 109, 0.35)'],
    trailColors: ['#ab3f45', '#c7696d', '#ffffff', '#db9ea1', '#93363b'],
    pilotType: 0,
  },
  {
    id: 1,
    name: 'Cyber Stealth',
    nameRu: 'Кибер Стелс',
    pilotNameRu: 'Кибер Пепе',
    hullGradient: ['#5a5656', '#454343', '#2d2c2c', '#1d1c1c'],
    hullBorder: 'rgba(199, 105, 109, 0.85)',
    accentColor: '#c7696d',
    accentGlow: '#93363b',
    wingFill: ['#2d2c2c', '#1d1c1c'],
    wingBorder: '#c7696d',
    wingtipLight: '#db9ea1',
    nozzleFill: '#111010',
    nozzleRing: '#c7696d',
    decalColor: '#c7696d',
    decalSubtext: 'STEALTH · 99',
    canopyGradient: ['rgba(255, 255, 255, 0.7)', 'rgba(199, 105, 109, 0.25)', 'rgba(29, 28, 28, 0.1)'],
    canopyBorder: '#db9ea1',
    canopyReflection: 'rgba(255, 255, 255, 0.95)',
    flameCore: ['#ffffff', '#c7696d', '#93363b', 'rgba(147, 54, 59, 0)'],
    flameAura: ['rgba(199, 105, 109, 0.85)', 'rgba(180, 67, 72, 0.35)'],
    trailColors: ['#c7696d', '#ab3f45', '#ffffff', '#d48c8f', '#93363b'],
    pilotType: 1,
  },
  {
    id: 2,
    name: 'Imperial 24K',
    nameRu: 'Империал 24K',
    pilotNameRu: 'Король Пепе',
    hullGradient: ['#faf0f1', '#cd777b', '#b14147', '#96383c'],
    hullBorder: 'rgba(177, 65, 71, 0.9)',
    accentColor: '#c35c61',
    accentGlow: '#ba464b',
    wingFill: ['#2d2c2c', '#1d1c1c'],
    wingBorder: '#cd777b',
    wingtipLight: '#dfa9ac',
    nozzleFill: '#1d1c1c',
    nozzleRing: '#c35c61',
    decalColor: '#c35c61',
    decalSubtext: 'ROYAL · VIP',
    canopyGradient: ['rgba(255, 255, 255, 0.8)', 'rgba(223, 169, 172, 0.25)', 'rgba(186, 70, 75, 0.08)'],
    canopyBorder: '#dfa9ac',
    canopyReflection: 'rgba(255, 255, 255, 0.98)',
    flameCore: ['#ffffff', '#cd777b', '#ba464b', 'rgba(186, 70, 75, 0)'],
    flameAura: ['rgba(186, 70, 75, 0.85)', 'rgba(195, 92, 97, 0.4)'],
    trailColors: ['#c35c61', '#ba464b', '#ffffff', '#dfa8ab', '#a33c41'],
    pilotType: 2,
  },
]

/* --- Запуск: площадка, зарядка перед стартом и ударная волна с дымом при старте --- */
function drawIgnition(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, accent: string) {
  const k = Math.min(1, t / 1.2)
  ctx.save()
  // вспышка зажигания
  if (t < 0.3) {
    const a = (1 - t / 0.3) * 0.55
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90)
    g.addColorStop(0, `rgba(255, 255, 255, ${a})`)
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 90, y - 90, 180, 180)
  }
  // три кольца ударной волны (приплюснутые — идут «по земле»)
  ctx.lineWidth = 3
  for (let i = 0; i < 3; i++) {
    const tt = t - i * 0.12
    if (tt <= 0) continue
    const r = tt * 175
    ctx.globalAlpha = Math.max(0, 1 - tt / 0.9) * 0.7
    ctx.strokeStyle = i === 0 ? '#ffffff' : accent
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  // клубы дыма разлетаются в стороны и тают
  ctx.fillStyle = '#c9ccd3'
  for (let i = 0; i < 9; i++) {
    const dir = (i / 8) * 2 - 1
    const px = x + dir * (30 + t * 95)
    const py = y - Math.abs(dir) * 6 - t * (10 + (i % 3) * 10)
    const rr = 8 + t * (20 + (i % 3) * 6)
    ctx.globalAlpha = Math.max(0, 0.5 * (1 - k))
    ctx.beginPath()
    ctx.arc(px, py, rr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

interface Rocket3DCanvasProps {
  phase: CrashPhase
  multiplier: number
  roundId?: number
  skinIndex?: number
  fullscreen?: boolean
  /** Секунд до старта (окно ставок): ракета на площадке «заряжается» к старту. */
  secondsLeft?: number
  className?: string
}

export function Rocket3DCanvas({
  phase,
  multiplier,
  roundId,
  skinIndex,
  fullscreen = false,
  secondsLeft,
  className,
}: Rocket3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const prevPhaseRef = useRef<CrashPhase>(phase)

  // Держим свежие пропсы для цикла анимации (синхронное обновление)
  const propsRef = useRef({ phase, multiplier, roundId, skinIndex, fullscreen, secondsLeft })
  propsRef.current = { phase, multiplier, roundId, skinIndex, fullscreen, secondsLeft }

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
    /** лента-след: точки сопла, дрейфуют назад */
    ribbon: { x: number; y: number }[]
    ribbonAcc: number
    /** скользящее среднее dt и флаг облегчённого режима для слабых устройств */
    emaDt: number
    lowQ: boolean
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
    ribbon: [],
    ribbonAcc: 0,
    emaDt: 0.016,
    lowQ: false,
    swellT: -1,
  })

  // Инициализация фоновых звёзд по всему экрану (Starfield)
  useEffect(() => {
    const stars: Star[] = []
    const count = GRAPHICS_PRESETS[useGraphicsStore.getState().quality].stars
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
      state.shake = 9 // толчок зажигания
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
        const colors = ['#ffffff', '#c7696d', '#d3878b', '#c35c61', '#ce6565', '#c96e72']
        const expCount = GRAPHICS_PRESETS[useGraphicsStore.getState().quality].explosion
        for (let i = 0; i < expCount; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = 2.5 + Math.random() * 9
          const maxLife = 40 + Math.floor(Math.random() * 40)
          exp.push({
            x: rx,
            y: ry,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 7,
            alpha: 1,
            color: colors[Math.floor(Math.random() * colors.length)] ?? '#c35c61',
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
      const dprRaw = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
      const dpr = stateRef.current.lowQ ? 1 : Math.min(GRAPHICS_PRESETS[useGraphicsStore.getState().quality].dpr, dprRaw)

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
        // Облегчённый режим: если кадры стабильно дольше ~24 мс, отключаем мягкое свечение
        state.emaDt += (dt - state.emaDt) * 0.05
        if (state.emaDt > 0.024) state.lowQ = true
        else if (state.emaDt < 0.019) state.lowQ = false

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
        const starsMove = currentPhase !== 'crashed'
        for (const star of state.stars) {
          if (starsMove) star.x -= star.speed * flightSpeedFactor
          if (star.x < 0) {
            star.x = width + Math.random() * 50
            star.y = Math.random() * height
          }

          if (currentPhase === 'flying' && star.layer >= 3) {
            const streakLen = Math.min(26, star.speed * flightSpeedFactor * 2.4)
            ctx.strokeStyle = `rgba(255, 255, 255, ${star.opacity * 0.7})`
            ctx.lineWidth = star.size * 0.7
            ctx.beginPath()
            ctx.moveTo(star.x, star.y)
            ctx.lineTo(star.x + streakLen, star.y)
            ctx.stroke()
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
            ctx.fillRect(star.x - star.size / 2, star.y - star.size / 2, star.size, star.size)
          }
        }
        ctx.restore()

        // Окно ставок: ракета стоит на площадке и «заряжается» к старту (дрожь и пламя растут)
        if (currentPhase === 'betting') {
          state.ribbon = []
          state.speedStreaks = []
          // Во время отсчёта на арене ничего нет: ни ракеты, ни площадки — всё появляется после «0»

          return
        }

        // --- 2. Позиция ракеты: Плавный взлёт на старте и ОСТАНОВКА НА БАРЬЕРЕ ---
        state.flightSeconds += dt

        // Точка старта (нижняя левая область арены)
        const launchX = width * 0.27
        const launchY = height * 0.58
        const launchAngle = -28

        // Эффекты зажигания: вспышка, ударные кольца и дым у площадки
        if (currentPhase === 'flying' && state.flightSeconds < 1.2) {
          drawIgnition(ctx, launchX, launchY + 40, state.flightSeconds, skin.accentColor)
        }

        // Точка круизного барьера (центр/верх арены — ракета доходит сюда и ОСТАНАВЛИВАЕТСЯ)
        const barrierX = width * 0.5
        const barrierY = height * 0.4
        const barrierAngle = -6

        // Взлёт по дуге за 2 c, затем ракета без остановок плывёт по большой плавной восьмёрке
        const riseDuration = 2.0
        const riseProgress = Math.min(1, state.flightSeconds / riseDuration)
        const easeRise = -(Math.cos(Math.PI * riseProgress) - 1) / 2
        const arcLift = Math.sin(Math.PI * riseProgress) * height * 0.05

        const t = state.flightSeconds
        const cruise = riseProgress >= 1 ? Math.min(1, (t - riseDuration) / 1.5) : 0
        const ampX = width * 0.26
        const ampY = height * 0.19
        const driftX = Math.sin(t * 0.62) * ampX * cruise
        const driftY = Math.sin(t * 1.24 + 0.8) * ampY * cruise
        const targetX = launchX + (barrierX - launchX) * easeRise + driftX
        const targetY = launchY + (barrierY - launchY) * easeRise - arcLift + driftY
        // Угол следует за вертикальной скоростью (крен в поворот), всегда носом вперёд
        const vy = Math.cos(t * 1.24 + 0.8) * ampY * 1.24 * cruise
        const targetAngle =
          launchAngle + (barrierAngle - launchAngle) * easeRise + (Math.atan2(vy, 150) * 180) / Math.PI

        const hoverY = 0
        const hoverAngle = 0

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

        // --- 2. След: у каждого корабля свой (дым / золотые искры / капли), без лент и теней ---
        if (currentPhase === 'flying') {
          const ship = Math.abs(skin.id) % 3
          const rad = (currentAngle * Math.PI) / 180
          const nozzleDist = [61, 72, 54][ship]! * 1.22
          const nozzleX = currentX - Math.cos(rad) * nozzleDist
          const nozzleY = currentY - Math.sin(rad) * nozzleDist
          const speed = 55 + Math.min(110, currentMult * 6)

          state.ribbonAcc += dt
          const interval = state.lowQ ? 0.09 : 0.05
          if (state.ribbonAcc >= interval && state.trail.length < 28) {
            state.ribbonAcc = 0
            const r = Math.random()
            if (ship === 0) {
              state.trail.push({ x: nozzleX, y: nozzleY, vx: -speed * (0.5 + r * 0.7), vy: (r - 0.5) * 18, size: 5 + r * 3, alpha: 0.55, color: '#dcdce2', life: 0, maxLife: 0.8, shape: 0 })
            } else if (ship === 1) {
              state.trail.push({ x: nozzleX, y: nozzleY, vx: -speed * (0.8 + r * 0.8), vy: (r - 0.5) * 46, size: 3.4 + r * 3.2, alpha: 1, color: r > 0.5 ? '#ffd35a' : '#fff3b0', life: 0, maxLife: 0.65, shape: 1 })
            } else {
              state.trail.push({ x: nozzleX, y: nozzleY, vx: -speed * (0.5 + r * 0.6), vy: 8 + r * 24, size: 4.6 + r * 3.4, alpha: 1, color: r > 0.5 ? '#ff8fd4' : '#b04dff', life: 0, maxLife: 0.75, shape: 2 })
            }
          }

          ctx.save()
          for (let i = state.trail.length - 1; i >= 0; i--) {
            const p = state.trail[i]!
            p.life += dt
            if (p.life >= p.maxLife) {
              state.trail.splice(i, 1)
              continue
            }
            p.x += p.vx * dt
            p.y += p.vy * dt
            if (p.shape === 2) p.vy += 150 * dt
            const k = p.life / p.maxLife
            ctx.fillStyle = p.color
            if (p.shape === 0) {
              ctx.globalAlpha = p.alpha * (1 - k)
              ctx.beginPath()
              ctx.arc(p.x, p.y, p.size * (1 + k * 1.3), 0, Math.PI * 2)
              ctx.fill()
            } else if (p.shape === 1) {
              ctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(p.life * 40))
              const s = p.size * (1 - k * 0.4)
              ctx.beginPath()
              ctx.moveTo(p.x, p.y - s)
              ctx.lineTo(p.x + s * 0.28, p.y - s * 0.28)
              ctx.lineTo(p.x + s, p.y)
              ctx.lineTo(p.x + s * 0.28, p.y + s * 0.28)
              ctx.lineTo(p.x, p.y + s)
              ctx.lineTo(p.x - s * 0.28, p.y + s * 0.28)
              ctx.lineTo(p.x - s, p.y)
              ctx.lineTo(p.x - s * 0.28, p.y - s * 0.28)
              ctx.closePath()
              ctx.fill()
            } else {
              ctx.globalAlpha = (1 - k) * 0.95
              const s = p.size * (1 - k * 0.3)
              ctx.beginPath()
              ctx.moveTo(p.x, p.y - s * 1.5)
              ctx.bezierCurveTo(p.x + s, p.y - s * 0.2, p.x + s, p.y + s, p.x, p.y + s)
              ctx.bezierCurveTo(p.x - s, p.y + s, p.x - s, p.y - s * 0.2, p.x, p.y - s * 1.5)
              ctx.fill()
            }
          }
          ctx.restore()
        } else if (state.trail.length > 0) {
          state.trail = []
        }

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
        // Появление после отсчёта: масштаб 0.55 → перелёт 1.12 → 1.0 за ~0.7 c
        const enterT = currentPhase === 'flying' ? Math.min(1, state.flightSeconds / 0.7) : 1
        const c1 = 1.70158
        const enterK = enterT >= 1 ? 1 : 0.55 + 0.45 * (1 + (c1 + 1) * Math.pow(enterT - 1, 3) + c1 * Math.pow(enterT - 1, 2))
        ctx.globalAlpha = Math.min(1, 0.35 + enterT * 0.9)
        ctx.scale(1.22 * breathe * swellK * enterK * (1 + (puff - 1) * 0.5), 1.22 * breathe * swellK * enterK * puff)

        drawCartoonRocket(ctx, skin, state.time, currentMult, !swelling)

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
            ctx.fillStyle = 'rgba(199, 105, 109, 0.35)'
            ctx.strokeStyle = '#c7696d'
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.arc(0, 0, 11, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = '#65c387'
            ctx.beginPath()
            ctx.arc(0, 1, 6.5, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = '#ffffff'
            ctx.beginPath()
            ctx.arc(-2.5, -1, 2.5, 0, Math.PI * 2)
            ctx.arc(2.5, -1, 2.5, 0, Math.PI * 2)
            ctx.fill()

            ctx.strokeStyle = '#1d1c1c'
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
        top: -50,
        left: 0,
        width: '100%',
        height: 'calc(100% + 50px)',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      aria-hidden
    />
  )
}
