import { create } from 'zustand'

export type GraphicsQuality = 'high' | 'medium' | 'low'

const KEY = 'sexydrop_graphics'

function load(): GraphicsQuality {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'high' || v === 'low' ? v : 'medium'
  } catch {
    return 'medium'
  }
}

/**
 * Атрибут `data-gfx` на <html>: по нему CSS (src/styles/graphics.css и `:global(html[data-gfx=…])`
 * в модулях) приглушает анимации в меню и играх.
 */
function applyToDocument(quality: GraphicsQuality): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.gfx = quality
}

interface GraphicsState {
  quality: GraphicsQuality
  setQuality: (quality: GraphicsQuality) => void
}

const initial = load()
applyToDocument(initial)

/** Качество графики в меню и играх: анимации, число частиц и звёзд, разрешение холстов. */
export const useGraphicsStore = create<GraphicsState>((set) => ({
  quality: initial,
  setQuality: (quality) => {
    try {
      window.localStorage.setItem(KEY, quality)
    } catch {
      /* без localStorage — просто не запоминаем */
    }
    applyToDocument(quality)
    set({ quality })
  },
}))

/**
 * Параметры эффектов по качеству.
 * Ракетка: dpr, stars, explosion, bgStars, floaters.
 * Мини-ракета в баннере меню: menuDpr, menuStars, menuSparks (искр пламени за кадр),
 * menuBurst (осколков взрыва), menuGlow (мягкое свечение следа), menuFps.
 */
export const GRAPHICS_PRESETS = {
  high: {
    dpr: 1.5, stars: 14, explosion: 6, bgStars: 12, floaters: true,
    menuDpr: 2, menuStars: 22, menuSparks: 2, menuBurst: 34, menuGlow: true, menuFps: 60,
  },
  medium: {
    dpr: 1.25, stars: 8, explosion: 4, bgStars: 6, floaters: false,
    menuDpr: 1.5, menuStars: 14, menuSparks: 1, menuBurst: 20, menuGlow: true, menuFps: 60,
  },
  low: {
    dpr: 1, stars: 3, explosion: 3, bgStars: 0, floaters: false,
    menuDpr: 1, menuStars: 0, menuSparks: 0, menuBurst: 10, menuGlow: false, menuFps: 30,
  },
} as const

export const GRAPHICS_LABELS: ReadonlyArray<{ id: GraphicsQuality; label: string }> = [
  { id: 'high', label: 'Высокая' },
  { id: 'medium', label: 'Средняя' },
  { id: 'low', label: 'Минимальная' },
]
