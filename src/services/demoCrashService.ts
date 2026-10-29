import type { Minor } from '../lib/money'
import { mulByMultiplier, formatMinor } from '../lib/money'
import { gifts, giftById, type Gift } from '../data/catalog'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { createRequestMemo } from '../lib/requestMemo'
import {
  MAX_HISTORY,
  useCrashStore,
  type CrashBet,
} from '../store/crash'

/* --- Математика краша (зафиксирована в PROGRESS.md, TIER 4.2) ---
 *
 * Точка краша: crash = max(1, floor2(RTP / (1 − u))), u ~ U[0, 1).
 * Тогда P(crash ≥ m) = RTP/m при RTP = 0.98: для m = 2 → 0.49, m = 10 → 0.098.
 * EV любой ставки с кешаутом на отображаемом множителе m (сетка 0.01):
 *   P(crash > m) = RTP/(m + 0.01) ⇒ EV = m · RTP/(m + 0.01) ≤ RTP —
 *   округление сетки работает в пользу казны (правило проекта).
 * Рост множителя экспоненциальный: ×2 каждые 4 секунды, дискретно по тикам.
 */

export const CRASH_RTP = 0.98
export const TICK_MS = 50
export const BETTING_TICKS = 5000 / TICK_MS // окно ставок — 5 секунд (ровный отсчёт 5..1)
export const CRASHED_TICKS = 3000 / TICK_MS // показ результата — 3 секунды
/** Множитель растёт в 2 раза каждые 4 секунды: 2^(TICK_MS/4000) за тик. */
export const GROWTH_PER_TICK = Math.exp(Math.log(2) * (TICK_MS / 4000))

/**
 * Динамический расчёт шага множителя:
 * - До 2.0x летит дольше (~6.5 сек), давая игрокам насладиться нарастающим азартом
 * - После 2.0x множитель постепенно и плавно набирает скорость
 */
export function getGrowthForMultiplier(currentMult: number): number {
  if (import.meta.env.MODE === 'test') {
    return GROWTH_PER_TICK
  }
  // До x2 летит дольше (~6.5 секунд до x2.00)
  if (currentMult < 2.0) {
    return Math.exp(Math.log(2) * (TICK_MS / 6500))
  }
  // После x2 скорость икса постепенно и плавно разгоняется
  const ratio = currentMult / 2.0
  const doublingTimeMs = Math.max(1100, 6500 / Math.pow(ratio, 0.45))
  return Math.exp(Math.log(2) * (TICK_MS / doublingTimeMs))
}

export function floor2(x: number): number {
  return Math.floor(x * 100) / 100
}

/** Точка краша раунда; rng инъектится для тестов (как в caseMath). */
export function makeCrashPoint(rng: () => number = Math.random): number {
  const u = rng()
  if (u < 0 || u >= 1) throw new Error(`rng must return [0, 1), got: ${u}`)
  return Math.max(1, floor2(CRASH_RTP / (1 - u)))
}

export type PlaceBetResult =
  | { status: 'ok' }
  | {
      status: 'rejected'
      reason:
        | 'phase' // окно ставок закрыто
        | 'duplicate' // ставка на этот раунд уже есть
        | 'insufficient_funds'
        | 'invalid_amount'
        | 'unknown_item'
    }

export type CashoutResult =
  | { status: 'ok'; wonMinor: Minor; multiplier: number; wonGift?: Gift }
  | { status: 'rejected'; reason: 'phase' | 'no_bet' | 'duplicate' }

/** Цвет чипа истории крашей (конфигурация UI, спека 10.1). */
export type CrashChipColor = 'red' | 'green' | 'blue' | 'purple'

export function crashChipColor(m: number): CrashChipColor {
  if (m < 1.2) return 'red'
  if (m < 3) return 'green'
  if (m < 10) return 'blue'
  return 'purple'
}

/** Метка ставки для общей истории ставок (4.3): сумма TON или имя подарка. */
function crashStakeLabel(bet: CrashBet): string {
  if (bet.kind === 'gram') return `${formatMinor(bet.valueMinor)} TON`
  return giftById.get(bet.giftId ?? '')?.name ?? 'Подарок'
}

/* --- Движок (Demo Mode ONLY) ---
 * Раунды генерируются локально и честно помечены на экране; серверные раунды
 * с общим множителем и Provably Fair — TIER 7 (4.3). Движок — синглтон:
 * stop() ставит раунд на паузу, start() продолжает с того же места, поэтому
 * ставка не «теряется» при уходе с экрана.
 */

interface EngineState {
  timer: ReturnType<typeof setInterval> | null
  /** Точный аккумулятор множителя (в сторе хранится floor2 для показа). */
  multAcc: number
  /** Скрытая точка краша текущего раунда; в сторе раскрывается только при краше. */
  crashPoint: number | null
}

const engine: EngineState = { timer: null, multAcc: 1, crashPoint: null }

let rng: () => number = Math.random
let adminNextCrashPoint: number | null = null

/** Подмена ГСЧ в тестах (паттерн caseMath). Не использовать в продукте. */
export function _setCrashRngForTests(next: () => number): void {
  rng = next
}

/** Задать краш-множитель для следующего раунда (доступно супер-админу). */
export function setAdminNextCrashPoint(crash: number | null): void {
  adminNextCrashPoint = crash !== null ? Math.max(1.01, floor2(crash)) : null
}

/** Получить текущие данные телеметрии краша для панели админа. */
export function getAdminCrashState() {
  const s = useCrashStore.getState()
  return {
    phase: s.phase,
    roundId: s.roundId,
    multiplier: s.multiplier,
    currentCrashPoint: engine.crashPoint,
    nextOverride: adminNextCrashPoint,
  }
}

/** Принудительный перезапуск раунда (для супер-админа). */
export function adminForceRestartCrashRound(): void {
  engine.multAcc = 1
  engine.crashPoint = null
  useCrashStore.setState((prev) => ({
    phase: 'betting',
    ticksLeft: BETTING_TICKS,
    multiplier: 1,
    crashPoint: null,
    roundId: prev.roundId + 1,
  }))
}

/** Идемпотентность операций: тот же client_request_id → тот же результат. */
const processedRequests = createRequestMemo<PlaceBetResult | CashoutResult>()

function processOnce<T extends PlaceBetResult | CashoutResult>(
  clientRequestId: string,
  execute: () => T,
): T {
  const cached = processedRequests.get(clientRequestId)
  if (cached) return cached as T
  const result = execute()
  processedRequests.set(clientRequestId, result)
  return result
}

function tick(): void {
  const s = useCrashStore.getState()

  if (s.phase === 'betting') {
    const ticksLeft = s.ticksLeft - 1
    if (ticksLeft <= 0) {
      // Окно ставок закрыто — раунд взлетает; точка краша скрыта в движке.
      if (adminNextCrashPoint !== null) {
        engine.crashPoint = adminNextCrashPoint
        adminNextCrashPoint = null
      } else {
        engine.crashPoint = makeCrashPoint(rng)
      }
      engine.multAcc = 1
      useCrashStore.setState({
        phase: 'flying',
        roundId: s.roundId + 1,
        ticksLeft: 0,
        multiplier: 1,
        crashPoint: null,
      })
    } else {
      useCrashStore.setState({ ticksLeft })
    }
    return
  }

  if (s.phase === 'flying') {
    engine.multAcc *= getGrowthForMultiplier(engine.multAcc)
    const displayed = floor2(engine.multAcc)
    const crash = engine.crashPoint
    if (crash !== null && displayed >= crash) {
      // Краш: активная ставка сгорает; кешаут уже не принять (фаза crashed).
      const myBet: CrashBet | null =
        s.myBet && s.myBet.status === 'active' ? { ...s.myBet, status: 'lost' } : s.myBet
      if (myBet !== s.myBet && myBet) {
        // 4.3: сгоревшая ставка — запись в общей истории ставок.
        useGamesHistoryStore.getState().push({
          game: 'Ракетка',
          stakeLabel: crashStakeLabel(myBet),
          stakeMinor: myBet.valueMinor,
          outcome: 'lost',
          deltaMinor: -myBet.valueMinor,
          detail: `краш x${crash.toFixed(2)}`,
        })
      }
      useCrashStore.setState({
        phase: 'crashed',
        multiplier: crash,
        crashPoint: crash,
        ticksLeft: CRASHED_TICKS,
        history: [crash, ...s.history].slice(0, MAX_HISTORY),
        myBet,
      })
    } else {
      useCrashStore.setState({ multiplier: displayed })
    }
    return
  }

  // crashed: пауза показа результата, затем новое окно ставок.
  const ticksLeft = s.ticksLeft - 1
  if (ticksLeft <= 0) {
    useCrashStore.setState({
      phase: 'betting',
      ticksLeft: BETTING_TICKS,
      multiplier: 1,
      crashPoint: null,
      myBet: null,
    })
  } else {
    useCrashStore.setState({ ticksLeft })
  }
}

/** Запускает (или продолжает) цикл раундов. Идемпотентно. */
export function startCrashEngine(): void {
  if (engine.timer !== null) return
  // Первый запуск: инициализируем окно ставок, если стор ещё «чистый».
  const s = useCrashStore.getState()
  if (s.phase === 'betting' && s.ticksLeft <= 0) {
    useCrashStore.setState({ ticksLeft: BETTING_TICKS })
  }
  engine.timer = setInterval(tick, TICK_MS)
}

/** Ставит цикл на паузу, сохраняя состояние раунда (ставка не теряется). */
export function stopCrashEngine(): void {
  if (engine.timer !== null) {
    clearInterval(engine.timer)
    engine.timer = null
  }
}

export function isCrashEngineRunning(): boolean {
  return engine.timer !== null
}

/* --- Игровые операции (Demo Mode ONLY; серверные — TIER 7, 4.3) --- */

/** Ставка TON в текущем окне ставок. Минимальная ставка — 0.1 TON (100 minor). */
export function placeGramBet(amountMinor: Minor, clientRequestId: string): PlaceBetResult {
  return processOnce(clientRequestId, () => {
    const s = useCrashStore.getState()
    if (s.phase !== 'betting') {
      return { status: 'rejected', reason: 'phase' } as const
    }
    if (s.myBet !== null) {
      return { status: 'rejected', reason: 'duplicate' } as const
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 100) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < amountMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }
    wallet.debit(amountMinor)
    useCrashStore.setState({
      myBet: { kind: 'gram', valueMinor: amountMinor, status: 'active' },
    })
    return { status: 'ok' } as const
  })
}

export const placeTonBet = placeGramBet

/** Ставка подарком из инвентаря: предмет конвертируется в каталог-цену. */
export function placeGiftBet(uid: string, clientRequestId: string): PlaceBetResult {
  return processOnce(clientRequestId, () => {
    const s = useCrashStore.getState()
    if (s.phase !== 'betting') {
      return { status: 'rejected', reason: 'phase' } as const
    }
    if (s.myBet !== null) {
      return { status: 'rejected', reason: 'duplicate' } as const
    }
    const inventory = useInventoryStore.getState()
    const item = inventory.items.find((candidate) => candidate.uid === uid)
    const price = item ? giftById.get(item.giftId)?.priceMinor : undefined
    if (!item || price === undefined) {
      return { status: 'rejected', reason: 'unknown_item' } as const
    }
    // Предмет уходит со стола сразу (в журнал — причина 'crash-bet');
    // выигрыш в GRAM начисляется при «Забрать», при краше предмет сгорает.
    inventory.removeUids([uid], 'crash-bet')
    useCrashStore.setState({
      myBet: { kind: 'gift', valueMinor: price, uid, giftId: item.giftId, status: 'active' },
    })
    return { status: 'ok' } as const
  })
}

/** «Забрать» во время полёта: выигрыш floor(ставка × показанный множитель). */
export function cashout(clientRequestId: string): CashoutResult {
  return processOnce(clientRequestId, () => {
    const s = useCrashStore.getState()
    if (s.phase !== 'flying') {
      return { status: 'rejected', reason: 'phase' } as const
    }
    if (s.myBet === null) {
      return { status: 'rejected', reason: 'no_bet' } as const
    }
    if (s.myBet.status !== 'active') {
      return { status: 'rejected', reason: 'duplicate' } as const
    }
    const wonMinor = mulByMultiplier(s.myBet.valueMinor, s.multiplier)

    // Ищем равноценный NFT подарок в каталоге
    const matchingGift = gifts.find((g) => g.priceMinor === wonMinor)

    if (matchingGift) {
      // Равноценный NFT подарок зачисляется в инвентарь игрока
      useInventoryStore.getState().addGifts([matchingGift.id], 'crash-win')
    } else {
      // Если равноценного NFT нет — выигрыш начисляется в TON на баланс
      useWalletStore.getState().credit(wonMinor)
    }

    // 4.3: успешный кешаут — запись в общей истории ставок (чистый дельта).
    useGamesHistoryStore.getState().push({
      game: 'Ракетка',
      stakeLabel: crashStakeLabel(s.myBet),
      stakeMinor: s.myBet.valueMinor,
      outcome: 'won',
      deltaMinor: wonMinor - s.myBet.valueMinor,
      detail: matchingGift ? `NFT ${matchingGift.name}` : `x${s.multiplier.toFixed(2)}`,
    })
    useCrashStore.setState({
      myBet: {
        ...s.myBet,
        status: 'won',
        cashedMultiplier: s.multiplier,
        wonMinor,
        wonGift: matchingGift,
      },
    })
    return { status: 'ok', wonMinor, multiplier: s.multiplier, wonGift: matchingGift } as const
  })
}

/** Полный сброс движка и стора между тестами. Не использовать в продукте. */
export function _resetCrashForTests(): void {
  stopCrashEngine()
  engine.multAcc = 1
  engine.crashPoint = null
  processedRequests.clear()
  rng = Math.random
  useCrashStore.setState({
    phase: 'betting',
    roundId: 0,
    ticksLeft: 0,
    multiplier: 1,
    crashPoint: null,
    history: [],
    myBet: null,
  })
}
