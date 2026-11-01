import { useMemo, useState } from 'react'
import { cases, giftById, isTonPrize, type CaseDefinition } from '../../data/catalog'
import { allItemIds, saveCaseOdds } from '../../lib/caseOdds'
import { pickWeighted } from '../../lib/caseMath'
import { formatMinor } from '../../lib/money'
import styles from './AdminPanel.module.css'

/** Приз кейса: один подарок (все его фоны/модели вместе) или сумма в TON. */
interface Group {
  name: string
  priceMinor: number
  itemIds: string[]
  /** доля в процентах, сумма по кейсу = 100 */
  pct: number
}

const TOTAL_WEIGHT = 1_000_000
const PROFIT_STEPS = [50, 100, 250, 500, 750, 1000]

function itemInfo(itemId: string): { name: string; priceMinor: number } | null {
  if (isTonPrize(itemId)) {
    const amount = Number(itemId.slice(4))
    return { name: `${formatMinor(amount)} TON`, priceMinor: amount }
  }
  const gift = giftById.get(itemId)
  return gift ? { name: gift.name, priceMinor: gift.priceMinor } : null
}

/** Группы призов кейса по текущим весам (убранные из кейса призы показываются с 0%). */
function groupsOf(def: CaseDefinition): Group[] {
  const current = new Map(def.entries.map((e) => [e.itemId, e.weight]))
  const total = def.entries.reduce((s, e) => s + e.weight, 0)
  const byName = new Map<string, Group>()
  for (const itemId of allItemIds(def.id)) {
    const info = itemInfo(itemId)
    if (!info) continue
    const pct = ((current.get(itemId) ?? 0) / total) * 100
    const prev = byName.get(info.name)
    if (prev) {
      prev.itemIds.push(itemId)
      prev.pct += pct
    } else {
      byName.set(info.name, { ...info, itemIds: [itemId], pct })
    }
  }
  return [...byName.values()].sort((a, b) => b.priceMinor - a.priceMinor)
}

/** Ставит призу нужный процент, остальные пропорционально подгоняются так, чтобы сумма осталась 100%. */
function withPct(groups: Group[], name: string, wanted: number): Group[] {
  const pct = Math.min(100, Math.max(0, wanted))
  const others = groups.filter((g) => g.name !== name)
  const othersSum = others.reduce((s, g) => s + g.pct, 0)
  const rest = 100 - pct
  return groups.map((g) => {
    if (g.name === name) return { ...g, pct: others.length === 0 ? 100 : pct }
    return { ...g, pct: othersSum > 0 ? (g.pct / othersSum) * rest : rest / others.length }
  })
}

/** Проценты → целые веса предметов (внутри приза — пропорционально текущим весам вариантов). */
function toWeights(def: CaseDefinition, groups: Group[]): Record<string, number> {
  const current = new Map(def.entries.map((e) => [e.itemId, e.weight]))
  const out: Record<string, number> = {}
  for (const g of groups) {
    if (g.pct <= 0) continue
    const groupWeight = Math.max(1, Math.round((g.pct / 100) * TOTAL_WEIGHT))
    const shares = g.itemIds.map((id) => current.get(id) ?? 0)
    const sum = shares.reduce((s, w) => s + w, 0)
    g.itemIds.forEach((id, i) => {
      const part = sum > 0 ? (shares[i] ?? 0) / sum : 1 / g.itemIds.length
      const w = Math.round(groupWeight * part)
      if (w > 0) out[id] = w
    })
  }
  return out
}

function evOf(groups: Group[]): number {
  return groups.reduce((s, g) => s + (g.pct / 100) * g.priceMinor, 0)
}

function fmtPct(v: number): string {
  if (v === 0) return '0'
  const fixed = v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

interface CaseEditorProps {
  def: CaseDefinition
  onSaved: () => void
}

function CaseEditor({ def, onSaved }: CaseEditorProps) {
  const [groups, setGroups] = useState<Group[]>(() => groupsOf(def))
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [sim, setSim] = useState<{ counts: Map<string, number>; spent: number; won: number } | null>(null)
  const free = def.freeCooldownMs !== null

  const ev = evOf(groups)
  const rtp = free || def.priceMinor === 0 ? null : (ev / def.priceMinor) * 100
  const profit = def.priceMinor - ev
  const beatCase = groups.filter((g) => g.priceMinor > def.priceMinor).reduce((s, g) => s + g.pct, 0)
  const atLeastBack = groups.filter((g) => g.priceMinor >= def.priceMinor).reduce((s, g) => s + g.pct, 0)

  const edit = (name: string, value: string) => {
    const n = Number(value.replace(',', '.'))
    if (!Number.isFinite(n)) return
    setGroups((g) => withPct(g, name, n))
    setDirty(true)
    setStatus(null)
    setSim(null)
  }

  const active = groups.filter((g) => g.pct > 0).length
  /** Убрать приз из кейса (шанс 0, остальные подстроятся) или вернуть его с шансом 1%. */
  const toggle = (g: Group) => {
    setGroups((all) => withPct(all, g.name, g.pct > 0 ? 0 : 1))
    setDirty(true)
    setStatus(null)
    setSim(null)
  }

  const save = async () => {
    const err = await saveCaseOdds(def.id, toWeights(def, groups))
    setStatus(err ? { ok: false, text: err } : { ok: true, text: 'Сохранено — у игроков действует со следующего запуска' })
    if (!err) {
      setDirty(false)
      onSaved()
    }
  }

  const reset = async () => {
    const err = await saveCaseOdds(def.id, null)
    if (err) {
      setStatus({ ok: false, text: err })
      return
    }
    setGroups(groupsOf(def))
    setDirty(false)
    setSim(null)
    setStatus({ ok: true, text: 'Возвращены стандартные шансы' })
    onSaved()
  }

  const simulate = () => {
    const entries = groups.map((g) => ({ g, weight: g.pct }))
    const counts = new Map<string, number>()
    let won = 0
    const runs = 1000
    for (let i = 0; i < runs; i++) {
      const hit = pickWeighted(entries).g
      counts.set(hit.name, (counts.get(hit.name) ?? 0) + 1)
      won += hit.priceMinor
    }
    setSim({ counts, spent: runs * def.priceMinor, won })
  }

  return (
    <div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Приз</th>
            <th>Цена</th>
            <th>Шанс, %</th>
            <th>{sim ? 'Выпало' : 'На 1000'}</th>
            <th aria-label="Убрать из кейса" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.name} className={g.pct > 0 ? undefined : styles.removed}>
              <td>{g.name}</td>
              <td>{formatMinor(g.priceMinor)}</td>
              <td>
                <input
                  key={g.pct}
                  className={styles.pctInput}
                  inputMode="decimal"
                  aria-label={`Шанс ${g.name}`}
                  defaultValue={fmtPct(g.pct)}
                  onBlur={(e) => edit(g.name, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              </td>
              <td>{sim ? (sim.counts.get(g.name) ?? 0) : (g.pct * 10).toFixed(g.pct * 10 < 1 ? 2 : 1)}</td>
              <td>
                <button
                  type="button"
                  className={styles.rowBtn}
                  disabled={g.pct > 0 && active <= 1}
                  aria-label={`${g.pct > 0 ? 'Убрать' : 'Вернуть'} ${g.name}`}
                  onClick={() => toggle(g)}
                >
                  {g.pct > 0 ? '✕' : 'Вернуть'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.note}>
        Впишите нужный шанс призу — остальные сами подстроятся, чтобы в сумме было 100%.
      </p>
      <div className={styles.sumRow}>
        <strong className={profit >= 0 ? styles.good : styles.bad}>
          {free
            ? `Расход на 1 открытие: ${formatMinor(Math.round(ev))} TON`
            : `Заработок с 1 открытия: ${profit >= 0 ? '+' : '−'}${formatMinor(Math.round(Math.abs(profit)))} TON`}
        </strong>
        <span>{rtp !== null ? `Возврат игрокам (RTP): ${rtp.toFixed(1)}%` : `Средний выигрыш: ${formatMinor(Math.round(ev))}`}</span>
        {!free && <span>Дороже кейса: {fmtPct(beatCase)}%</span>}
        {!free && <span>Хотя бы вернуть цену: {fmtPct(atLeastBack)}%</span>}
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Открытий</th>
            <th>Грязная (приход)</th>
            <th>Выплаты</th>
            <th>Чистая</th>
          </tr>
        </thead>
        <tbody>
          {PROFIT_STEPS.map((n) => {
            const net = n * profit
            return (
              <tr key={n}>
                <td>{n}</td>
                <td>{formatMinor(n * def.priceMinor)}</td>
                <td>{formatMinor(Math.round(n * ev))}</td>
                <td className={net >= 0 ? styles.good : styles.bad}>
                  {net >= 0 ? '+' : '−'}
                  {formatMinor(Math.round(Math.abs(net)))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sim && !free && (
        <p className={styles.note}>
          1000 открытий: потрачено {formatMinor(sim.spent)}, выиграно {formatMinor(sim.won)} → казна{' '}
          {sim.won <= sim.spent ? '+' : '−'}
          {formatMinor(Math.abs(sim.spent - sim.won))} TON
        </p>
      )}
      {status && <p className={`${styles.note} ${status.ok ? styles.good : styles.bad}`}>{status.text}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.refresh} onClick={simulate}>
          Прогнать 1000 открытий
        </button>
        <button type="button" className={styles.refresh} disabled={!dirty} onClick={() => void save()}>
          Сохранить
        </button>
        <button type="button" className={styles.refresh} onClick={() => void reset()}>
          Сбросить к стандарту
        </button>
      </div>
    </div>
  )
}

/** Шансы выпадения по всем кейсам: «впиши процент», RTP и прогноз выпадений. */
export function AdminChancesTab() {
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [rev, setRev] = useState(0)
  const list = useMemo(
    () =>
      cases
        .filter((c) => query.trim() === '' || c.name.toLowerCase().includes(query.trim().toLowerCase()))
        .map((def) => ({ def, ev: evOf(groupsOf(def)) }))
        .sort((a, b) => a.def.priceMinor - b.def.priceMinor),
    // rev: после сохранения веса кейса меняются на месте
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, rev],
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
        Откройте кейс, впишите шанс нужным призам или уберите лишние (✕) и нажмите «Сохранить». RTP — средний возврат игроку от
        цены кейса (у бесплатных показан средний выигрыш).
      </p>
      {list.map(({ def, ev }) => {
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
            {isOpen && <CaseEditor def={def} onSaved={() => setRev((r) => r + 1)} />}
          </div>
        )
      })}
      {list.length === 0 && <p className={styles.muted}>Ничего не найдено</p>}
    </div>
  )
}
