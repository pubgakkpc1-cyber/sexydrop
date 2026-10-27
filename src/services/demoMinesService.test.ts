import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetMinesForTests,
  _setMinesRngForTests,
  cashoutMines,
  minesOpenedCount,
  pickMines,
  startMines,
} from './demoMinesService'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

beforeEach(() => {
  _resetMinesForTests()
  _setMinesRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useGamesHistoryStore.setState({ entries: [] })
})

describe('demoMinesService (4.8: раскладка на «сервере», забор, автосбор)', () => {
  it('старт: дебет ставки, раскладка не раскрывается, раунд активен', () => {
    const result = startMines(1000, 3, 'req-1')
    expect(result).toEqual({ status: 'ok', minesCount: 3, betMinor: 1000 })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(minesOpenedCount()).toBe(0)
  })

  it('безопасная клетка: picked растёт, множитель по формуле, без выплаты', () => {
    // rng = 0 → мины [0, 1, 2]; клетка 10 безопасна
    _setMinesRngForTests(() => 0)
    startMines(1000, 3, 'req-1')
    const pick = pickMines(10, 'req-2')
    // m=3, k=1 → m_h = floor(98·25/22) = 111 → x1.11
    expect(pick).toEqual({
      status: 'ok',
      event: 'safe',
      pickedCount: 1,
      multiplierHundredths: 111,
      payoutMinor: 0,
      minePositions: null,
    })
    expect(minesOpenedCount()).toBe(1)
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
  })

  it('мина: раунд закончен, раскладка раскрыта, история с −ставкой', () => {
    _setMinesRngForTests(() => 0) // мины [0, 1, 2]
    startMines(1000, 3, 'req-1')
    const pick = pickMines(0, 'req-2')
    expect(pick.status).toBe('ok')
    if (pick.status === 'ok' && pick.event === 'lost') {
      expect(pick.minePositions).toEqual([0, 1, 2])
      expect(pick.payoutMinor).toBe(0)
    }
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Мины',
      outcome: 'lost',
      deltaMinor: -1000,
      detail: '3 мин · мина на ходу 1',
    })
    // после конца раунда новая клетка — отказ
    expect(pickMines(11, 'req-3')).toEqual({ status: 'rejected', reason: 'round_finished' })
  })

  it('полный сбор: m=24 → единственная безопасная клетка даёт x24.5 автоматически', () => {
    _setMinesRngForTests(() => 0) // мины [0..23], безопасна клетка 24
    startMines(1000, 24, 'req-1')
    const pick = pickMines(24, 'req-2')
    expect(pick.status).toBe('ok')
    if (pick.status === 'ok' && pick.event === 'cleared') {
      expect(pick.multiplierHundredths).toBe(2450)
      expect(pick.payoutMinor).toBe(24_500)
      expect(pick.minePositions).toHaveLength(24)
    }
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 24_500)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Мины',
      outcome: 'won',
      deltaMinor: 23_500,
      detail: '24 мин · полный сбор x24.50',
    })
  })

  it('забор: k=2 → выплата floor(ставка × 1.27), раскладка раскрыта, раунд закрыт', () => {
    _setMinesRngForTests(() => 0) // мины [0, 1, 2]
    startMines(1000, 3, 'req-1')
    expect(pickMines(10, 'req-2').status).toBe('ok')
    expect(pickMines(11, 'req-3').status).toBe('ok')
    const cash = cashoutMines('req-4')
    // m=3, k=2 → m_h = floor(98·300/231) = 127 → floor(1000 × 1.27) = 1270
    expect(cash).toEqual({
      status: 'ok',
      event: 'cashed',
      pickedCount: 2,
      multiplierHundredths: 127,
      payoutMinor: 1270,
      minePositions: [0, 1, 2],
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 1270)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Мины',
      outcome: 'won',
      deltaMinor: 270,
      detail: '3 мин · забрал 2 · x1.27',
    })
    // забор при пустом раунде / повторно — отказы
    expect(cashoutMines('req-5')).toEqual({ status: 'rejected', reason: 'round_finished' })
  })

  it('отказы: сумма, число мин, нехватка средств, активный раунд, клетка', () => {
    expect(startMines(0, 3, 'req-1')).toEqual({ status: 'rejected', reason: 'invalid_amount' })
    expect(startMines(1000, 0, 'req-2')).toEqual({ status: 'rejected', reason: 'invalid_mines' })
    expect(startMines(1000, 25, 'req-3')).toEqual({ status: 'rejected', reason: 'invalid_mines' })
    expect(startMines(100_001, 3, 'req-4')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })
    expect(pickMines(5, 'req-5')).toEqual({ status: 'rejected', reason: 'no_round' })
    expect(cashoutMines('req-6')).toEqual({ status: 'rejected', reason: 'no_round' })
    // активный раунд блокирует новый старт; забор без открытых клеток — отказ
    _setMinesRngForTests(() => 0)
    expect(startMines(1000, 3, 'req-7').status).toBe('ok')
    expect(startMines(1000, 3, 'req-8')).toEqual({
      status: 'rejected',
      reason: 'round_in_progress',
    })
    expect(cashoutMines('req-9')).toEqual({ status: 'rejected', reason: 'nothing_picked' })
    // невалидная и повторная клетка
    expect(pickMines(25, 'req-10')).toEqual({ status: 'rejected', reason: 'invalid_tile' })
    expect(pickMines(10, 'req-11').status).toBe('ok')
    expect(pickMines(10, 'req-12')).toEqual({ status: 'rejected', reason: 'tile_picked' })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(0)
  })

  it('идемпотентность: тот же requestId → тот же ответ без второго действия', () => {
    _setMinesRngForTests(() => 0)
    const first = startMines(1000, 3, 'req-same')
    const second = startMines(1000, 3, 'req-same')
    expect(second).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(pickMines(10, 'pick-same').status).toBe('ok')
    expect(pickMines(10, 'pick-same').status).toBe('ok')
    expect(minesOpenedCount()).toBe(1)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(0)
    expect(cashoutMines('cash-same').status).toBe('ok')
    const balanceAfter = useWalletStore.getState().getBalance('demo')
    expect(cashoutMines('cash-same').status).toBe('ok')
    expect(useWalletStore.getState().getBalance('demo')).toBe(balanceAfter)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(1)
  })
})
