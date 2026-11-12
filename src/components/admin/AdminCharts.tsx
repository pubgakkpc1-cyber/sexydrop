import { useId } from 'react'
import styles from './AdminCharts.module.css'

export interface ChartPoint {
  label: string
  value: number
}

/** Красиво округлённое верхнее значение оси: 0…max. */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v)))

/** Линейный график с заливкой: матовые цвета, сетка, подписи дней, значение последней точки. */
export function AreaChart({
  points,
  color = '#c35c61',
  format = compact,
  height = 150,
}: {
  points: ChartPoint[]
  color?: string
  format?: (v: number) => string
  height?: number
}) {
  const gid = useId().replace(/:/g, '')
  const W = 320
  const H = height
  const padL = 4
  const padR = 4
  const padT = 14
  const padB = 20
  if (points.length === 0) return <div className={styles.empty}>Данных пока нет</div>
  const max = niceMax(Math.max(...points.map((p) => p.value)))
  const step = points.length > 1 ? (W - padL - padR) / (points.length - 1) : 0
  const x = (i: number) => padL + (points.length > 1 ? i * step : (W - padL - padR) / 2)
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z`
  const last = points[points.length - 1]!
  const labelEvery = Math.ceil(points.length / 7)
  return (
    <div className={styles.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="График" preserveAspectRatio="none" className={styles.svg} style={{ height }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((k) => (
          <line key={k} x1={padL} x2={W - padR} y1={padT + k * (H - padT - padB)} y2={padT + k * (H - padT - padB)} className={styles.grid} />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 3.6 : 2} fill={i === points.length - 1 ? '#fff' : color} />
        ))}
      </svg>
      <div className={styles.axis}>
        {points.map((p, i) => (
          <span key={i} className={styles.tick} style={{ visibility: i % labelEvery === 0 || i === points.length - 1 ? 'visible' : 'hidden' }}>
            {p.label}
          </span>
        ))}
      </div>
      <div className={styles.chartMeta}>
        <span>пик {format(max)}</span>
        <b style={{ color }}>сегодня {format(last.value)}</b>
      </div>
    </div>
  )
}

export interface Slice {
  label: string
  value: number
  color: string
  sub?: string
}

/** Кольцевая диаграмма с итогом в центре и легендой (сколько, доля, подпись). */
export function DonutChart({ slices, center, centerNote, format = compact }: { slices: Slice[]; center: string; centerNote: string; format?: (v: number) => string }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const R = 46
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut}>
        <svg viewBox="0 0 120 120" role="img" aria-label="Диаграмма">
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" />
          {total > 0 &&
            slices.map((s) => {
              const len = (s.value / total) * C
              const el = (
                <circle
                  key={s.label}
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 60 60)"
                />
              )
              offset += len
              return el
            })}
        </svg>
        <div className={styles.donutCenter}>
          <strong>{center}</strong>
          <span>{centerNote}</span>
        </div>
      </div>
      <ul className={styles.legend}>
        {slices.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span className={styles.legendName}>
              {s.label}
              {s.sub && <small>{s.sub}</small>}
            </span>
            <b>{format(s.value)}</b>
            <em>{total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%'}</em>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface BarRow {
  label: string
  value: number
  color?: string
  note?: string
}

/** Горизонтальные полосы: сравнение игр, кейсов, способов оплаты. */
export function HBars({ rows, format = compact, color = '#c35c61' }: { rows: BarRow[]; format?: (v: number) => string; color?: string }) {
  if (rows.length === 0) return <div className={styles.empty}>Данных пока нет</div>
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)))
  return (
    <ul className={styles.hbars}>
      {rows.map((r) => (
        <li key={r.label}>
          <div className={styles.hbarHead}>
            <span>{r.label}</span>
            <b>{format(r.value)}</b>
          </div>
          <div className={styles.hbarTrack}>
            <span className={styles.hbarFill} style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%`, background: r.color ?? color }} />
          </div>
          {r.note && <small className={styles.hbarNote}>{r.note}</small>}
        </li>
      ))}
    </ul>
  )
}
