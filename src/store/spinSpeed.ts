import { create } from 'zustand'

const KEY = 'sexydrop_turbo_spin'

function load(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

interface SpinSpeedState {
  /** Быстрый прокрут: рулетка кейса и апгрейда крутятся в несколько раз быстрее. */
  turbo: boolean
  setTurbo: (value: boolean) => void
}

export const useSpinSpeedStore = create<SpinSpeedState>((set) => ({
  turbo: load(),
  setTurbo: (turbo) => {
    try {
      window.localStorage.setItem(KEY, turbo ? '1' : '0')
    } catch {
      /* без хранилища настройка живёт до перезагрузки */
    }
    set({ turbo })
  },
}))

/** Длительность основного рывка рулетки кейса, мс. */
export const caseSpinMs = (turbo: boolean) => (turbo ? 2300 : 7200)
/** Длительность вращения стрелки апгрейда, мс. */
export const upgradeSpinMs = (turbo: boolean) => (turbo ? 1200 : 3200)
