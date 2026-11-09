import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminApi'
import { cx } from '../../lib/cx'
import { PlayerAvatar } from './AdminAvatar'
import { ago, dateTime, signedTon, ton } from './adminFormat'
import styles from './AdminPanel.module.css'

interface RefFriend {
  id: string
  name: string
  username: string | null
  at: number | null
  premium: boolean
  spun: boolean
  not_in_chat: boolean
}

interface RefBlock {
  bank: number
  earned_total: number
  friends_credited: number
  friends_out_of_chat: number
  history: Array<{ at: number; d: number; t: string }>
  friends: RefFriend[]
  tag_quest: { stage: number; started_at: number | null; ready_at: number | null; total_claimed: number }
}

interface ClickerBlock {
  total: number
  month_clicks: number
  ref_clicks_total: number
  ref_today: number
  ref_waiting: number
  score: number
  flagged: boolean
  reasons: string[]
  over_cap: number
}

interface PlayerDetail {
  clicker?: ClickerBlock
  referral?: RefBlock
  profile: {
    id: string
    name: string
    username: string | null
    photo: string | null
    first: number
    last: number
    premium: boolean
    inviter: { id: string; name: string } | null
    invited: number
    invited_qualified: number
  }
  money: {
    balance: number
    stars: number
    deposited: number
    deposits_by: Array<{ method: string; count: number; amount: number }>
    admin_credit: number
    wagered: number
    paid: number
    net: number
  }
  games: Array<{ game: string; rounds: number; wagered: number; paid: number; net: number }>
  cases: Array<{ case: string; opens: number; spent: number; prize: number }>
  items: {
    counts: Array<{ status: string; count: number }>
    list: Array<{ name: string; gift_id: string; price: number; status: string; source: string; at: number }>
    /** NFT из FREE, который игрок ещё не получил: задание «5 друзей». */
    locked: Array<{
      name: string
      price: number
      at: number
      expired: boolean
      joined: number
      target: number
      left: number
      expires_at: number | null
    }>
  }
  withdrawals: Array<{ name: string; status: string; at: number; done_at: number | null }>
  deposits: Array<{ method: string; amount: number; at: number }>
  history: Array<{ at: number; type: string; sign: 1 | -1; amount: number; balance_after: number; note: string | null }>
}

/** Неполный ответ сервера не должен ронять карточку: пустые списки и нули по умолчанию. */
function normalize(raw: Partial<PlayerDetail> | null | undefined): PlayerDetail {
  const r = raw ?? {}
  const p: Partial<PlayerDetail['profile']> = r.profile ?? {}
  const m: Partial<PlayerDetail['money']> = r.money ?? {}
  return {
    profile: {
      id: String(p.id ?? ''),
      name: p.name || (p.username ? `@${p.username}` : `ID ${p.id ?? ''}`),
      username: p.username ?? null,
      photo: p.photo ?? null,
      first: p.first ?? 0,
      last: p.last ?? 0,
      premium: Boolean(p.premium),
      inviter: p.inviter ?? null,
      invited: p.invited ?? 0,
      invited_qualified: p.invited_qualified ?? 0,
    },
    money: {
      balance: m.balance ?? 0,
      stars: m.stars ?? 0,
      deposited: m.deposited ?? 0,
      deposits_by: m.deposits_by ?? [],
      admin_credit: m.admin_credit ?? 0,
      wagered: m.wagered ?? 0,
      paid: m.paid ?? 0,
      net: m.net ?? 0,
    },
    referral: r.referral,
    games: r.games ?? [],
    cases: r.cases ?? [],
    items: { counts: r.items?.counts ?? [], list: r.items?.list ?? [], locked: r.items?.locked ?? [] },
    withdrawals: r.withdrawals ?? [],
    deposits: r.deposits ?? [],
    clicker: r.clicker,
    history: r.history ?? [],
  }
}

const WITHDRAW_STATUS: Record<string, string> = { pending: 'ждёт', done: 'выдан', rejected: 'отклонён' }

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={cx(styles.statValue, tone && styles[tone])}>{value}</strong>
    </div>
  )
}

/** Карточка одного игрока: профиль, деньги, игры, кейсы, подарки, друзья, история операций. */
export function AdminPlayerCard({
  telegramId,
  onBack,
  onOpen,
}: {
  telegramId: string
  onBack: () => void
  /** Открыть другого игрока (например, того, кто пригласил). */
  onOpen: (id: string) => void
}) {
  const [d, setD] = useState<PlayerDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let dead = false
    setD(null)
    void adminFetch<PlayerDetail>(`/api/admin/players/${encodeURIComponent(telegramId)}`).then((r) => {
      if (dead) return
      if (r.ok) {
        setD(normalize(r.data))
        setError(null)
      } else setError(r.error)
    })
    return () => {
      dead = true
    }
  }, [telegramId, tick])

  return (
    <div className={styles.tab}>
      <button type="button" className={styles.refresh} onClick={onBack}>
        ‹ Ко всем игрокам
      </button>
      {error && <p className={`${styles.note} ${styles.bad}`}>{error}</p>}
      {!d && !error && <p className={styles.muted}>Загрузка…</p>}
      {d && <Body d={d} onOpen={onOpen} />}
      {d && (
        <button type="button" className={styles.refresh} onClick={() => setTick((t) => t + 1)}>
          Обновить
        </button>
      )}
    </div>
  )
}

function Body({ d, onOpen }: { d: PlayerDetail; onOpen: (id: string) => void }) {
  const { profile: p, money: m } = d
  return (
    <>
      <div className={styles.cardHead}>
        <PlayerAvatar name={p.name} photo={p.photo} size={56} />
        <div className={styles.pMain}>
          <span className={styles.cardName}>{p.name}</span>
          <span className={styles.pSub}>
            {p.username ? `@${p.username} · ` : ''}ID {p.id}
            {p.premium ? ' · Premium' : ''}
          </span>
          <span className={styles.pSub}>
            В боте с {dateTime(p.first)} · был {ago(p.last)}
          </span>
        </div>
      </div>

      <h3 className={styles.h3}>Деньги</h3>
      <div className={styles.statGrid}>
        <Stat label="Баланс сейчас" value={ton(m.balance)} />
        <Stat label="Звёзды" value={`${m.stars} ★`} />
        <Stat label="Пополнил всего" value={ton(m.deposited)} />
        <Stat label="Выдал админ" value={ton(m.admin_credit)} />
        <Stat label="Поставил (оборот)" value={ton(m.wagered)} />
        <Stat label="Выиграл" value={ton(m.paid)} />
        <Stat
          label="Итог игрока"
          value={signedTon(m.net)}
          tone={m.net > 0 ? 'good' : m.net < 0 ? 'bad' : undefined}
        />
        <Stat
          label="Казино на нём"
          value={signedTon(-m.net)}
          tone={-m.net > 0 ? 'good' : -m.net < 0 ? 'bad' : undefined}
        />
      </div>
      {m.deposits_by.length > 0 && (
        <p className={styles.note}>
          Пополнения: {m.deposits_by.map((x) => `${x.method} — ${x.count} шт. на ${ton(x.amount)}`).join('; ')}
        </p>
      )}

      <h3 className={styles.h3}>Платежи</h3>
      {d.deposits.length === 0 ? (
        <p className={styles.note}>Пополнений не было.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Способ</th>
              <th>Сумма</th>
              <th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {d.deposits.map((x, i) => (
              <tr key={`${x.at}-${i}`}>
                <td>{x.method}</td>
                <td>{x.method === 'Stars' ? `${Math.round(x.amount / 10)} ★ (≈ ${ton(x.amount)})` : ton(x.amount)}</td>
                <td>{new Date(x.at * 1000).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {d.clicker && (
        <>
          <h3 className={styles.h3}>Кликалка</h3>
          <div className={styles.statGrid}>
            <Stat label="Тапов всего" value={String(d.clicker.total)} />
            <Stat label="Тапов за марафон" value={String(d.clicker.month_clicks)} />
            <Stat label="Кликов за рефералов" value={String(d.clicker.ref_clicks_total)} />
            <Stat label="Рефералов сегодня" value={`${d.clicker.ref_today} / 5`} />
            <Stat label="Друзья ждут кейса" value={String(d.clicker.ref_waiting)} />
            <Stat
              label="Автокликер"
              value={d.clicker.flagged ? `подозрение (${d.clicker.score})` : d.clicker.score > 0 ? `звоночки: ${d.clicker.score}` : 'чисто'}
              tone={d.clicker.flagged ? 'bad' : undefined}
            />
          </div>
          {d.clicker.reasons.length > 0 && <p className={styles.note}>Причины: {d.clicker.reasons.join('; ')}</p>}
        </>
      )}

      {d.referral && <ReferralBlock r={d.referral} stars={d.money.stars} onOpen={onOpen} />}

      <h3 className={styles.h3}>Друзья</h3>
      <div className={styles.statGrid}>
        <Stat label="Пригласил" value={String(p.invited)} />
        <Stat label="Из них прокрутили FREE" value={String(p.invited_qualified)} />
      </div>
      <p className={styles.note}>
        Пришёл:{' '}
        {p.inviter ? (
          <button type="button" className={styles.linkBtn} onClick={() => onOpen(p.inviter!.id)}>
            по ссылке {p.inviter.name}
          </button>
        ) : (
          'сам'
        )}
      </p>

      <h3 className={styles.h3}>Игры</h3>
      {d.games.length === 0 ? (
        <p className={styles.muted}>Ещё не играл</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Игра</th>
              <th>Раунды</th>
              <th>Поставил</th>
              <th>Итог</th>
            </tr>
          </thead>
          <tbody>
            {d.games.map((g) => (
              <tr key={g.game}>
                <td>{g.game}</td>
                <td>{g.rounds}</td>
                <td>{ton(g.wagered)}</td>
                <td className={g.net > 0 ? styles.good : g.net < 0 ? styles.bad : undefined}>{signedTon(g.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {d.cases.length > 0 && (
        <>
          <h3 className={styles.h3}>Кейсы</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Кейс</th>
                <th>Открыл</th>
                <th>Потратил</th>
                <th>Выпало</th>
              </tr>
            </thead>
            <tbody>
              {d.cases.map((c) => (
                <tr key={c.case}>
                  <td>{c.case}</td>
                  <td>{c.opens}</td>
                  <td>{ton(c.spent)}</td>
                  <td>{ton(c.prize)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {d.items.locked.length > 0 && (
        <>
          <h3 className={styles.h3}>Под замком (ещё не получил)</h3>
          {d.items.locked.map((l, i) => (
            <div key={i} className={styles.lockCard}>
              <div className={styles.lockHead}>
                <span className={styles.pName}>🔒 {l.name}</span>
                <span className={styles.pSub}>{ton(l.price)}</span>
              </div>
              {l.expired ? (
                <span className={cx(styles.pSub, styles.bad)}>Срок задания истёк — подарок не выдан</span>
              ) : (
                <>
                  <span className={styles.lockLeft}>
                    {l.left === 0 ? 'Задание выполнено — выдаётся' : `Осталось пригласить: ${l.left} из ${l.target}`}
                  </span>
                  <div className={styles.lockBar} role="progressbar" aria-valuemin={0} aria-valuemax={l.target} aria-valuenow={l.joined}>
                    <span className={styles.lockFill} style={{ width: `${Math.min(100, (l.joined / Math.max(1, l.target)) * 100)}%` }} />
                  </div>
                  <span className={styles.pSub}>
                    Засчитано друзей с Premium: {l.joined} / {l.target}
                    {l.expires_at ? ` · до ${dateTime(l.expires_at)}` : ''}
                  </span>
                </>
              )}
            </div>
          ))}
          <p className={styles.note}>Пока замок не снят, подарок не входит в выигрыш игрока и в прибыль.</p>
        </>
      )}

      <h3 className={styles.h3}>Подарки</h3>
      {d.items.list.length === 0 ? (
        <p className={styles.muted}>Подарков не получал</p>
      ) : (
        <>
          <p className={styles.note}>{d.items.counts.map((c) => `${c.status}: ${c.count}`).join(' · ')}</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Подарок</th>
                <th>Цена</th>
                <th>Где сейчас</th>
              </tr>
            </thead>
            <tbody>
              {d.items.list.map((it, i) => (
                <tr key={`${it.gift_id}-${i}`}>
                  <td>
                    {it.name}
                    <br />
                    <span className={styles.muted}>{dateTime(it.at)}</span>
                  </td>
                  <td>{ton(it.price)}</td>
                  <td>{it.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {d.withdrawals.length > 0 && (
        <>
          <h3 className={styles.h3}>Выводы</h3>
          {d.withdrawals.map((w, i) => (
            <div key={i} className={styles.sysRow}>
              <span>
                {w.name}
                <br />
                <span className={styles.muted}>{dateTime(w.at)}</span>
              </span>
              <span className={w.status === 'done' ? styles.good : w.status === 'rejected' ? styles.bad : undefined}>
                {WITHDRAW_STATUS[w.status] ?? w.status}
              </span>
            </div>
          ))}
        </>
      )}

      <h3 className={styles.h3}>История баланса</h3>
      {d.history.length === 0 ? (
        <p className={styles.muted}>Операций ещё не было</p>
      ) : (
        <>
          <p className={styles.note}>Последние {d.history.length} операций: что получил и на что потратил.</p>
          {d.history.map((h, i) => (
            <div key={i} className={styles.sysRow}>
              <span>
                {h.type}
                {h.note && h.note !== h.type ? <span className={styles.muted}> · {h.note}</span> : null}
                <br />
                <span className={styles.muted}>
                  {dateTime(h.at)} · баланс после {ton(h.balance_after)}
                </span>
              </span>
              <span className={h.sign > 0 ? styles.good : styles.bad}>{signedTon(h.sign * h.amount)}</span>
            </div>
          ))}
        </>
      )}
    </>
  )
}

/** Рефералка игрока: банк, сколько друзей пришло и сколько звёзд накоплено, кто из друзей что сделал. */
function ReferralBlock({ r, stars, onOpen }: { r: RefBlock; stars: number; onOpen: (id: string) => void }) {
  const spun = r.friends.filter((f) => f.spun).length
  return (
    <>
      <h3 className={styles.h3}>Рефералка</h3>
      <div className={styles.statGrid}>
        <Stat label="Друзей пришло" value={String(r.friends.length)} />
        <Stat label="Прокрутили FREE" value={String(spun)} />
        <Stat label="Накоплено в банке" value={`${r.bank} ★`} />
        <Stat label="Заработано за друзей" value={`${r.earned_total} ★`} />
        <Stat label="Звёзд на балансе" value={`${stars} ★`} />
        <Stat label="Не в чате" value={String(r.friends_out_of_chat)} tone={r.friends_out_of_chat > 0 ? 'bad' : undefined} />
      </div>
      <p className={styles.note}>
        Ник в профиле: {r.tag_quest.stage === 1 ? 'не начато' : r.tag_quest.stage === 2 ? 'держит 24 часа' : 'ждёт сбора награды'} ·
        забрано раз: {r.tag_quest.total_claimed}
      </p>
      {r.friends.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Друг</th>
              <th>Пришёл</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {r.friends.map((f) => (
              <tr key={f.id}>
                <td>
                  <button type="button" className={styles.linkBtn} onClick={() => onOpen(f.id)}>
                    {f.name}
                  </button>
                  {f.premium ? ' 💎' : ''}
                </td>
                <td>{ago(f.at)}</td>
                <td className={f.not_in_chat ? styles.bad : f.spun ? styles.good : styles.muted}>
                  {f.not_in_chat ? 'не в чате' : f.spun ? 'прокрутил FREE' : 'ждём FREE'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {r.history.length > 0 && (
        <>
          <p className={styles.note}>История банка:</p>
          {r.history.slice(0, 10).map((h, i) => (
            <div key={i} className={styles.sysRow}>
              <span>
                {h.t}
                <br />
                <span className={styles.muted}>{dateTime(h.at / 1000)}</span>
              </span>
              <span className={h.d > 0 ? styles.good : h.d < 0 ? styles.bad : styles.muted}>
                {h.d > 0 ? `+${h.d} ★` : h.d < 0 ? `−${-h.d} ★` : '•'}
              </span>
            </div>
          ))}
        </>
      )}
    </>
  )
}
