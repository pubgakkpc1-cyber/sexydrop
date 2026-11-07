/**
 * Ракетка в серверном режиме: раунды, точки краша, ставки и «Забрать» решает сервер.
 * Клиент опрашивает расписание (`/api/play/crash/state`) и между опросами лишь продолжает анимацию
 * множителя по той же кривой роста; точка краша становится известна только после краша.
 */
import { ApiError, apiGet, apiPost } from '../lib/api'
import { setServerBalance } from '../lib/serverSync'
import { BETTING_MS, CRASHED_MS, TICK_MS, floor2, growthFor, type ScheduleState } from './crashSchedule'

export interface ServerBet {
  round_id: number
  kind: 'gram' | 'gift'
  gift_id?: string | null
  value_minor: number
  auto_cashout: number | null
  status: 'active' | 'won' | 'lost'
  cashed_multiplier?: number | null
  won_minor: number
  won_gift_id?: string | null
}

interface ServerCrashState {
  round_id: number
  phase: 'betting' | 'flying' | 'crashed'
  multiplier: number
  crash_point: number | null
  round_start_ms: number
  server_now_ms: number
  recent: number[]
  my_bet?: ServerBet | null
  balance_minor?: number
}

let snap: ServerCrashState | null = null
/** Разница часов «сервер − устройство», мс. */
let offset = 0
/** Известные точки краша завершённых раундов (раскрываются сервером после краша). */
export const knownCrashPoints = new Map<number, number>()

/** Кривая множителя по тикам полёта: не зависит от точки краша, поэтому считается на устройстве. */
const curve: number[] = []
let acc = 1
function shownAt(idx: number): number {
  while (curve.length <= idx && curve.length < 4800) {
    acc *= growthFor(acc)
    curve.push(floor2(acc))
  }
  return curve[Math.min(idx, curve.length - 1)]!
}

function flightTicks(crashPoint: number): number {
  let i = 0
  while (i < 4799 && shownAt(i) < crashPoint) i += 1
  return i + 1
}

export function serverRecent(): number[] {
  return snap?.recent ?? []
}

export function lastServerBet(): ServerBet | null {
  return snap?.my_bet ?? null
}

/** Расписание на момент now (мс устройства) по последнему ответу сервера; null — ответа ещё не было. */
export function serverScheduleAt(now: number): ScheduleState | null {
  if (!snap) return null
  const t = now + offset - snap.round_start_ms
  if (snap.phase === 'crashed' && snap.crash_point !== null) {
    const end = BETTING_MS + flightTicks(snap.crash_point) * TICK_MS + CRASHED_MS
    return {
      roundId: snap.round_id,
      phase: 'crashed',
      multiplier: snap.crash_point,
      crashPoint: snap.crash_point,
      ticksLeft: Math.max(0, Math.ceil((end - t) / TICK_MS)),
    }
  }
  if (t < BETTING_MS) {
    return {
      roundId: snap.round_id,
      phase: 'betting',
      multiplier: 1,
      crashPoint: null,
      ticksLeft: Math.max(1, Math.ceil((BETTING_MS - t) / TICK_MS)),
    }
  }
  const idx = Math.max(0, Math.floor((t - BETTING_MS) / TICK_MS))
  return { roundId: snap.round_id, phase: 'flying', multiplier: shownAt(idx), crashPoint: null, ticksLeft: 0 }
}

type Listener = (state: ServerCrashState) => void
const listeners = new Set<Listener>()
export function onCrashServerState(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let timer: ReturnType<typeof setTimeout> | null = null
let fast = false
let withMe = true
let running = false
let lastMeAt = 0

function accept(state: ServerCrashState, sentAt: number): void {
  const rtt = Date.now() - sentAt
  offset = state.server_now_ms - (sentAt + rtt / 2)
  if (state.phase === 'crashed' && state.crash_point !== null) knownCrashPoints.set(state.round_id, state.crash_point)
  // «моя» ставка и баланс приходят только в ответе с me=1; прежние данные не теряем
  snap = { ...state, my_bet: state.my_bet !== undefined ? state.my_bet : snap?.my_bet ?? null }
  if (typeof state.balance_minor === 'number') setServerBalance(state.balance_minor)
  listeners.forEach((fn) => fn(snap!))
}

export async function pollCrashState(me: boolean): Promise<void> {
  const sentAt = Date.now()
  try {
    let state: ServerCrashState | null = null
    if (me) {
      lastMeAt = Date.now()
      state = await apiGet<ServerCrashState>('/api/play/crash/state?me=1').catch(() => null)
    }
    if (!state) {
      const res = await fetch('/api/play/crash/state', { cache: 'no-store' })
      if (!res.ok) return
      state = (await res.json()) as ServerCrashState
    }
    accept(state, sentAt)
  } catch {
    /* нет связи или входа — продолжаем по последним данным */
  }
}

function schedule(): void {
  if (!running) return
  const delay = fast ? 200 : 1000
  timer = setTimeout(() => {
    // раз в 2 секунды (в быстром режиме) запрашиваем и ставку игрока
    const needMe = withMe && Date.now() - lastMeAt > (fast ? 2000 : 8000)
    void pollCrashState(needMe).finally(schedule)
  }, delay)
}

export function startCrashPolling(): void {
  if (running) return
  running = true
  void pollCrashState(withMe).finally(schedule)
}

export function stopCrashPolling(): void {
  running = false
  if (timer !== null) clearTimeout(timer)
  timer = null
}

/** Быстрый опрос, пока открыт экран Ракетки. */
export function setCrashPollFast(value: boolean): void {
  fast = value
}

export function isCrashPolling(): boolean {
  return running
}

/* ------------------------------------------------------------------ действия */

export async function serverPlaceBet(body: {
  amount_minor?: number
  item_id?: string
  client_request_id: string
  auto_cashout?: number
}): Promise<void> {
  const res = await apiPost<{ balance_minor?: number }>('/api/play/crash/bet', body)
  if (typeof res.balance_minor === 'number') setServerBalance(res.balance_minor)
}

export async function serverCashout(): Promise<{ multiplier: number; won_minor: number; gift_id?: string; uid?: string }> {
  const res = await apiPost<{ multiplier: number; won_minor: number; balance_minor?: number; gift_id?: string; uid?: string }>(
    '/api/play/crash/cashout',
    {},
  )
  if (typeof res.balance_minor === 'number') setServerBalance(res.balance_minor)
  return { multiplier: res.multiplier, won_minor: res.won_minor, gift_id: res.gift_id, uid: res.uid }
}

export { ApiError }
