import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { getTelegramUser, hapticImpact, hapticNotify, shareTelegramLink } from '../lib/telegram'
import { playKeyThock } from '../lib/sound'
import { TgAvatar } from '../components/ui/TgAvatar'
import { cx } from '../lib/cx'
import { KEY_LEVELS, KeyCap3D } from './KeyCap'
import { useStarsBalanceStore } from '../store/starsBalance'
import { useWalletStore } from '../store/wallet'
import { formatMinor } from '../lib/money'
import { hydrateFromServer } from '../lib/serverSync'
import { ApiError } from '../lib/api'
import styles from './ClickerScreen.module.css'

interface TopRow {
  rank: number
  name: string
  avatar: string | null
  clicks: number
  total?: number
  me: boolean
}

export interface ClickerState {
  total: number
  month_clicks: number
  rank: number | null
  players: number
  top: TopRow[]
  month_ends_at: number
  prizes?: { place: number; ton_minor: number; nft: boolean }[]
  max_cps: number
  me_outside?: TopRow | null
  boost?: { mult: number; options: { mult: number; stars: number; ton_minor: number }[] }
  referral?: { clicks: number; clicks_premium: number; daily_max: number; today: number; earned: number; waiting?: number }
}

interface Pop {
  id: number
  x: number
  text: string
  big: boolean
}

/** Лиги по числу кликов (как в популярных тапалках: растёшь — меняется название и цвет). */
export const LEAGUES = [
  { name: 'Новичок', from: 0 },
  { name: 'Бронза', from: 5_000 },
  { name: 'Серебро', from: 25_000 },
  { name: 'Золото', from: 100_000 },
  { name: 'Платина', from: 300_000 },
  { name: 'Алмаз', from: 1_000_000 },
  { name: 'Легенда', from: 3_000_000 },
] as const

export function leagueFor(total: number) {
  let i = 0
  for (let k = 0; k < LEAGUES.length; k += 1) if (total >= LEAGUES[k]!.from) i = k
  const cur = LEAGUES[i]!
  const next = LEAGUES[i + 1]
  const pct = next ? Math.min(100, ((total - cur.from) / (next.from - cur.from)) * 100) : 100
  return { index: i, cur, next, pct }
}

const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ')

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d} д ${h} ч` : `${h} ч ${String(m).padStart(2, '0')} мин`
}

/** Счётчик: обычные цифры (без «барабанов» — они ломались на некоторых экранах); при росте цифра коротко «подпрыгивает». */
function fmtTon(minor: number): string {
  const v = Math.floor(minor / 100) / 10
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function RollingNumber({ value, testId }: { value: number; testId?: string }) {
  const text = fmt(value)
  return (
    <strong className={styles.rolling} data-testid={testId} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span
          key={text.length - i}
          className={ch >= '0' && ch <= '9' ? styles.digit : styles.sep}
          aria-hidden
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </strong>
  )
}

function BoardRow({ r, month }: { r: TopRow; month: number }) {
  const lg = leagueFor(r.total ?? 0)
  return (
    <li className={cx(styles.row, r.me && styles.rowMe, r.rank <= 3 && styles[`top${r.rank}` as 'top1'])}>
      <span className={styles.rank}>{r.rank}</span>
      <Avatar row={r} />
      <span className={styles.name}>
        {r.me ? `${r.name} (вы)` : r.name}
        <span className={cx(styles.rankTag, styles[`league${lg.index}` as 'league0'])}>{lg.cur.name}</span>
      </span>
      <span className={styles.clicks}>{fmt(r.me ? Math.max(r.clicks, month) : r.clicks)}</span>
    </li>
  )
}

function Avatar({ row }: { row: TopRow }) {
  const [broken, setBroken] = useState(false)
  if (!row.avatar || broken) return <TgAvatar name={row.name} size={38} />
  return (
    <img
      className={styles.avatar}
      src={row.avatar}
      alt=""
      width={38}
      height={38}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

const MAX_CPS = 8

/**
 * Кликалка: большая 3D-кнопка (наклоняется к месту нажатия, «проминается»), счётчик со скатывающимися цифрами,
 * лиги, комбо и топ марафона 30-дневного марафона. Тапы считает сервер (не быстрее 8 в секунду).
 */
export function ClickerScreen() {
  const [state, setState] = useState<ClickerState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(0)
  const [total, setTotal] = useState(0)
  const [pressed, setPressed] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [pops, setPops] = useState<Pop[]>([])
  const [cps, setCps] = useState(0)
  const [combo, setCombo] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [buying, setBuying] = useState<string | null>(null)
  const [boostMsg, setBoostMsg] = useState<string | null>(null)
  const stars = useStarsBalanceStore((st) => st.stars)
  const tonBalance = useWalletStore((st) => st.balances[st.mode])
  const multRef = useRef(1)

  const pending = useRef(0)
  const sending = useRef(false)
  const popId = useRef(0)
  const stamps = useRef<number[]>([])
  const lastSound = useRef(0)
  const comboRef = useRef({ n: 0, at: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    try {
      const s = await apiGet<ClickerState>('/api/clicker/state')
      setState(s)
      multRef.current = s.boost?.mult ?? 1
      setMonth(s.month_clicks + pending.current * multRef.current)
      setTotal(s.total + pending.current * multRef.current)
      setError(null)
    } catch {
      setError('Нет связи с сервером. Тапы сохранятся, когда связь появится.')
    }
  }, [])

  const flush = useCallback(async () => {
    if (sending.current || pending.current === 0) return
    sending.current = true
    const batch = pending.current
    pending.current = 0
    try {
      const res = await apiPost<{ accepted: number; mult?: number; total: number; month_clicks: number }>('/api/clicker/tap', { taps: batch })
      if (res.mult) multRef.current = res.mult
      setMonth(res.month_clicks + pending.current * multRef.current)
      setTotal(res.total + pending.current * multRef.current)
    } catch {
      pending.current += batch
    } finally {
      sending.current = false
    }
  }, [])

  useEffect(() => {
    void load()
    const t1 = window.setInterval(() => void flush(), 1000)
    const t2 = window.setInterval(() => void load(), 20_000)
    const t3 = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      const cutoff = t - 1000
      stamps.current = stamps.current.filter((x) => x > cutoff)
      const c = stamps.current.length
      setCps(c)
      if (comboRef.current.n > 0 && t - comboRef.current.at > 1500) {
        comboRef.current = { n: 0, at: 0 }
        setCombo(0)
      }
    }, 250)
    return () => {
      window.clearInterval(t1)
      window.clearInterval(t2)
      window.clearInterval(t3)
      void flush()
    }
  }, [load, flush])

  const press = useCallback((clientX?: number, clientY?: number) => {
    window.clearTimeout(releaseTimer.current)
    setPressed(true)
    // не быстрее MAX_CPS тапов в секунду (так же считает сервер): лишние нажатия не засчитываем
    const nowMs = Date.now()
    stamps.current = stamps.current.filter((x) => x > nowMs - 1000)
    if (stamps.current.length >= MAX_CPS) return
    // наклон к месту касания: кнопка «проваливается» с той стороны, куда ткнули
    const el = buttonRef.current
    if (el && clientX !== undefined && clientY !== undefined) {
      const r = el.getBoundingClientRect()
      const nx = ((clientX - r.left) / r.width - 0.5) * 2
      const ny = ((clientY - r.top) / r.height - 0.5) * 2
      setTilt({ x: Math.max(-1, Math.min(1, -ny)) * 12, y: Math.max(-1, Math.min(1, nx)) * 12 })
    }
    pending.current += 1
    const mult = multRef.current
    setMonth((v) => v + mult)
    setTotal((v) => v + mult)
    const t = Date.now()
    stamps.current.push(t)
    hapticImpact('light')
    const pt = performance.now()
    if (pt - lastSound.current > 60) {
      lastSound.current = pt
      playKeyThock()
    }
    // комбо: серия тапов без пауз дольше 1.5 с
    const c = comboRef.current
    c.n = t - c.at > 1500 ? 1 : c.n + 1
    c.at = t
    setCombo(c.n)
    const milestone = [10, 25, 50, 100, 200].includes(c.n)
    if (milestone) hapticNotify('success')
    const id = (popId.current += 1)
    const text = milestone ? `КОМБО ×${c.n}!` : `+${mult}`
    setPops((p) => [...p.slice(-9), { id, x: Math.round((Math.random() - 0.5) * 130), text, big: milestone }])
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), milestone ? 1100 : 750)
  }, [])

  const releaseTimer = useRef<number | undefined>(undefined)
  const release = useCallback(() => {
    // держим «нажато» ещё долю секунды: при быстрой серии клавиша не дёргается вверх-вниз
    window.clearTimeout(releaseTimer.current)
    releaseTimer.current = window.setTimeout(() => {
      setPressed(false)
      setTilt({ x: 0, y: 0 })
    }, 90)
  }, [])

  const buyBoost = async (level: number, currency: 'stars' | 'ton') => {
    if (buying) return
    setBuying(`${level}-${currency}`)
    setBoostMsg(null)
    try {
      await apiPost('/api/clicker/boost', { level, currency })
      hapticNotify('success')
      setBoostMsg(`Усиление x${level} включено до конца марафона`)
      await Promise.all([load(), hydrateFromServer()])
    } catch (e) {
      hapticNotify('error')
      setBoostMsg(e instanceof ApiError ? e.message : 'Не удалось купить усиление')
    } finally {
      setBuying(null)
    }
  }

  const endsIn = state ? state.month_ends_at * 1000 - now : 0
  const myRank = useMemo(() => {
    if (!state) return null
    const ahead = state.top.filter((r) => !r.me && r.clicks > month).length
    return month > 0 ? ahead + 1 : null
  }, [state, month])
  const league = leagueFor(total)
  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <h1 className={styles.title}>Кликалка</h1>
      </header>

      <section className={styles.counter} aria-label="Счётчик кликов">
        <span className={styles.counterLabel}>Всего накликано</span>
        <RollingNumber value={total} testId="clicks-total" />
        <div className={styles.chips}>
          <span className={styles.chip}>за марафон: {fmt(month)}</span>
          <span className={styles.chip}>{cps} / сек</span>
          <span className={styles.chip}>место: {myRank ?? state?.rank ?? '—'}</span>
        </div>
        <div className={styles.league} aria-label={`Лига: ${league.cur.name}`}>
          <div className={styles.leagueHead}>
            <span className={cx(styles.leagueName, styles[`league${league.index}` as 'league0'])}>{league.cur.name}</span>
            <span className={styles.leagueNext}>
              {league.next ? `до «${league.next.name}»: ${fmt(league.next.from - total)}` : 'максимальная лига'}
            </span>
          </div>
          <div className={styles.leagueBar}>
            <span className={styles.leagueFill} style={{ width: `${league.pct}%` }} />
          </div>
        </div>
      </section>

      <section className={styles.stage} aria-label="Большая кнопка">
        <div className={styles.glow} aria-hidden style={{ background: `radial-gradient(circle, ${KEY_LEVELS[league.index]!.accent}55 0%, transparent 68%)` }} />
        <div className={styles.pops} aria-hidden>
          {pops.map((p) => (
            <span key={p.id} className={cx(styles.pop, p.big && styles.popBig)} style={{ left: `calc(50% + ${p.x}px)` }}>
              {p.text}
            </span>
          ))}
        </div>
        {combo >= 5 && <div className={styles.combo}>серия {combo}</div>}
        <div className={styles.scene}>
          <button
            ref={buttonRef}
            type="button"
            className={cx(styles.coin, pressed && styles.pressed)}
            style={{ '--rx': `${tilt.x}deg`, '--ry': `${tilt.y}deg` } as React.CSSProperties}
            aria-label="Нажать"
            onPointerDown={(e) => {
              e.preventDefault()
              press(e.clientX, e.clientY)
            }}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press()
            }}
            onKeyUp={release}
          >
            <KeyCap3D level={league.index} pressed={pressed} />
          </button>
          
        </div>
      </section>

      {state?.boost && (
        <section className={styles.boost} aria-label="Усиление тапа">
          <div className={styles.boostHead}>
            <h2 className={styles.boostTitle}>Усиление тапа</h2>
            <span className={styles.boostNow}>{state.boost.mult > 1 ? `сейчас x${state.boost.mult}` : 'сейчас x1'}</span>
          </div>
          {state.boost.options.length === 0 && <p className={styles.boostHint}>Максимальное усиление x3 действует до конца марафона.</p>}
          {state.boost.options.map((o) => (
            <div key={o.mult} className={styles.boostRow}>
              <span className={styles.boostMult}>
                x{o.mult}
                <small>за каждый тап</small>
              </span>
              <button
                type="button"
                className={styles.boostBtn}
                disabled={buying !== null || stars < o.stars}
                onClick={() => void buyBoost(o.mult, 'stars')}
              >
                {o.stars} ★
              </button>
              <button
                type="button"
                className={styles.boostBtn}
                disabled={buying !== null || tonBalance < o.ton_minor}
                onClick={() => void buyBoost(o.mult, 'ton')}
              >
                {formatMinor(o.ton_minor)} TON
              </button>
            </div>
          ))}
          <p className={styles.boostHint}>
            У вас: {stars} ★ · {formatMinor(tonBalance)} TON. Усиление действует до конца текущего марафона.
          </p>
          {boostMsg && <p className={styles.boostMsg} role="status">{boostMsg}</p>}
        </section>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <section className={styles.board} aria-label="Топ марафона">
        <div className={styles.boardHead}>
          <h2 className={styles.boardTitle}>Марафон 30 дней</h2>
          <span className={styles.timer}>до конца: {state ? countdown(endsIn) : '…'}</span>
        </div>
        {state?.referral && (
          <div className={styles.invite}>
            <p className={styles.inviteText}>
              Пригласи друга: <b>+{state.referral.clicks} кликов</b> (с Premium <b>+{state.referral.clicks_premium}</b>). Друг должен открыть бесплатный кейс, иначе
              бонус не засчитается. Лимит {state.referral.daily_max} друзей в день, сегодня {state.referral.today}/{state.referral.daily_max}
              {state.referral.waiting ? `, ждут кейса: ${state.referral.waiting}` : ''}.
            </p>
            <button
              type="button"
              className={styles.inviteBtn}
              onClick={() => {
                hapticImpact('light')
                const id = getTelegramUser()?.id
                if (id === undefined) return
                shareTelegramLink(`https://t.me/sexydropbot?startapp=ref-${id}`, 'Заходи в SEXY DROP, открой бесплатный кейс и играй в кликалку!')
              }}
            >
              Пригласить друга
            </button>
          </div>
        )}
        <ul className={styles.prizes} aria-label="Призы">
          {(state?.prizes ?? []).map((p) => (
            <li key={p.place} className={styles.prizeItem}>
              <span className={styles.prizePlace}>{p.place} место</span>
              <span className={styles.prizeText}>
                {p.nft ? 'NFT-подарок + ' : ''}
                {fmtTon(p.ton_minor)} TON на баланс
              </span>
            </li>
          ))}
        </ul>
        {state && state.top.length === 0 && <p className={styles.empty}>Пока никто не кликал — станьте первым!</p>}
        <ol className={styles.list}>
          {state?.top.map((r) => (
            <BoardRow key={r.rank} r={r} month={month} />
          ))}
          {state?.me_outside && (
            <>
              <li className={styles.gap} aria-hidden>
                ⋯
              </li>
              <BoardRow r={state.me_outside} month={month} />
            </>
          )}
        </ol>
      </section>
    </div>
  )
}
