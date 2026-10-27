import { beforeEach, describe, expect, it } from 'vitest'
import { makeCrashPoint } from '../services/demoCrashService'
import { rollDice } from '../services/demoDiceService'
import { spinSpins } from '../services/demoSpinsService'
import { cashoutMines, pickMines, startMines } from '../services/demoMinesService'
import { dropPlinko } from '../services/demoPlinkoService'
import { plinkoExactRtp } from './plinkoMath'
import {
  SPINS_BONUS_WEIGHT,
  SPINS_BONUS_WEIGHT_DOUBLE,
  SPINS_GIFTS,
  bonusEvNumerator,
  bonusFreeStakeMinor,
  spinsMultiplierHundredths,
  weightsTotal,
} from './spinsMath'
import { mulByMultiplier } from './money'
import { GAME_RTP } from './gameConfig'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

/**
 * Симуляционные тесты RTP (4.10). Прогон через РЕАЛЬНЫЕ сервисы/математику
 * (Math.random, без подмен), ставки в минорных единицах, деньги целыми.
 *
 * Выбор N: окно ±0.5% при 3σ ⇒ N ≥ (3σ/0.005)², где σ — ско результата на
 * единицу ставки. Отклонения задокументированы в тестах и PROGRESS.md (10.16).
 */

const SEED_BALANCE = 1_000_000_000 // 1 000 000 GRAM
const BET = 1000 // 1 GRAM

let requestCounter = 0
function uid(prefix: string): string {
  requestCounter += 1
  return `${prefix}-${requestCounter}`
}

function resetTestState(): void {
  useWalletStore.setState({ mode: 'demo', balances: { demo: SEED_BALANCE, real: 0 } })
  useGamesHistoryStore.setState({ entries: [] })
}

/** Защита длинных прогонов: если баланс просел — тестовая доливка. */
function ensureFunds(roundIndex: number): void {
  if (roundIndex % 200_000 === 0 && roundIndex > 0) {
    if (useWalletStore.getState().getBalance('demo') < 200_000_000) {
      useWalletStore.setState((s) => ({ balances: { ...s.balances, demo: SEED_BALANCE } }))
    }
  }
}

interface SimStats {
  staked: number
  paid: number
}

function rtpOf(stats: SimStats): number {
  return stats.paid / stats.staked
}

beforeEach(() => {
  resetTestState()
})

describe('gameSim 4.10: RTP симуляций через реальные сервисы (±0.5% при 3σ)', () => {
  it(
    'Дайс: p = 0.5 (N=400k), p = 0.25 (N=1.1M), p = 0.1 (N=3.2M) — окна ±0.5%',
    { timeout: 300_000 },
    () => {
      const cases: Array<{ target: number; p: number; n: number; window: number }> = [
        { target: 5000, p: 0.5, n: 400_000, window: 0.005 }, // m4 = 19600 → m = 1.96, EV = 0.98
        { target: 2500, p: 0.25, n: 1_100_000, window: 0.005 }, // m4 = 39200 → 3.92
        { target: 1000, p: 0.1, n: 3_200_000, window: 0.005 }, // m4 = 98000 → 9.8
      ]
      for (const { target, p, n, window } of cases) {
        resetTestState()
        const stats: SimStats = { staked: 0, paid: 0 }
        for (let i = 0; i < n; i += 1) {
          ensureFunds(i)
          const result = rollDice(BET, target, 'under', uid('dice'))
          if (result.status !== 'ok') throw new Error(`rejected: ${result.reason}`)
          stats.staked += BET
          stats.paid += result.winMinor
        }
        // m4 = floor(98·10^6 / c) → m = m4/10^4 (как в diceMath)
        const theoretical = p * (Math.floor(GAME_RTP * 100 * 1_000_000 / target) / 10_000)
        const rtp = rtpOf(stats)
        expect(Math.abs(rtp - theoretical)).toBeLessThanOrEqual(window)
      }
    },
  )

  it(
    'Дайс: p = 0.02, N = 17M — окно ±0.5% (3σ = 6.78·3/√17M ≈ 0.49%)',
    { timeout: 300_000 },
    () => {
      resetTestState()
      const stats: SimStats = { staked: 0, paid: 0 }
      for (let i = 0; i < 17_000_000; i += 1) {
        ensureFunds(i)
        const result = rollDice(BET, 200, 'under', uid('dice'))
        if (result.status !== 'ok') throw new Error(`rejected: ${result.reason}`)
        stats.staked += BET
        stats.paid += result.winMinor
      }
      const rtp = rtpOf(stats)
      // m4 = floor(98e6/200) = 490000 → m = 49.0 → EV = 0.02·49 = 0.98
      expect(Math.abs(rtp - 0.98)).toBeLessThanOrEqual(0.005)
    },
  )

  it(
    'Краш: кешаут на 2.00 (N=400k) и 10.00 (N=3.2M) — сеточная EV = m·RTP/(m+0.01) ±0.5%',
    { timeout: 300_000 },
    () => {
      // Точная семантика demo-движка (тик): показанный множитель floor2(acc);
      // кешаут на первом displayed ≥ m; краш, если crash ≤ displayed. Для m на
      // сетке 0.01: выигрыш ⇔ crash > m; выплата floor(bet·m) — как в cashout().
      const cases: Array<{ target: number; n: number }> = [
        { target: 2, n: 400_000 },
        { target: 10, n: 3_200_000 },
      ]
      for (const { target, n } of cases) {
        resetTestState()
        const stats: SimStats = { staked: 0, paid: 0 }
        for (let i = 0; i < n; i += 1) {
          ensureFunds(i)
          const crash = makeCrashPoint(Math.random)
          stats.staked += BET
          if (crash > target) {
            stats.paid += mulByMultiplier(BET, target)
          }
        }
        const theoretical = (target * GAME_RTP) / (target + 0.01)
        const rtp = rtpOf(stats)
        expect(Math.abs(rtp - theoretical)).toBeLessThanOrEqual(0.005)
        expect(theoretical).toBeLessThanOrEqual(GAME_RTP)
      }
    },
  )

  it(
    'Плинко: n=8 (2M), n=12 (3M), n=16 (4M) — против точного рационального RTP',
    { timeout: 300_000 },
    () => {
      // Первичный инвариант — точный рациональный EV (BigInt) из plinkoMath
      // (см. тесты plinkoMath). Симы проверяют реализацию сервиса; из-за тяжёлых
      // хвостов (максимальные множители x27.88/x308/x5941) окна 3σ при этих N
      // шире ±0.5% — задокументированное отклонение (PROGRESS.md 10.16):
      //   n=8: 3σ ≈ 0.53%, n=12: 3σ ≈ 1.23%, n=16: 3σ ≈ 0.93%.
      const cases: Array<{ rows: 8 | 12 | 16; n: number; window: number }> = [
        { rows: 8, n: 2_000_000, window: 0.006 },
        { rows: 12, n: 3_000_000, window: 0.013 },
        { rows: 16, n: 4_000_000, window: 0.01 },
      ]
      for (const { rows, n, window } of cases) {
        resetTestState()
        const stats: SimStats = { staked: 0, paid: 0 }
        for (let i = 0; i < n; i += 1) {
          ensureFunds(i)
          const result = dropPlinko(BET, rows, uid('plinko'))
          if (result.status !== 'ok') throw new Error(`rejected: ${result.reason}`)
          stats.staked += BET
          stats.paid += result.winMinor
        }
        const exact = plinkoExactRtp(rows)
        const theoretical = Number(exact.numerator) / Number(exact.denominator)
        const rtp = rtpOf(stats)
        expect(Math.abs(rtp - theoretical)).toBeLessThanOrEqual(window)
        expect(theoretical).toBeLessThanOrEqual(GAME_RTP)
      }
    },
  )

  it(
    'Мины: m = 3, кешаут на k = 3 (N=200k) — EV = P·m ±0.5%',
    { timeout: 300_000 },
    () => {
      resetTestState()
      const stats: SimStats = { staked: 0, paid: 0 }
      for (let i = 0; i < 200_000; i += 1) {
        ensureFunds(i)
        const start = startMines(BET, 3, uid('mines'))
        if (start.status !== 'ok') throw new Error(`rejected: ${start.reason}`)
        stats.staked += BET
        let roundPaid = 0
        for (let k = 0; k < 3; k += 1) {
          const pick = pickMines(10 + k, uid('mines'))
          if (pick.status !== 'ok') throw new Error(`rejected: ${pick.reason}`)
          if (pick.event === 'lost') {
            roundPaid = 0
            break
          }
          if (pick.event === 'cleared') {
            roundPaid = pick.payoutMinor
            break
          }
          if (k === 2) {
            const cash = cashoutMines(uid('mines'))
            if (cash.status !== 'ok') throw new Error(`rejected: ${cash.reason}`)
            roundPaid = cash.payoutMinor
          }
        }
        stats.paid += roundPaid
      }
      // m=3, k=3: m_h = floor(98·C(25,3)/C(22,3)) = 146 → x1.46; P = 1540/2300
      const theoretical = ((1540 / 2300) * 146) / 100
      const rtp = rtpOf(stats)
      expect(Math.abs(rtp - theoretical)).toBeLessThanOrEqual(0.005)
      expect(theoretical).toBeLessThanOrEqual(GAME_RTP)
    },
  )

  it(
    'Спины: база W=80 (N=450k) и двойной шанс W=88 (N=450k) — против точного EV ±0.5%',
    { timeout: 300_000 },
    () => {
      const cases: Array<{ doubleChance: boolean; n: number }> = [
        { doubleChance: false, n: 450_000 },
        { doubleChance: true, n: 450_000 },
      ]
      for (const { doubleChance, n } of cases) {
        resetTestState()
        const stats: SimStats = { staked: 0, paid: 0 }
        for (let i = 0; i < n; i += 1) {
          ensureFunds(i)
          const result = spinSpins(BET, doubleChance, uid('spins'))
          if (result.status !== 'ok') throw new Error(`rejected: ${result.reason}`)
          stats.staked += BET
          stats.paid +=
            result.kind === 'gift' ? result.payoutMinor : result.bonusPayoutMinor
        }
        // Точный EV (BigInt): подарки + вклад бонус-символа (бесплатный спин M2)
        const W = BigInt(weightsTotal(doubleChance))
        const wBonus = BigInt(doubleChance ? SPINS_BONUS_WEIGHT_DOUBLE : SPINS_BONUS_WEIGHT)
        let giftSum = 0n
        for (let i = 0; i < SPINS_GIFTS.length; i += 1) {
          const symbol = SPINS_GIFTS[i]
          if (!symbol) throw new Error('symbol table corrupted')
          giftSum += BigInt(symbol.weight) * BigInt(spinsMultiplierHundredths(i, doubleChance))
        }
        const freeStake = BigInt(bonusFreeStakeMinor(BET, doubleChance))
        const num =
          7200n * BigInt(BET) * giftSum + 100n * wBonus * BigInt(bonusEvNumerator()) * freeStake
        const den = 100n * W * 7200n * BigInt(BET)
        const theoretical = Number(num) / Number(den)
        const rtp = rtpOf(stats)
        expect(Math.abs(rtp - theoretical)).toBeLessThanOrEqual(0.005)
        expect(theoretical).toBeLessThanOrEqual(GAME_RTP)
        expect(theoretical).toBeGreaterThan(0.97)
      }
    },
  )
})
