import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetJackpotForTests,
  _setJackpotRngForTests,
  drawJackpot,
  startJackpotRound,
} from './demoJackpotService'
import { _resetTvtForTests, _setTvtRngForTests, flipTvt } from './demoTvtService'
import { useWalletStore } from '../store/wallet'
import { usePvpRoundsStore } from '../store/pvpRounds'
import { usePvpMatchesStore } from '../store/pvpMatches'

beforeEach(() => {
  _resetJackpotForTests()
  _resetTvtForTests()
  _setJackpotRngForTests(Math.random)
  _setTvtRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  usePvpMatchesStore.setState({ entries: [] })
})

describe('demoTvtService (5.3: монета 50/50 ×1.96)', () => {
  it('выигрыш Лёд: дебет, бросок, выплата floor(bet·1.96), кредит', () => {
    _setTvtRngForTests(() => 0.3) // Лёд
    const result = flipTvt('ice', 1000, 'req-1')
    expect(result).toEqual({
      status: 'ok',
      flip: 'ice',
      won: true,
      payoutMinor: 1960,
      betMinor: 1000,
      multiplierHundredths: 196,
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_960)
    expect(usePvpRoundsStore.getState().tvt).toEqual({
      betMinor: 1000,
      side: 'ice',
      finished: true,
      result: { flip: 'ice', won: true, payoutMinor: 1960 },
    })
  })

  it('проигрыш: сторона не совпала — ставка сгорает, история честная', () => {
    _setTvtRngForTests(() => 0.6) // Огонь
    const result = flipTvt('ice', 1000, 'req-1')
    expect(result).toMatchObject({ status: 'ok', flip: 'fire', won: false, payoutMinor: 0 })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(usePvpMatchesStore.getState().entries[0]).toMatchObject({
      mode: 'tvt',
      stakeMinor: 1000,
      outcome: 'lost',
      deltaMinor: -1000,
      detail: 'Огонь · ×1.96',
    })
  })

  it('выбор Огонь: выигрыш при fire, граница 0.5', () => {
    _setTvtRngForTests(() => 0.5) // ровно 0.5 → Огонь
    const result = flipTvt('fire', 1000, 'req-1')
    expect(result).toMatchObject({ status: 'ok', flip: 'fire', won: true, payoutMinor: 1960 })
    expect(usePvpMatchesStore.getState().entries[0]).toMatchObject({
      outcome: 'won',
      deltaMinor: 960,
      detail: 'Огонь · ×1.96',
    })
  })

  it('округление выплаты вниз: bet 999 → floor(999·1.96) = 1958', () => {
    _setTvtRngForTests(() => 0.1)
    const result = flipTvt('ice', 999, 'req-1')
    expect(result.status === 'ok' && result.payoutMinor).toBe(1958)
  })

  it('отказы: сторона, сумма, баланс — без списаний и записей', () => {
    expect(flipTvt('coin' as 'ice', 1000, 'req-a')).toEqual({
      status: 'rejected',
      reason: 'invalid_side',
    })
    expect(flipTvt('ice', 0, 'req-b')).toEqual({ status: 'rejected', reason: 'invalid_amount' })
    expect(flipTvt('ice', 100_001, 'req-c')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
    expect(usePvpMatchesStore.getState().entries).toHaveLength(0)
  })

  it('идемпотентность: повтор запроса не бросает монету второй раз', () => {
    _setTvtRngForTests(() => 0.3)
    const first = flipTvt('ice', 1000, 'req-same')
    const second = flipTvt('ice', 1000, 'req-same')
    expect(second).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_960)
    expect(usePvpMatchesStore.getState().entries).toHaveLength(1)
  })

  it('5.4: при открытом раунде Джекпота бросок блокируется; тираж разблокирует', () => {
    startJackpotRound(1000, 'req-j1')
    expect(flipTvt('ice', 1000, 'req-1')).toEqual({
      status: 'rejected',
      reason: 'round_in_progress',
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(usePvpMatchesStore.getState().entries).toHaveLength(0)

    _setJackpotRngForTests(() => 0.98)
    drawJackpot('req-j2')
    _setTvtRngForTests(() => 0.3)
    expect(flipTvt('ice', 1000, 'req-2').status).toBe('ok')
    // 100000 − 1000 (джекпот) − 1000 (ставка) + 1960 (выплата ×1.96)
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_960)
  })
})
