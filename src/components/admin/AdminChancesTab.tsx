import { useMemo, useState } from 'react'
import { cases, giftById } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import styles from './AdminPanel.module.css'

interface Row {
  id: string
  name: string
  chance: number
  priceMinor: number
}

function analyse(caseId: string) {
  const def = cases.find((c) => c.id === caseId)!
  const total = def.entries.reduce((s, e) => s + e.weight, 0)
  // один и тот же подарок может идти несколькими видами (фон/модель): суммируем шансы по названию
  const byName = new Map<string, Row>()
  let ev = 0
  for (const e of def.entries) {
    const gift = giftById.get(e.itemId)
    if (!gift) continue
    const chance = e.weight / total
    ev += chance * gift.priceMinor
    const prev = byName.get(gift.name)
    if (prev) prev.chance += chance
    else byName.set(gift.name, { id: gift.id, name: gift.name, chance, priceMinor: gift.priceMinor })
  }
  const rows = [...byName.values()].sort((a, b) => b.priceMinor - a.priceMinor)
  return { def, rows, ev, total }
}

/** Шансы выпадения по всем кейсам: цена, EV, возврат (RTP) и таблица предметов. */
export function AdminChancesTab() {
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const list = useMemo(
    () =>
      cases
        .map((c) => ({ ...analyse(c.id) }))
        .filter((a) => query.trim() === '' || a.def.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.def.priceMinor - b.def.priceMinor),
    [query],
  )

  return (
    <div className={styles.tab}>
      <input
        className={styles.search}
        type="search"
        placeholder="Поиск кейса"
        aria-label="Поиск кейса"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className={styles.note}>
        Шансы считаются из реальных весов кейсов. RTP — средний возврат игроку от цены кейса; для
        бесплатных кейсов показан только средний выигрыш.
      </p>
      {list.map(({ def, rows, ev }) => {
        const free = def.freeCooldownMs !== null
        const rtp = free || def.priceMinor === 0 ? null : (ev / def.priceMinor) * 100
        const isOpen = open === def.id
        return (
          <div key={def.id} className={styles.caseBlock}>
            <button
              type="button"
              className={styles.caseHead}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : def.id)}
            >
              <span className={styles.caseName}>{def.name}</span>
              <span className={styles.caseMeta}>
                {free ? 'Бесплатный' : `${formatMinor(def.priceMinor)} TON`}
                {' · '}
                {rtp !== null ? `RTP ${rtp.toFixed(1)}%` : `EV ${formatMinor(Math.round(ev))}`}
              </span>
            </button>
            {isOpen && (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Приз</th>
                    <th>Цена</th>
                    <th>Шанс</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{formatMinor(r.priceMinor)}</td>
                      <td>{(r.chance * 100).toFixed(r.chance < 0.01 ? 3 : 2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
      {list.length === 0 && <p className={styles.muted}>Ничего не найдено</p>}
    </div>
  )
}
