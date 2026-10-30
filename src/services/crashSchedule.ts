/**
 * Общее расписание раундов Ракетки: все устройства считают раунд из одних и тех же
 * часов (UTC) и одного сида, поэтому у всех одновременно одна и та же ракета,
 * множитель, точка краша, скин и список ботов.
 *
 * Раунды идут цепочкой внутри 10-минутных окон, выровненных по UTC. Длительность
 * раунда = окно ставок + полёт (зависит от точки краша) + показ результата.
 * Хвост окна, в который не помещается следующий раунд, достаётся показу результата
 * последнего раунда — цепочка у всех одинаковая.
 */

export const CRASH_RTP = 0.98
export const TICK_MS = 50
export const BETTING_MS = 5000
export const CRASHED_MS = 3000
const WINDOW_MS = 10 * 60 * 1000
const MAX_CRASH = 500

/** Рост множителя за тик — те же формулы, что у локального движка. */
function growthFor(mult: number): number {
  if (mult < 2.0) return Math.exp(Math.log(2) * (TICK_MS / 6500))
  const ratio = mult / 2.0
  const doublingMs = Math.max(1100, 6500 / Math.pow(ratio, 0.45))
  return Math.exp(Math.log(2) * (TICK_MS / doublingMs))
}

function floor2(x: number): number {
  return Math.floor(x * 100) / 100
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RoundInfo {
  id: number
  crashPoint: number
  /** Показанный множитель на каждом тике полёта (floor2), последний = точка краша. */
  curve: number[]
  durationMs: number
}

const roundCache = new Map<number, RoundInfo>()

export function crashPointForRound(id: number): number {
  const u = mulberry32((id % 4294967296) * 2654435761 + 0x9e3779b9)()
  return Math.min(MAX_CRASH, Math.max(1, floor2(CRASH_RTP / (1 - u))))
}

export function roundInfo(id: number): RoundInfo {
  const cached = roundCache.get(id)
  if (cached) return cached
  const crashPoint = crashPointForRound(id)
  const curve: number[] = []
  let acc = 1
  // Страховка от бесконечного цикла: полёт не длиннее 4 минут
  for (let i = 0; i < 4800; i++) {
    acc *= growthFor(acc)
    const shown = floor2(acc)
    if (shown >= crashPoint) {
      curve.push(crashPoint)
      break
    }
    curve.push(shown)
  }
  const info: RoundInfo = {
    id,
    crashPoint,
    curve,
    durationMs: BETTING_MS + curve.length * TICK_MS + CRASHED_MS,
  }
  if (roundCache.size > 200) roundCache.clear()
  roundCache.set(id, info)
  return info
}

export type SchedulePhase = 'betting' | 'flying' | 'crashed'

export interface ScheduleState {
  roundId: number
  phase: SchedulePhase
  /** Текущий показанный множитель (1 в окне ставок). */
  multiplier: number
  /** Известна только после краша (иначе null), чтобы не светить в UI заранее. */
  crashPoint: number | null
  /** Остаток фазы в тиках для betting/crashed (для таймера), 0 при полёте. */
  ticksLeft: number
}

function windowIndex(now: number): number {
  return Math.floor(now / WINDOW_MS)
}

/** Идентификатор раунда в окне w, позиция k. */
function idFor(w: number, k: number): number {
  return w * 1000 + k
}

/** Состояние расписания в момент `now` (мс, UTC). */
export function scheduleAt(now: number): ScheduleState {
  const w = windowIndex(now)
  let t = now - w * WINDOW_MS
  let acc = 0
  let k = 0
  for (;;) {
    const info = roundInfo(idFor(w, k))
    if (acc + info.durationMs > WINDOW_MS && k > 0) {
      // хвост окна: показываем результат предыдущего раунда до конца окна
      const prev = roundInfo(idFor(w, k - 1))
      return {
        roundId: prev.id,
        phase: 'crashed',
        multiplier: prev.crashPoint,
        crashPoint: prev.crashPoint,
        ticksLeft: Math.max(0, Math.ceil((WINDOW_MS - acc - t) / TICK_MS)),
      }
    }
    if (t < info.durationMs) {
      if (t < BETTING_MS) {
        return {
          roundId: info.id,
          phase: 'betting',
          multiplier: 1,
          crashPoint: null,
          ticksLeft: Math.ceil((BETTING_MS - t) / TICK_MS),
        }
      }
      const flightMs = info.curve.length * TICK_MS
      const ft = t - BETTING_MS
      if (ft < flightMs) {
        const idx = Math.min(info.curve.length - 1, Math.floor(ft / TICK_MS))
        return { roundId: info.id, phase: 'flying', multiplier: info.curve[idx]!, crashPoint: null, ticksLeft: 0 }
      }
      return {
        roundId: info.id,
        phase: 'crashed',
        multiplier: info.crashPoint,
        crashPoint: info.crashPoint,
        ticksLeft: Math.max(0, Math.ceil((info.durationMs - t) / TICK_MS)),
      }
    }
    t -= info.durationMs
    acc += info.durationMs
    k++
  }
}

/** Последние `count` уже завершившихся раундов (свежие первыми) на момент `now`. */
export function recentCrashPoints(now: number, count: number): number[] {
  const out: number[] = []
  const cur = scheduleAt(now)
  const curWindow = Math.floor(cur.roundId / 1000)
  const curK = cur.roundId % 1000
  // раунды текущего окна до текущего (не включая, если он ещё не закончился)
  const lastDone = cur.phase === 'crashed' ? curK : curK - 1
  for (let k = lastDone; k >= 0 && out.length < count; k--) {
    out.push(roundInfo(idFor(curWindow, k)).crashPoint)
  }
  // добираем из предыдущего окна: считаем длину его цепочки
  let w = curWindow - 1
  while (out.length < count && w > curWindow - 4) {
    const ids: number[] = []
    let acc = 0
    for (let k = 0; ; k++) {
      const info = roundInfo(idFor(w, k))
      if (acc + info.durationMs > WINDOW_MS && k > 0) break
      ids.push(info.id)
      acc += info.durationMs
    }
    for (let i = ids.length - 1; i >= 0 && out.length < count; i--) {
      out.push(roundInfo(ids[i]!).crashPoint)
    }
    w--
  }
  return out
}

/* --- Сверка часов с сервером (Date-заголовок), чтобы у всех были одинаковые часы --- */

let clockOffsetMs = 0

export function sharedNow(): number {
  return Date.now() + clockOffsetMs
}

export async function syncClock(): Promise<void> {
  try {
    const t0 = Date.now()
    const res = await fetch('/api/health', { cache: 'no-store' })
    const header = res.headers.get('date')
    if (!header) return
    const serverMs = Date.parse(header)
    if (Number.isNaN(serverMs)) return
    const rtt = Date.now() - t0
    // Date-заголовок с точностью до секунды: компенсируем половину RTT и округление
    clockOffsetMs = serverMs + 500 - (t0 + rtt / 2)
  } catch {
    /* офлайн или нет бэкенда — остаёмся на локальных часах */
  }
}
