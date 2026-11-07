import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminApi'
import { cx } from '../../lib/cx'
import { PlayerAvatar } from './AdminAvatar'
import { ago, dateTime, signedTon, ton } from './adminFormat'
import styles from './AdminPanel.module.css'

interface PlayerDetail {
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
  }
  withdrawals: Array<{ name: string; status: string; at: number; done_at: number | null }>
  deposits: Array<{ method: string; amount: number; at: number }>
  history: Array<{ at: number; type: string; sign: 1 | -1; amount: number; balance_after: number; note: string | null }>
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
        setD(r.data)
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
