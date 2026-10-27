/**
 * Денежные операции. Все суммы — целые минорные единицы GRAM.
 * 1 GRAM = 1000 minor (миллиграмы): референсный продукт показывает точность
 * до 0.009 GRAM. Плавающая точка для денег запрещена: парсинг только через строку.
 */

/** Сумма в минорных единицах. Всегда целое число >= 0 для балансов. */
export type Minor = number

/** Внутренняя валюта приложения — TON. */
export const CURRENCY = 'TON'

export const MINOR_PER_MAJOR = 1000

const MINOR_DIGITS = 3

function assertInt(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer, got: ${value}`)
  }
}

/** Парсит крупную сумму в минорные единицы. Лишняя точность обрезается (в пользу казны). */
export function toMinor(major: string | number): Minor {
  const s = String(major).trim().replace(',', '.')
  if (!/^\d+(\.\d{1,})?$/.test(s)) {
    throw new Error(`Invalid amount: ${major}`)
  }
  const [intPart, fracPart = ''] = s.split('.')
  const padded = (fracPart + '0'.repeat(MINOR_DIGITS)).slice(0, MINOR_DIGITS)
  return Number(intPart) * MINOR_PER_MAJOR + Number(padded)
}

/**
 * Форматирует минорные единицы без фиктивной точности (спека 5.3):
 * хвостовые нули отбрасываются — 1000 → "1", 7770 → "7.77", 9 → "0.009".
 */
export function formatMinor(minor: Minor): string {
  assertInt(minor, 'minor')
  if (minor < 0) throw new Error(`Negative amounts are not formattable: ${minor}`)
  const intPart = Math.floor(minor / MINOR_PER_MAJOR)
  const frac = String(minor % MINOR_PER_MAJOR).padStart(MINOR_DIGITS, '0').replace(/0+$/, '')
  return frac ? `${intPart}.${frac}` : `${intPart}`
}

export function addMinor(a: Minor, b: Minor): Minor {
  assertInt(a, 'a')
  assertInt(b, 'b')
  return a + b
}

export function subMinor(a: Minor, b: Minor): Minor {
  assertInt(a, 'a')
  assertInt(b, 'b')
  if (b > a) throw new Error(`Insufficient funds: ${a} < ${b}`)
  return a - b
}

/**
 * Умножение на множитель с точностью до 4 знаков (коэффициенты Dice/Mines).
 * Округление — вниз, в пользу казны: floor(a * mult * 10000) / 10000.
 */
export function mulByMultiplier(a: Minor, multiplier: number): Minor {
  assertInt(a, 'a')
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new Error(`Invalid multiplier: ${multiplier}`)
  }
  // mult*10000 может быть дробным (mult имеет >4 знаков после вычислений) — режем его до 4 знаков вниз.
  const scaled = Math.floor(multiplier * 10000)
  return Math.floor((a * scaled) / 10000)
}

/**
 * Умножение на долю в базисных пунктах: mulBps(10000, 9800) === 9800 (98%).
 * Округление — вниз.
 */
export function mulBps(a: Minor, bps: number): Minor {
  assertInt(a, 'a')
  assertInt(bps, 'bps')
  if (bps < 0) throw new Error(`Invalid bps: ${bps}`)
  return Math.floor((a * bps) / 10000)
}
