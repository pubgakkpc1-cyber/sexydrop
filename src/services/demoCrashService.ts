import type { Minor } from '../lib/money'
import { mulByMultiplier, formatMinor } from '../lib/money'
import { giftById, type Gift } from '../data/catalog'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { createRequestMemo } from '../lib/requestMemo'
import { MAX_BET_MINOR } from '../lib/gameConfig'
import { recentCrashPoints, roundInfo, scheduleAt, sharedNow, syncClock } from './crashSchedule'
import { SERVER_MODE } from '../lib/serverMode'
import { hydrateFromServer, removeServerItem } from '../lib/serverSync'
import {
  isCrashPolling,
  knownCrashPoints,
  lastServerBet,
  onCrashServerState,
  pollCrashState,
  serverCashout,
  serverPlaceBet,
  serverRecent,
  serverScheduleAt,
  startCrashPolling,
  stopCrashPolling,
} from './crashServer'
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

/**
 * Общие раунды: вне тестов фазы, множитель и точка краша берутся из общего
 * расписания (crashSchedule), поэтому на всех устройствах ракета, боты и скин
 * совпадают в каждый момент. В тестах остаётся локальный детерминированный движок.
 */
const SHARED_ROUNDS = import.meta.env.MODE !== 'test'

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
    currentCrashPoint: SERVER_MODE ? null : SHARED_ROUNDS && s.roundId > 0 ? roundInfo(s.roundId).crashPoint : engine.crashPoint,
    nextOverride: adminNextCrashPoint,
  }
}

/** Принудительный перезапуск раунда (для супер-админа). */
export function adminForceRestartCrashRound(): void {
  // Общие раунды идут по расписанию для всех игроков — локальный перезапуск не нужен.
  if (SHARED_ROUNDS) return
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
      const updatedHistory = [crash, ...s.history].slice(0, MAX_HISTORY)
      try {
        localStorage.setItem('sexydrop_crash_history', JSON.stringify(updatedHistory))
      } catch {}
      useCrashStore.setState({
        phase: 'crashed',
        multiplier: crash,
        crashPoint: crash,
        ticksLeft: CRASHED_TICKS,
        history: updatedHistory,
        myBet,
      })
    } else {
      useCrashStore.setState({ multiplier: displayed })
      maybeAutoCashout()
    }
    return
  }

  // crashed: пауза показа результата, затем новое окно ставок.
  const ticksLeft = s.ticksLeft - 1
  if (ticksLeft <= 0) {
    const queued = s.queuedNextBet
    if (queued) {
      useCrashStore.setState({
        phase: 'betting',
        ticksLeft: BETTING_TICKS,
        multiplier: 1,
        crashPoint: null,
        myBet: {
          kind: queued.kind,
          valueMinor: queued.valueMinor,
          uid: queued.uid,
          giftId: queued.giftId,
          autoCashout: queued.autoCashout,
          status: 'active',
        },
        queuedNextBet: null,
      })
    } else {
      useCrashStore.setState({
        phase: 'betting',
        ticksLeft: BETTING_TICKS,
        multiplier: 1,
        crashPoint: null,
        myBet: null,
        queuedNextBet: null,
      })
    }
  } else {
    useCrashStore.setState({ ticksLeft })
  }
}

/** Ставка сгорела при краше: запись в общей истории ставок. */
function burnActiveBet(bet: CrashBet | null, crash: number): CrashBet | null {
  if (!bet || bet.status !== 'active') return bet
  useGamesHistoryStore.getState().push({
    game: 'Ракетка',
    stakeLabel: crashStakeLabel(bet),
    stakeMinor: bet.valueMinor,
    outcome: 'lost',
    deltaMinor: -bet.valueMinor,
    detail: `краш x${crash.toFixed(2)}`,
  })
  return { ...bet, status: 'lost' }
}

function crashPointOfRound(roundId: number): number {
  if (SERVER_MODE) return knownCrashPoints.get(roundId) ?? useCrashStore.getState().multiplier
  return roundInfo(roundId).crashPoint
}

/** Тик общих раундов: приводит стор к состоянию расписания в текущий момент. */
function syncTick(): void {
  const now = SERVER_MODE ? Date.now() : sharedNow()
  const st = SERVER_MODE ? serverScheduleAt(now) : scheduleAt(now)
  if (st === null) return
  const history = (): number[] => (SERVER_MODE ? serverRecent() : recentCrashPoints(now, MAX_HISTORY))
  const s = useCrashStore.getState()

  if (s.roundId !== st.roundId) {
    // Новый раунд (или первый запуск / вкладка «просыпается»): незавершённая ставка сгорает.
    let myBet = s.myBet
    if (myBet && myBet.status === 'active' && s.roundId > 0) {
      myBet = burnActiveBet(myBet, crashPointOfRound(s.roundId))
    }
    let queued = s.queuedNextBet
    let nextBet: CrashBet | null = null
    if (st.phase === 'betting' && queued) {
      nextBet = {
        kind: queued.kind,
        valueMinor: queued.valueMinor,
        uid: queued.uid,
        giftId: queued.giftId,
        autoCashout: queued.autoCashout,
        status: 'active',
      }
      queued = null
    }
    const queuedBefore = s.queuedNextBet
    useCrashStore.setState({
      roundId: st.roundId,
      phase: st.phase,
      multiplier: st.multiplier,
      crashPoint: st.crashPoint,
      ticksLeft: st.ticksLeft,
      history: history(),
      myBet: nextBet,
      queuedNextBet: queued,
    })
    if (SERVER_MODE && nextBet && queuedBefore) sendServerBet(nextBet, queuedBefore.requestId)
    return
  }

  if (s.phase === 'flying' && st.phase === 'crashed') {
    const myBet = burnActiveBet(s.myBet, st.multiplier)
    useCrashStore.setState({
      phase: 'crashed',
      multiplier: st.multiplier,
      crashPoint: st.crashPoint,
      ticksLeft: st.ticksLeft,
      history: history(),
      myBet,
    })
    return
  }

  if (s.phase === 'betting' && st.phase === 'flying') {
    useCrashStore.setState({ phase: 'flying', multiplier: st.multiplier, ticksLeft: 0, crashPoint: null })
    maybeAutoCashout()
    return
  }

  if (s.phase !== st.phase) {
    // Любой другой пропуск фаз (редко): догоняем расписание
    useCrashStore.setState({
      phase: st.phase,
      multiplier: st.multiplier,
      crashPoint: st.crashPoint,
      ticksLeft: st.ticksLeft,
      myBet: st.phase === 'crashed' ? burnActiveBet(s.myBet, crashPointOfRound(st.roundId)) : s.myBet,
    })
    return
  }

  if (st.phase === 'flying') {
    if (s.multiplier !== st.multiplier) useCrashStore.setState({ multiplier: st.multiplier })
    maybeAutoCashout()
  } else if (s.ticksLeft !== st.ticksLeft) {
    useCrashStore.setState({ ticksLeft: st.ticksLeft })
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
  if (SERVER_MODE) {
    // раунды, точки краша и выплаты — на сервере; здесь только показ по его расписанию
    registerServerListener()
    startCrashPolling()
    syncTick()
    engine.timer = setInterval(syncTick, TICK_MS)
    return
  }
  if (SHARED_ROUNDS) {
    void syncClock()
    syncTick()
    engine.timer = setInterval(syncTick, TICK_MS)
    return
  }
  engine.timer = setInterval(tick, TICK_MS)
}

/** Ставит цикл на паузу, сохраняя состояние раунда (ставка не теряется). */
export function stopCrashEngine(): void {
  if (SERVER_MODE) stopCrashPolling()
  if (engine.timer !== null) {
    clearInterval(engine.timer)
    engine.timer = null
  }
}

export function isCrashEngineRunning(): boolean {
  return engine.timer !== null || isCrashPolling()
}

/** Серверный режим: подтягивает «мою» ставку и итог выплат из ответов сервера. */
let serverListenerRegistered = false
function registerServerListener(): void {
  if (serverListenerRegistered) return
  serverListenerRegistered = true
  onCrashServerState(() => {
    const bet = lastServerBet()
    const s = useCrashStore.getState()
    if (!bet || bet.round_id !== s.roundId) return
    if (!s.myBet) {
      // приложение перезапущено посреди раунда: восстанавливаем ставку с сервера
      useCrashStore.setState({
        myBet: {
          kind: bet.kind,
          valueMinor: bet.value_minor,
          giftId: bet.gift_id ?? undefined,
          status: bet.status,
          autoCashout: bet.auto_cashout ?? undefined,
          cashedMultiplier: bet.cashed_multiplier ?? undefined,
          wonMinor: bet.status === 'won' ? bet.won_minor : undefined,
          wonGift: bet.won_gift_id ? giftById.get(bet.won_gift_id) : undefined,
          settled: bet.status === 'won' ? true : undefined,
        },
      })
      return
    }
    if (bet.status === 'won' && (s.myBet.status !== 'won' || s.myBet.wonMinor !== bet.won_minor)) {
      useCrashStore.setState({
        myBet: {
          ...s.myBet,
          status: 'won',
          cashedMultiplier: bet.cashed_multiplier ?? s.myBet.cashedMultiplier,
          wonMinor: bet.won_minor,
          // авто-вывод сработал на сервере: если выплата равна цене NFT, подарок уже выдан
          wonGift: bet.won_gift_id ? giftById.get(bet.won_gift_id) : undefined,
          settled: true,
        },
      })
      if (bet.won_gift_id) void hydrateFromServer()
    } else if (bet.status === 'lost' && s.myBet.status === 'active') {
      useCrashStore.setState({ myBet: { ...s.myBet, status: 'lost' } })
    }
  })
}

/** Отправляет ставку на сервер; при отказе ставка снимается, подарок возвращается. */
function sendServerBet(bet: CrashBet, requestId: string): void {
  void serverPlaceBet(
    bet.kind === 'gift'
      ? { item_id: bet.uid, client_request_id: requestId, auto_cashout: bet.autoCashout }
      : { amount_minor: bet.valueMinor, client_request_id: requestId, auto_cashout: bet.autoCashout },
  )
    .then(() => {
      void pollCrashState(true)
    })
    .catch(() => {
      const cur = useCrashStore.getState()
      if (cur.myBet && cur.myBet.status === 'active') useCrashStore.setState({ myBet: null })
      void hydrateFromServer()
    })
}

/* --- Игровые операции (Demo Mode ONLY; серверные — TIER 7, 4.3) --- */

/** Ставка TON в текущем окне ставок. Минимальная ставка — 0.1 TON (100 minor). */
export function placeGramBet(
  amountMinor: Minor,
  clientRequestId: string,
  autoCashout?: number,
): PlaceBetResult {
  return processOnce(clientRequestId, () => {
    const s = useCrashStore.getState()
    if (s.phase !== 'betting') {
      return { status: 'rejected', reason: 'phase' } as const
    }
    if (s.myBet !== null) {
      return { status: 'rejected', reason: 'duplicate' } as const
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 100 || amountMinor > MAX_BET_MINOR) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < amountMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }
    if (!SERVER_MODE) wallet.debit(amountMinor)
    const bet: CrashBet = { kind: 'gram', valueMinor: amountMinor, status: 'active', autoCashout }
    useCrashStore.setState({ myBet: bet })
    if (SERVER_MODE) sendServerBet(bet, clientRequestId)
    return { status: 'ok' } as const
  })
}

export const placeTonBet = placeGramBet

/** Запланировать ставку TON на следующий раунд (если текущий уже летит). */
export function queueNextRoundGramBet(
  amountMinor: Minor,
  clientRequestId: string,
  autoCashout?: number,
): PlaceBetResult {
  return processOnce(clientRequestId, () => {
    const s = useCrashStore.getState()
    if (s.phase === 'betting') {
      return placeGramBet(amountMinor, clientRequestId, autoCashout)
    }
    if (s.queuedNextBet !== null) {
      return { status: 'rejected', reason: 'duplicate' } as const
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 100 || amountMinor > MAX_BET_MINOR) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < amountMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }
    if (!SERVER_MODE) wallet.debit(amountMinor)
    useCrashStore.setState({
      queuedNextBet: {
        kind: 'gram',
        valueMinor: amountMinor,
        requestId: clientRequestId,
        autoCashout,
      },
    })
    return { status: 'ok' } as const
  })
}

/** Запланировать ставку подарком на следующий раунд. */
export function queueNextRoundGiftBet(
  uid: string,
  clientRequestId: string,
  autoCashout?: number,
): PlaceBetResult {
  return processOnce(clientRequestId, () => {
    const s = useCrashStore.getState()
    if (s.phase === 'betting') {
      return placeGiftBet(uid, clientRequestId, autoCashout)
    }
    if (s.queuedNextBet !== null) {
      return { status: 'rejected', reason: 'duplicate' } as const
    }
    const inventory = useInventoryStore.getState()
    const item = inventory.items.find((candidate) => candidate.uid === uid)
    const price = item ? giftById.get(item.giftId)?.priceMinor : undefined
    if (!item || price === undefined) {
      return { status: 'rejected', reason: 'unknown_item' } as const
    }
    if (price > MAX_BET_MINOR) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    if (!SERVER_MODE) inventory.removeUids([uid], 'crash-bet')
    useCrashStore.setState({
      queuedNextBet: {
        kind: 'gift',
        valueMinor: price,
        uid,
        giftId: item.giftId,
        requestId: clientRequestId,
        autoCashout,
      },
    })
    return { status: 'ok' } as const
  })
}

/** Отменить запланированную ставку на следующий раунд с возвратом средств. */
export function cancelQueuedNextRoundBet(): boolean {
  const s = useCrashStore.getState()
  const queued = s.queuedNextBet
  if (!queued) return false

  if (SERVER_MODE) {
    // в серверном режиме запланированная ставка ещё не списана — просто убираем её
  } else if (queued.kind === 'gram') {
    useWalletStore.getState().credit(queued.valueMinor)
  } else if (queued.kind === 'gift' && queued.giftId) {
    useInventoryStore.getState().addGifts([queued.giftId], 'crash-drop')
  }
  useCrashStore.setState({ queuedNextBet: null })
  return true
}

/** Ставка подарком из инвентаря: предмет конвертируется в каталог-цену. */
export function placeGiftBet(
  uid: string,
  clientRequestId: string,
  autoCashout?: number,
): PlaceBetResult {
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
    if (price > MAX_BET_MINOR) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    // Предмет уходит со стола сразу (в журнал — причина 'crash-bet');
    // выигрыш в GRAM начисляется при «Забрать», при краше предмет сгорает.
    const bet: CrashBet = { kind: 'gift', valueMinor: price, uid, giftId: item.giftId, status: 'active', autoCashout }
    if (SERVER_MODE) removeServerItem(uid)
    else inventory.removeUids([uid], 'crash-bet')
    useCrashStore.setState({ myBet: bet })
    if (SERVER_MODE) sendServerBet(bet, clientRequestId)
    return { status: 'ok' } as const
  })
}

/** «Забрать» во время полёта: выигрыш floor(ставка × показанный множитель). */
export function cashout(clientRequestId: string): CashoutResult {
  return processOnce(clientRequestId, () => cashoutAt(useCrashStore.getState().multiplier))
}

/**
 * Авто вывод: как только показанный множитель достиг цели и краша ещё нет,
 * ставка забирается по множителю ЦЕЛИ (не выше показанного — в пользу казны).
 */
function maybeAutoCashout(): void {
  const s = useCrashStore.getState()
  const bet = s.myBet
  if (s.phase !== 'flying' || !bet || bet.status !== 'active') return
  const target = bet.autoCashout
  if (target === undefined || s.multiplier < target) return
  if (SERVER_MODE) {
    // выплату по авто-выводу проводит сервер: просим его закрыть ставку и показываем итог из ответа
    processOnce(`auto-${s.roundId}-${bet.valueMinor}`, () => {
      useCrashStore.setState({
        myBet: { ...bet, status: 'won', cashedMultiplier: target, wonMinor: mulByMultiplier(bet.valueMinor, target) },
      })
      void pollCrashState(true)
      return { status: 'ok', wonMinor: mulByMultiplier(bet.valueMinor, target), multiplier: target } as const
    })
    return
  }
  processOnce(`auto-${s.roundId}-${bet.valueMinor}`, () => cashoutAt(target))
}

function cashoutAt(multiplier: number): CashoutResult {
  {
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
    const wonMinor = mulByMultiplier(s.myBet.valueMinor, multiplier)

    if (SERVER_MODE) {
      // «Забрать»: показываем сразу, а итог (множитель и выплату) подтверждает сервер
      const bet = s.myBet
      useCrashStore.setState({ myBet: { ...bet, status: 'won', cashedMultiplier: multiplier, wonMinor } })
      void serverCashout()
        .then((res) => {
          const cur = useCrashStore.getState().myBet
          if (cur && cur.status === 'won') {
            // выплата ровно равна цене NFT — сервер выдал подарок: показываем его и обновляем инвентарь
            const wonGift = res.gift_id ? giftById.get(res.gift_id) : undefined
            useCrashStore.setState({
              myBet: { ...cur, cashedMultiplier: res.multiplier, wonMinor: res.won_minor, wonGift, settled: true },
            })
          }
          void hydrateFromServer()
          void pollCrashState(true)
        })
        .catch(() => {
          // сервер не принял (раунд уже разбился) — ставка проиграна
          const cur = useCrashStore.getState().myBet
          if (cur && cur.status === 'won') useCrashStore.setState({ myBet: { ...cur, status: 'lost', wonMinor: undefined } })
          void pollCrashState(true)
        })
      return { status: 'ok', wonMinor, multiplier } as const
    }

    // Ракетка платит только TON: NFT за выигрыш не выдаётся
    useWalletStore.getState().credit(wonMinor)

    // 4.3: успешный кешаут — запись в общей истории ставок (чистый дельта).
    useGamesHistoryStore.getState().push({
      game: 'Ракетка',
      stakeLabel: crashStakeLabel(s.myBet),
      stakeMinor: s.myBet.valueMinor,
      outcome: 'won',
      deltaMinor: wonMinor - s.myBet.valueMinor,
      detail: `x${multiplier.toFixed(2)}`,
    })
    useCrashStore.setState({
      myBet: {
        ...s.myBet,
        status: 'won',
        cashedMultiplier: multiplier,
        wonMinor,
      },
    })
    return { status: 'ok', wonMinor, multiplier } as const
  }
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
