import { describe, expect, it } from 'vitest'
import { BETTING_MS, TICK_MS, recentCrashPoints, roundInfo, scheduleAt } from './crashSchedule'

const T0 = Date.UTC(2026, 9, 30, 12, 0, 0)

describe('crashSchedule: общие раунды для всех устройств', () => {
  it('одно и то же время даёт одно и то же состояние (детерминированность)', () => {
    for (let i = 0; i < 400; i++) {
      const now = T0 + i * 733
      expect(scheduleAt(now)).toEqual(scheduleAt(now))
    }
  })

  it('раунд проходит фазы betting → flying → crashed по порядку, множитель не убывает', () => {
    const seen: string[] = []
    let lastMult = 1
    let lastRound = -1
    for (let ms = 0; ms < 120_000; ms += TICK_MS) {
      const st = scheduleAt(T0 + ms)
      if (st.roundId !== lastRound) {
        lastRound = st.roundId
        lastMult = 1
        seen.push(st.phase)
      } else if (seen[seen.length - 1] !== st.phase) {
        seen.push(st.phase)
      }
      if (st.phase === 'flying') {
        expect(st.multiplier).toBeGreaterThanOrEqual(lastMult)
        lastMult = st.multiplier
      }
    }
    expect(seen.slice(0, 3)).toEqual(['betting', 'flying', 'crashed'])
  })

  it('окно ставок — 5 секунд, а в конце полёта множитель равен точке краша', () => {
    const w = Math.floor(T0 / 600_000) * 600_000
    const first = roundInfo(Math.floor(w / 600_000) * 1000)
    expect(scheduleAt(w + 100).phase).toBe('betting')
    expect(scheduleAt(w + BETTING_MS + 10).phase).toBe('flying')
    const afterFlight = w + BETTING_MS + first.curve.length * TICK_MS + 10
    const st = scheduleAt(afterFlight)
    expect(st.phase).toBe('crashed')
    expect(st.multiplier).toBe(first.crashPoint)
  })

  it('граница 10-минутного окна не ломает расписание', () => {
    const boundary = Math.ceil(T0 / 600_000) * 600_000
    for (let ms = -40_000; ms <= 40_000; ms += 500) {
      const st = scheduleAt(boundary + ms)
      expect(['betting', 'flying', 'crashed']).toContain(st.phase)
      expect(st.multiplier).toBeGreaterThanOrEqual(1)
    }
  })

  it('история — 12 прошлых краш-точек, не меньше 1.00', () => {
    const history = recentCrashPoints(T0 + 5 * 60_000, 12)
    expect(history).toHaveLength(12)
    for (const x of history) expect(x).toBeGreaterThanOrEqual(1)
  })
})
