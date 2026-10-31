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

interface GraphicsState {
  quality: GraphicsQuality
  setQuality: (quality: GraphicsQuality) => void
}

/** Качество графики в играх: влияет на число частиц, звёзд и разрешение холста. */
export const useGraphicsStore = create<GraphicsState>((set) => ({
  quality: load(),
  setQuality: (quality) => {
    try {
      window.localStorage.setItem(KEY, quality)
    } catch {
      /* без localStorage — просто не запоминаем */
    }
    set({ quality })
  },
}))

/** Параметры эффектов по качеству. */
export const GRAPHICS_PRESETS = {
  high: { dpr: 1.5, stars: 28, explosion: 20, bgStars: 28, floaters: true },
  medium: { dpr: 1.25, stars: 16, explosion: 12, bgStars: 18, floaters: true },
  low: { dpr: 1, stars: 6, explosion: 6, bgStars: 0, floaters: false },
} as const
