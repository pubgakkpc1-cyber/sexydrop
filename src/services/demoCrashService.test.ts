import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetCrashForTests,
  _setCrashRngForTests,
  BETTING_TICKS,
  cashout,
  crashChipColor,
  CRASHED_TICKS,
  makeCrashPoint,
  placeGiftBet,
  placeGramBet,
  startCrashEngine,
  stopCrashEngine,
  TICK_MS,
} from './demoCrashService'
import { useCrashStore } from '../store/crash'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

const resetAll = () => {
  _resetCrashForTests()
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useGamesHistoryStore.setState({ entries: [] })
}

beforeEach(resetAll)

afterEach(() => {
  vi.useRealTimers()
})

describe('makeCrashPoint (математика краша, RTP 0.98)', () => {
  it('rng = 0.51 даёт краш ровно x2.00 (граница сетки)', () => {
    expect(makeCrashPoint(() => 0.51)).toBe(2)
  })

  it('rng = 0 даёт минимальный краш x1.00 — floor в пользу казны', () => {
    expect(makeCrashPoint(() => 0)).toBe(1)
  })

  it('floor2 держит сетку 0.01: rng = 0.5 → x1.96', () => {
    expect(makeCrashPoint(() => 0.5)).toBe(1.96)
  })

  it('rng вне [0, 1) — ошибка контракта', () => {
    expect(() => makeCrashPoint(() => 1)).toThrow()
  })

  it('статистика: P(crash ≥ 2) ≈ 0.49 и P(crash ≥ 10) ≈ 0.098 (100k, RTP/m)', () => {
    const N = 100_000
    let ge2 = 0
    let ge10 = 0
    for (let i = 0; i < N; i += 1) {
      const point = makeCrashPoint()
      if (point >= 2) ge2 += 1
      if (point >= 10) ge10 += 1
    }
    expect(Math.abs(ge2 / N - 0.49)).toBeLessThan(0.005)
    expect(Math.abs(ge10 / N - 0.098)).toBeLessThan(0.003)
  })
})

describe('crashChipColor (конфигурация чипов истории)', () => {
  it('<1.2 red, <3 green, <10 blue, ≥10 purple', () => {
    expect(crashChipColor(1)).toBe('red')
    expect(crashChipColor(1.19)).toBe('red')
    expect(crashChipColor(1.2)).toBe('green')
    expect(crashChipColor(2.99)).toBe('green')
    expect(crashChipColor(3)).toBe('blue')
    expect(crashChipColor(9.99)).toBe('blue')
    expect(crashChipColor(10)).toBe('purple')
    expect(crashChipColor(97.99)).toBe('purple')
  })
})

describe('движок раундов (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('фазы: betting → flying → crashed → новое окно ставок', () => {
    _setCrashRngForTests(() => 0.51) // краш x2.00
    startCrashEngine()

    const s0 = useCrashStore.getState()
    expect(s0.phase).toBe('betting')
    expect(s0.ticksLeft).toBe(BETTING_TICKS)

    vi.advanceTimersByTime(3000)
    expect(useCrashStore.getState().phase).toBe('betting')

    vi.advanceTimersByTime(2000) // 5000 мс — окно ставок закрыто
    expect(useCrashStore.getState().phase).toBe('flying')
    expect(useCrashStore.getState().roundId).toBe(1)

    vi.advanceTimersByTime(4200) // рост ×2 каждые 4с → 2^(84/80) > 2 → краш
    const s = useCrashStore.getState()
    expect(s.phase).toBe('crashed')
    expect(s.multiplier).toBe(2)
    expect(s.crashPoint).toBe(2)
    expect(s.history).toEqual([2])
    expect(s.ticksLeft).toBeGreaterThan(0)

    vi.advanceTimersByTime(CRASHED_TICKS * 50)
    const next = useCrashStore.getState()
    expect(next.phase).toBe('betting')
    // Точный момент краша зависит от накопления FP в GROWTH_PER_TICK — проверяем,
    // что окно ставок началось и идёт, а не ровный отсчёт 120.
    expect(next.ticksLeft).toBeGreaterThan(0)
    expect(next.ticksLeft).toBeLessThanOrEqual(BETTING_TICKS)
    expect(next.multiplier).toBe(1)
  })

  it('история крашей ограничена MAX_HISTORY (12) — свежие в начале', () => {
    _setCrashRngForTests(() => 0.6)
    const expectedCrash = makeCrashPoint(() => 0.6)
    startCrashEngine()
    // 13 полных раундов (~15с каждый) — истории должно остаться ровно 12
    vi.advanceTimersByTime(13 * 15_000)
    const s = useCrashStore.getState()
    expect(s.history).toHaveLength(12)
    expect(s.history.every((m) => m === expectedCrash)).toBe(true)
  })

  it('stop/start продолжает раунд без сброса — ставка не теряется', () => {
    _setCrashRngForTests(() => 0.51)
    startCrashEngine()
    expect(placeGramBet(1000, 'req-pause')).toEqual({ status: 'ok' })
    vi.advanceTimersByTime(3000)
    const atPause = useCrashStore.getState()
    expect(atPause.ticksLeft).toBe(BETTING_TICKS - 60)

    stopCrashEngine()
    vi.advanceTimersByTime(50_000) // время идёт, движок на паузе
    expect(useCrashStore.getState().ticksLeft).toBe(atPause.ticksLeft)
    expect(useCrashStore.getState().myBet?.status).toBe('active')

    startCrashEngine()
    vi.advanceTimersByTime(3000) // оставшиеся 3с окна
    expect(useCrashStore.getState().phase).toBe('flying')
  })
})

describe('placeGramBet / cashout (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('ставка списывает баланс и появляется в раунде', () => {
    startCrashEngine()
    expect(placeGramBet(1000, 'req-bet')).toEqual({ status: 'ok' })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(useCrashStore.getState().myBet).toEqual({
      kind: 'gram',
      valueMinor: 1000,
      status: 'active',
    })
  })

  it('идемпотентность: повтор того же requestId не списывает дважды', () => {
    startCrashEngine()
    expect(placeGramBet(1000, 'req-dup')).toEqual({ status: 'ok' })
    expect(placeGramBet(1000, 'req-dup')).toEqual({ status: 'ok' })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
  })

  it('вторая ставка на раунд отклоняется (duplicate), баланс не тронут', () => {
    startCrashEngine()
    expect(placeGramBet(1000, 'req-1')).toEqual({ status: 'ok' })
    expect(placeGramBet(1000, 'req-2')).toEqual({ status: 'rejected', reason: 'duplicate' })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
  })

  it('ставка вне окна ставок отклоняется', () => {
    _setCrashRngForTests(() => 0.51)
    startCrashEngine()
    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS)
    expect(useCrashStore.getState().phase).toBe('flying')
    expect(placeGramBet(1000, 'req-late')).toEqual({ status: 'rejected', reason: 'phase' })
    expect(useCrashStore.getState().myBet).toBeNull()
  })

  it('нехватка средств: отклоняется, баланс цел', () => {
    startCrashEngine()
    expect(placeGramBet(100_001, 'req-poor')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
    expect(useCrashStore.getState().myBet).toBeNull()
  })

  it('невалидные суммы: 0, отрицательные и дробные — отклоняются', () => {
    startCrashEngine()
    expect(placeGramBet(0, 'req-0')).toEqual({ status: 'rejected', reason: 'invalid_amount' })
    expect(placeGramBet(-5, 'req-neg')).toEqual({ status: 'rejected', reason: 'invalid_amount' })
    expect(placeGramBet(1.5, 'req-frac')).toEqual({ status: 'rejected', reason: 'invalid_amount' })
    expect(useCrashStore.getState().myBet).toBeNull()
  })

  it('кешаут: floor(1000 × 1.41) = 1410, идемпотентно, повтор — duplicate', () => {
    _setCrashRngForTests(() => 0.51) // краш x2.00 — позже кешаута
    startCrashEngine()
    expect(placeGramBet(1000, 'req-bet')).toEqual({ status: 'ok' })

    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS) // полёт
    expect(useCrashStore.getState().phase).toBe('flying')
    vi.advanceTimersByTime(2000) // 40 тиков роста: 2^0.5 ≈ 1.4142 → показ 1.41
    expect(useCrashStore.getState().multiplier).toBe(1.41)

    const first = cashout('req-cash')
    expect(first).toEqual({ status: 'ok', wonMinor: 1410, multiplier: 1.41 })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_410)
    expect(useCrashStore.getState().myBet).toMatchObject({
      status: 'won',
      wonMinor: 1410,
      cashedMultiplier: 1.41,
    })

    // идемпотентно: тот же requestId не начисляет дважды
    expect(cashout('req-cash')).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_410)
    // новая попытка кешаута после выигрыша — duplicate
    expect(cashout('req-cash-2')).toEqual({ status: 'rejected', reason: 'duplicate' })
  })

  it('авто вывод: ставка забирается сама ровно на множителе цели (x1.2 → floor(1000 × 1.2) = 1200)', () => {
    _setCrashRngForTests(() => 0.51) // краш x2.00 — позже цели
    startCrashEngine()
    expect(placeGramBet(1000, 'req-auto', 1.2)).toEqual({ status: 'ok' })

    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 4000)
    const bet = useCrashStore.getState().myBet
    expect(bet).toMatchObject({ status: 'won', cashedMultiplier: 1.2, wonMinor: 1200 })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_200)
  })

  it('авто вывод выше точки краша не срабатывает: ставка сгорает', () => {
    _setCrashRngForTests(() => 0.51) // краш x2.00
    startCrashEngine()
    placeGramBet(1000, 'req-auto-high', 5)
    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 6000)
    expect(useCrashStore.getState().phase).toBe('crashed')
    expect(useCrashStore.getState().myBet?.status).toBe('lost')
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
  })

  it('кешаут без ставки и вне полёта отклоняется', () => {
    _setCrashRngForTests(() => 0.51)
    startCrashEngine()
    expect(cashout('req-x')).toEqual({ status: 'rejected', reason: 'phase' })

    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS) // полёт без ставки
    expect(useCrashStore.getState().phase).toBe('flying')
    expect(cashout('req-y')).toEqual({ status: 'rejected', reason: 'no_bet' })
  })

  it('краш сжигает активную ставку (в т.ч. подарком), баланс не трогается', () => {
    _setCrashRngForTests(() => 0.51)
    startCrashEngine()
    expect(placeGramBet(1000, 'req-bet')).toEqual({ status: 'ok' })

    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 4200) // до краша x2.00
    const s = useCrashStore.getState()
    expect(s.phase).toBe('crashed')
    expect(s.myBet).toMatchObject({ status: 'lost', valueMinor: 1000 })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000) // ставка сгорела
  })

  it('ставка подарком: предмет уходит по каталог-цене, при краше сгорает', () => {
    _setCrashRngForTests(() => 0.51)
    startCrashEngine()
    const [item] = useInventoryStore.getState().addGifts(['plush-pepe'], 'case-open')
    if (!item) throw new Error('inventory did not accept the gift')

    expect(placeGiftBet(item.uid, 'req-gift')).toEqual({ status: 'ok' })
    expect(useInventoryStore.getState().items).toHaveLength(0)
    // журнал: предмет ушёл как ставка (причина 'crash-bet', 3.5)
    expect(useInventoryStore.getState().history[0]).toMatchObject({
      type: 'remove',
      uid: item.uid,
      giftId: 'plush-pepe',
      detail: 'crash-bet',
    })
    expect(useCrashStore.getState().myBet).toEqual({
      kind: 'gift',
      valueMinor: 25_000, // каталог-цена Plush Pepe
      uid: item.uid,
      giftId: 'plush-pepe',
      status: 'active',
    })

    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 4200)
    const s = useCrashStore.getState()
    expect(s.phase).toBe('crashed')
    expect(s.myBet).toMatchObject({ status: 'lost' })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
  })

  it('ставка подарком выигрывает в GRAM: floor(25000 × 1.41) = 35250', () => {
    _setCrashRngForTests(() => 0.99) // краш далеко (≈x98) — не мешает кешауту
    startCrashEngine()
    const [item] = useInventoryStore.getState().addGifts(['plush-pepe'], 'case-open')
    if (!item) throw new Error('inventory did not accept the gift')
    expect(placeGiftBet(item.uid, 'req-gift')).toEqual({ status: 'ok' })

    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 2000)
    expect(useCrashStore.getState().multiplier).toBe(1.41)

    expect(cashout('req-cash')).toEqual({ status: 'ok', wonMinor: 35_250, multiplier: 1.41 })
    expect(useWalletStore.getState().getBalance('demo')).toBe(135_250)
  })

  it('победа с равноценной суммой начисляет NFT в инвентарь (если есть), иначе TON', () => {
    _setCrashRngForTests(() => 0.99)
    startCrashEngine()
    // Ставка 1000 minor (1 TON)
    expect(placeGramBet(1000, 'req-bet-nft')).toEqual({ status: 'ok' })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)

    // 2000мс полёта дают множитель 1.41
    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 2000)
    expect(useCrashStore.getState().multiplier).toBe(1.41)

    // 1410 minor не совпадает ни с одним NFT -> выигрыш в TON
    const resTon = cashout('req-cash-ton')
    expect(resTon.status).toBe('ok')
    if (resTon.status === 'ok') {
      expect(resTon.wonGift).toBeUndefined()
      expect(resTon.wonMinor).toBe(1410)
    }
    // Зачислен чистый TON
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_410)
  })

  it('ставка неизвестным предметом отклоняется', () => {
    startCrashEngine()
    expect(placeGiftBet('no-such-uid', 'req-ghost')).toEqual({
      status: 'rejected',
      reason: 'unknown_item',
    })
    expect(useCrashStore.getState().myBet).toBeNull()
  })

  it('ставка в crashed-фазе нового раунда невозможна, окно ставок сбрасывает myBet', () => {
    _setCrashRngForTests(() => 0.51)
    startCrashEngine()
    expect(placeGramBet(1000, 'req-1')).toEqual({ status: 'ok' })
    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 4200 + 3000) // до следующего окна ставок
    const s = useCrashStore.getState()
    expect(s.phase).toBe('betting')
    expect(s.myBet).toBeNull() // ставка прошлого раунда не переносится
    expect(placeGramBet(1000, 'req-2')).toEqual({ status: 'ok' }) // новая ставка принимается
  })
})

describe('история ставок (4.3: записи в useGamesHistoryStore)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  })

  it('успешный кешаут пишет won-запись с чистой дельтой', () => {
    _setCrashRngForTests(() => 0.51)
    startCrashEngine()
    expect(placeGramBet(1000, 'req-1')).toEqual({ status: 'ok' })
    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 2000) // 40 тиков → показ 1.41
    expect(cashout('req-cash')).toEqual({ status: 'ok', wonMinor: 1410, multiplier: 1.41 })

    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({
      game: 'Ракетка',
      stakeLabel: '1 TON',
      outcome: 'won',
      deltaMinor: 410,
      detail: 'x1.41',
    })
  })

  it('краш сжигает ставку — lost-запись с деталью краша', () => {
    _setCrashRngForTests(() => 0.51)
    startCrashEngine()
    expect(placeGramBet(1000, 'req-1')).toEqual({ status: 'ok' })
    vi.advanceTimersByTime(BETTING_TICKS * TICK_MS + 4200) // краш x2.00

    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({
      game: 'Ракетка',
      outcome: 'lost',
      deltaMinor: -1000,
      detail: 'краш x2.00',
    })
  })
})
