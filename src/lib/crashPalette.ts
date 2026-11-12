/**
 * Цвета Ракетки — сняты с эталонной записи точными замерами пикселей (матовые, без свечения).
 * - плашки истории: красная (<1.2), зелёная (1.2–2), синяя (2–10), золотая (от 10);
 * - живая плашка и линия следа плавно меняют цвет по множителю: зелёный → бирюзовый → синий → фиолетовый → розово-сиреневый → оранжевый;
 * - крупное число после краша: красное (<1.2), зелёное, янтарное (от 10).
 */
export interface ChipColors {
  border: string
  text: string
  fill: string
}

export function historyChip(mult: number): ChipColors {
  if (mult >= 10) return { border: '#694815', text: '#f3e393', fill: '#443214' }
  if (mult >= 2) return { border: '#335180', text: '#c1d7f6', fill: '#1f2e44' }
  if (mult >= 1.2) return { border: '#1f5c31', text: '#c0f1d3', fill: '#183a24' }
  return { border: '#844f50', text: '#fbc8c9', fill: '#432021' }
}

export function bigMultColor(mult: number): string {
  if (mult >= 10) return '#f59d0b'
  if (mult >= 1.2) return '#21c45d'
  return '#ed4243'
}

type Rgb = readonly [number, number, number]

/** множитель → цвет рамки живой плашки, её заливка (замер эталона) */
const LIVE_CHIP: ReadonlyArray<readonly [number, Rgb, Rgb]> = [
  [1.0, [0x20, 0x98, 0x57], [0x1a, 0x45, 0x2c]],
  [1.13, [0x21, 0x8e, 0x63], [0x1a, 0x44, 0x2f]],
  [1.31, [0x25, 0x87, 0x76], [0x1c, 0x41, 0x37]],
  [1.55, [0x2b, 0x84, 0x88], [0x1e, 0x3d, 0x41]],
  [1.88, [0x31, 0x75, 0x99], [0x20, 0x37, 0x4d]],
  [2.26, [0x3a, 0x6e, 0xaf], [0x23, 0x34, 0x55]],
  [2.7, [0x47, 0x6b, 0xbf], [0x26, 0x33, 0x55]],
  [3.18, [0x4f, 0x65, 0xae], [0x2a, 0x31, 0x54]],
  [3.72, [0x5a, 0x60, 0xaf], [0x2d, 0x2f, 0x54]],
  [4.29, [0x6b, 0x5b, 0xbe], [0x32, 0x2c, 0x55]],
  [4.93, [0x6d, 0x53, 0xb0], [0x37, 0x2a, 0x54]],
  [5.57, [0x7a, 0x59, 0x9f], [0x3a, 0x2b, 0x50]],
  [6.28, [0x8a, 0x62, 0x96], [0x3e, 0x2e, 0x46]],
  [7.02, [0x89, 0x67, 0x80], [0x42, 0x30, 0x3d]],
  [7.81, [0x95, 0x6e, 0x6f], [0x46, 0x33, 0x31]],
  [8.57, [0xa5, 0x7b, 0x4e], [0x4b, 0x35, 0x29]],
  [9.42, [0xa8, 0x82, 0x2c], [0x50, 0x39, 0x1e]],
]

/** множитель → цвет линии следа (замер эталона) */
export const TRAIL_STOPS: ReadonlyArray<readonly [number, Rgb]> = [
  [1.0, [38, 167, 108]],
  [1.31, [39, 158, 128]],
  [1.55, [45, 145, 161]],
  [1.88, [52, 121, 199]],
  [2.26, [59, 113, 214]],
  [2.7, [71, 107, 217]],
  [3.18, [81, 101, 211]],
  [3.72, [92, 93, 211]],
  [4.29, [106, 87, 210]],
  [4.93, [115, 80, 202]],
  [5.57, [128, 86, 184]],
  [6.28, [148, 92, 164]],
  [7.81, [177, 115, 98]],
  [8.57, [180, 118, 69]],
  [9.42, [191, 125, 36]],
  [12, [197, 129, 20]],
]

function mix(a: Rgb, b: Rgb, k: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

function pick<T>(table: ReadonlyArray<readonly [number, T]>, mult: number, blend: (a: T, b: T, k: number) => T): T {
  if (mult <= table[0]![0]) return table[0]![1]
  for (let i = 1; i < table.length; i += 1) {
    const [m1, v1] = table[i]!
    if (mult <= m1) {
      const [m0, v0] = table[i - 1]!
      return blend(v0, v1, (mult - m0) / (m1 - m0))
    }
  }
  return table[table.length - 1]![1]
}

export function trailRgb(mult: number): [number, number, number] {
  return [...pick(TRAIL_STOPS, mult, mix as (a: Rgb, b: Rgb, k: number) => Rgb)] as [number, number, number]
}

const hex = (c: Rgb) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** Цвета живой плашки с множителем в полёте. */
export function liveChip(mult: number): ChipColors {
  if (mult >= 9.42) {
    return mult >= 10
      ? { border: '#a8822c', text: '#fefaf8', fill: '#50391e' }
      : { border: hex(LIVE_CHIP[16]![1]), text: '#fefaf8', fill: hex(LIVE_CHIP[16]![2]) }
  }
  const border = pick(LIVE_CHIP.map((r) => [r[0], r[1]] as const), mult, mix as (a: Rgb, b: Rgb, k: number) => Rgb)
  const fill = pick(LIVE_CHIP.map((r) => [r[0], r[2]] as const), mult, mix as (a: Rgb, b: Rgb, k: number) => Rgb)
  return { border: hex(border), text: '#fafdfd', fill: hex(fill) }
}
