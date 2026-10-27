import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetJackpotForTests,
  _setJackpotRngForTests,
  addJackpotStake,
  drawJackpot,
  startJackpotRound,
} from './demoJackpotService'
import { _resetTvtForTests, flipTvt } from './demoTvtService'
import { useWalletStore } from '../store/wallet'
import { usePvpRoundsStore } from '../store/pvpRounds'
import { usePvpMatchesStore } from '../store/pvpMatches'

beforeEach(() => {
  _resetJackpotForTests()
  _resetTvtForTests()
  _setJackpotRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  usePvpMatchesStore.setState({ entries: [] })
})

describe('demoJackpotService (5.2: банк, доля, тираж)', () => {
  it('старт: дебет вклада, казино добивает 9×, шанс 980 из 10000', () => {
    const result = startJackpotRound(1000, 'req-1')
    expect(result).toEqual({
      status: 'ok',
      stakedMinor: 1000,
      poolMinor: 10_000,
      chanceTickets: 980,
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(usePvpRoundsStore.getState().jackpot).toMatchObject({
      baseStakeMinor: 1000,
      stakedMinor: 1000,
      houseMinor: 9000,
      poolMinor: 10_000,
      chanceTickets: 980,
      shareParts: 1000,
      finished: false,
      result: null,
    })
  })

  it('докидывание: доля и шанс растут, банк пересчитывается', () => {
    startJackpotRound(1000, 'req-1')
    const result = addJackpotStake(1000, 'req-2')
    expect(result).toEqual({
      status: 'ok',
      stakedMinor: 2000,
      poolMinor: 11_000,
      chanceTickets: 1781, // floor(9800·2000/11000)
      shareParts: 1818, // floor(10000·2000/11000)
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(98_000)
    expect(usePvpRoundsStore.getState().jackpot).toMatchObject({
      stakedMinor: 2000,
      poolMinor: 11_000,
    })
  })

  it('тираж — выигрыш: билет в доле, выплата = весь банк', () => {
    startJackpotRound(1000, 'req-1')
    addJackpotStake(1000, 'req-2')
    _setJackpotRngForTests(() => 0.05) // билет 500 < 1781 — выигрыш
    const result = drawJackpot('req-3')
    expect(result).toMatchObject({
      status: 'ok',
      roll: 500,
      won: true,
      payoutMinor: 11_000,
      poolMinor: 11_000,
    })
    // 100000 − 1000 − 1000 + 11000
    expect(useWalletStore.getState().getBalance('demo')).toBe(109_000)
    expect(usePvpRoundsStore.getState().jackpot).toMatchObject({
      finished: true,
      result: { roll: 500, won: true, payoutMinor: 11_000 },
    })
    expect(usePvpMatchesStore.getState().entries[0]).toMatchObject({
      mode: 'jackpot',
      stakeMinor: 2000,
      outcome: 'won',
      deltaMinor: 9000,
    })
  })

  it('тираж — проигрыш: билет мимо доли, банк забирает казино', () => {
    startJackpotRound(1000, 'req-1')
    _setJackpotRngForTests(() => 0.98) // билет 9800 ≥ 980
    const result = drawJackpot('req-2')
    expect(result).toMatchObject({ status: 'ok', roll: 9800, won: false, payoutMinor: 0 })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(usePvpMatchesStore.getState().entries[0]).toMatchObject({
      mode: 'jackpot',
      outcome: 'lost',
      deltaMinor: -1000,
    })
  })

  it('отказы: без раунда, после конца, повторный старт, суммы и баланс', () => {
    expect(addJackpotStake(1000, 'req-a')).toEqual({ status: 'rejected', reason: 'no_round' })
    expect(drawJackpot('req-b')).toEqual({ status: 'rejected', reason: 'no_round' })

    expect(startJackpotRound(0, 'req-c')).toEqual({ status: 'rejected', reason: 'invalid_amount' })
    expect(startJackpotRound(100_001, 'req-d')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })

    startJackpotRound(1000, 'req-1')
    expect(startJackpotRound(1000, 'req-e')).toEqual({
      status: 'rejected',
      reason: 'round_in_progress',
    })
    expect(addJackpotStake(0, 'req-f')).toEqual({ status: 'rejected', reason: 'invalid_amount' })
    expect(addJackpotStake(100_001, 'req-g')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })

    _setJackpotRngForTests(() => 0.98)
    drawJackpot('req-2')
    expect(drawJackpot('req-h')).toEqual({ status: 'rejected', reason: 'round_finished' })
    expect(addJackpotStake(1000, 'req-i')).toEqual({
      status: 'rejected',
      reason: 'round_finished',
    })

    // Ни один отказ не изменил баланс сверх стартового раунда (−1000):
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(usePvpMatchesStore.getState().entries).toHaveLength(1)
  })

  it('старт после завершённого раунда открывает новый (результат заменяется)', () => {
    startJackpotRound(1000, 'req-1')
    _setJackpotRngForTests(() => 0.98)
    drawJackpot('req-2')
    const result = startJackpotRound(500, 'req-3')
    expect(result).toMatchObject({ status: 'ok', poolMinor: 5000, chanceTickets: 980 })
    expect(usePvpRoundsStore.getState().jackpot).toMatchObject({
      baseStakeMinor: 500,
      stakedMinor: 500,
      finished: false,
      result: null,
    })
  })

  it('5.4: открытый раунд Джекпота блокирует TVT, после тиража — доступен', () => {
    startJackpotRound(1000, 'req-1')
    expect(flipTvt('ice', 1000, 'req-2')).toEqual({
      status: 'rejected',
      reason: 'round_in_progress',
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)

    _setJackpotRngForTests(() => 0.98)
    drawJackpot('req-3')
    expect(flipTvt('ice', 1000, 'req-4').status).toBe('ok')
  })

  it('идемпотентность: повтор тех же операций не меняет ничего', () => {
    const first = startJackpotRound(1000, 'req-same')
    expect(startJackpotRound(1000, 'req-same')).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)

    const addFirst = addJackpotStake(500, 'req-add-same')
    expect(addJackpotStake(500, 'req-add-same')).toEqual(addFirst)
    expect(useWalletStore.getState().getBalance('demo')).toBe(98_500)

    _setJackpotRngForTests(() => 0.05)
    const drawFirst = drawJackpot('req-draw-same')
    expect(drawJackpot('req-draw-same')).toEqual(drawFirst)
    // s = 1500, h = 9000 → банк 10500; билет 500 < floor(9800·1500/10500)=1400 → выигрыш
    expect(useWalletStore.getState().getBalance('demo')).toBe(109_000)
    expect(usePvpMatchesStore.getState().entries).toHaveLength(1)
  })
})
