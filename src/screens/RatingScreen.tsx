import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet } from '../lib/api'
import { getTelegramUser, hapticImpact, shareTelegramLink } from '../lib/telegram'
import { TgAvatar } from '../components/ui/TgAvatar'
import { cx } from '../lib/cx'
import styles from './RatingScreen.module.css'

type BoardId = 'refs' | 'turnover'

interface Row {
  rank: number
  name: string
  avatar: string | null
  value: number
  me: boolean
}

interface BoardData {
  top: Row[]
  me: { rank: number; value: number } | null
  me_outside: Row | null
  players: number
}

interface Prize {
  place: number
  ton_minor: number
  nft: boolean
}

export interface RatingState {
  season: { index: number; starts_at: number; ends_at: number; days: number }
  prizes: Prize[]
  boards: Record<BoardId, BoardData>
}

/** Оборот в TON (minor → TON): максимум один знак после точки, вниз; 12 400 → «12.4K», 3 200 000 → «3.2M». */
export function formatTurnover(minor: number): string {
  const ton = minor / 1000
  if (ton >= 1_000_000) return `${(Math.floor(ton / 100_000) / 10).toFixed(1)}M`
  if (ton >= 1_000) return `${(Math.floor(ton / 100) / 10).toFixed(1)}K`
  return (Math.floor(ton * 10) / 10).toFixed(1)
}

const fmtPrize = (minor: number) => {
  const v = Math.floor(minor / 100) / 10
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d} д ${h} ч` : `${h} ч ${String(m).padStart(2, '0')} мин`
}

const BOARDS: ReadonlyArray<{ id: BoardId; label: string; unit: string }> = [
  { id: 'refs', label: 'Рефералы', unit: 'друзей' },
  { id: 'turnover', label: 'Оборот, TON', unit: 'TON' },
]

function Avatar({ row }: { row: Row }) {
  const [broken, setBroken] = useState(false)
  if (!row.avatar || broken) return <TgAvatar name={row.name} size={38} className={styles.avatar} />
  return (
    <img className={styles.avatar} src={row.avatar} alt="" width={38} height={38} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  )
}

/**
 * Рейтинг-марафон на 30 дней: переключатель «Рефералы / Оборот в TON», таймер до конца, призы, правила,
 * кнопка «Пригласить друга». Счёт ведёт сервер с начала сезона; админы в рейтинге не участвуют.
 */
export function RatingScreen() {
  const [state, setState] = useState<RatingState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<BoardId>('refs')
  const [now, setNow] = useState(() => Date.now())
  const [rulesOpen, setRulesOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setState(await apiGet<RatingState>('/api/rating/state'))
      setError(null)
    } catch {
      setError('Нет связи с сервером. Попробуйте позже.')
    }
  }, [])

  useEffect(() => {
    void load()
    const t1 = window.setInterval(() => void load(), 30_000)
    const t2 = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      window.clearInterval(t1)
      window.clearInterval(t2)
    }
  }, [load])

  const data = state?.boards[board]
  const fmtValue = useMemo(() => (board === 'turnover' ? formatTurnover : (v: number) => String(v)), [board])
  const endsIn = state ? state.season.ends_at * 1000 - now : 0
  const meRow = data?.me_outside ?? data?.top.find((r) => r.me) ?? null

  const invite = () => {
    hapticImpact('light')
    const id = getTelegramUser()?.id
    if (id === undefined) return
    shareTelegramLink(`https://t.me/sexydropbot?startapp=ref-${id}`, 'Заходи в SEXY DROP, открой бесплатный кейс и играй!')
  }

  return (
    <div className={styles.screen}>
      <div className={styles.colSide}>
      <h1 className={styles.title}>Рейтинг</h1>

      <div className={styles.segment} role="tablist" aria-label="Выбор рейтинга">
        {BOARDS.map((b) => (
          <button key={b.id} type="button" role="tab" aria-selected={board === b.id} className={cx(styles.segBtn, board === b.id && styles.segBtnOn)} onClick={() => setBoard(b.id)}>
            {b.label}
          </button>
        ))}
      </div>

      {board === 'refs' && (
        <section className={styles.hero} aria-label="Марафон">
        <div className={styles.heroHead}>
          <h2 className={styles.heroTitle}>Марафон {state?.season.days ?? 30} дней</h2>
          <span className={styles.timer}>до конца: {state ? countdown(endsIn) : '…'}</span>
        </div>
        <ul className={styles.prizes} aria-label="Призы">
          {(state?.prizes ?? []).map((p) => (
            <li key={p.place} className={styles.prizeItem}>
              <span className={styles.prizePlace}>{p.place} место</span>
              <span className={styles.prizeText}>
                {p.nft ? 'NFT + ' : ''}
                {fmtPrize(p.ton_minor)} TON
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.heroNote}>Призы получают лучшие в рейтинге рефералов.</p>
      </section>
      )}

      <section className={styles.invite} aria-label="Приглашение">
        <p className={styles.inviteText}>
          {board === 'refs'
            ? 'В зачёт идёт друг, который зашёл по вашей ссылке и открыл бесплатный кейс.'
            : 'Оборот: сумма всех ваших ставок в играх и кейсах за всё время. Призов в этом рейтинге нет.'}
        </p>
        <button type="button" className={styles.inviteBtn} onClick={invite}>
          Пригласить друга
        </button>
      </section>

      </div>

      <div className={styles.colList}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.listHead}>
        <span className={styles.listTitle}>Топ-30</span>
        <span className={styles.colLabel}>{BOARDS.find((b) => b.id === board)!.unit}</span>
      </div>
      {state && data && data.top.length === 0 && <p className={styles.empty}>Пока никого нет. Станьте первым!</p>}
      <ol className={styles.list} aria-label="Рейтинг игроков">
        {data?.top.map((r) => (
          <li key={r.rank} className={cx(styles.row, r.me && styles.rowMe, r.rank <= 3 && styles[`top${r.rank}` as 'top1'])}>
            <span className={styles.rank}>{r.rank}</span>
            <Avatar row={r} />
            <span className={styles.name}>{r.me ? `${r.name} (вы)` : r.name}</span>
            <span className={styles.value}>{fmtValue(r.value)}</span>
          </li>
        ))}
        {data?.me_outside && (
          <>
            <li className={styles.gap} aria-hidden>
              ⋯
            </li>
            <li className={cx(styles.row, styles.rowMe)}>
              <span className={styles.rank}>{data.me_outside.rank}</span>
              <Avatar row={data.me_outside} />
              <span className={styles.name}>{data.me_outside.name} (вы)</span>
              <span className={styles.value}>{fmtValue(data.me_outside.value)}</span>
            </li>
          </>
        )}
      </ol>

      {state && (
        <div className={styles.meBar} aria-label="Ваше место">
          <span className={styles.meRank}>{meRow ? meRow.rank : '—'}</span>
          <span className={styles.meText}>{meRow ? 'Ваше место' : 'Вы пока вне рейтинга'}</span>
          <span className={styles.value}>{fmtValue(meRow?.value ?? 0)}</span>
        </div>
      )}

      </div>

      <div className={styles.colRules}>
      <section className={styles.rules} aria-label="Правила">
        <button type="button" className={styles.rulesBtn} aria-expanded={rulesOpen} onClick={() => setRulesOpen((v) => !v)}>
          Правила <span className={cx(styles.caret, rulesOpen && styles.caretOpen)} aria-hidden>▾</span>
        </button>
        {rulesOpen && (
          <ol className={styles.rulesList}>
            <li>Марафон рефералов длится 30 дней. Счёт начался с запуска рейтинга и идёт без пауз, после конца стартует новый.</li>
            <li>«Рефералы»: друг засчитывается, если зашёл по вашей ссылке во время марафона и открыл бесплатный кейс.</li>
            <li>«Оборот»: сумма всех ваших ставок в играх и кейсах за всё время, в TON. Это обычная таблица без призов и без сезона.</li>
            <li>Награда только в рейтинге рефералов: 1 место — NFT + 10 TON, 2 место — 10 TON, 3 место — 5 TON.</li>
            <li>TON приходят на баланс после конца марафона, NFT выдаёт администратор вручную.</li>
            <li>Накрутка и администраторы в рейтинге не учитываются. Итоги подводит сервер.</li>
          </ol>
        )}
      </section>
      </div>
    </div>
  )
}
