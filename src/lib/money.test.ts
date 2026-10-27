import { describe, expect, it } from 'vitest'
import { addMinor, formatMinor, mulBps, mulByMultiplier, subMinor, toMinor } from './money'

describe('toMinor (1 GRAM = 1000 minor)', () => {
  it('парсит строку без float-погрешности', () => {
    expect(toMinor('0.1')).toBe(100)
    expect(toMinor('7.77')).toBe(7770)
    expect(toMinor('10.555')).toBe(10555)
    expect(toMinor('100')).toBe(100000)
  })

  it('обрезает точность за пределами 3 знаков (вниз)', () => {
    expect(toMinor('1.9999')).toBe(1999)
    expect(toMinor('0.0099')).toBe(9)
  })

  it('принимает запятую как разделитель', () => {
    expect(toMinor('12,34')).toBe(12340)
  })

  it('отклоняет отрицательные и мусор', () => {
    expect(() => toMinor('-1')).toThrow()
    expect(() => toMinor('abc')).toThrow()
  })
})

describe('formatMinor — без фиктивной точности', () => {
  it('отбрасывает хвостовые нули', () => {
    expect(formatMinor(0)).toBe('0')
    expect(formatMinor(100000)).toBe('100')
    expect(formatMinor(7770)).toBe('7.77')
    expect(formatMinor(100)).toBe('0.1')
    expect(formatMinor(9)).toBe('0.009')
    expect(formatMinor(105)).toBe('0.105')
    expect(formatMinor(1234567)).toBe('1234.567')
  })
})

describe('addMinor / subMinor', () => {
  it('складывает целые', () => {
    expect(addMinor(1000, 2500)).toBe(3500)
  })

  it('вычитание не допускает овердрафт', () => {
    expect(() => subMinor(1000, 1001)).toThrow(/Insufficient funds/)
    expect(subMinor(1000, 1000)).toBe(0)
  })
})

describe('mulByMultiplier', () => {
  it('округляет выплату вниз', () => {
    expect(mulByMultiplier(1000, 1.5)).toBe(1500)
    expect(mulByMultiplier(1000, 0.98)).toBe(980)
    // 1000 * 2.69999 -> 2699, а не 2700
    expect(mulByMultiplier(1000, 2.69999)).toBe(2699)
  })
})

describe('mulBps', () => {
  it('умножает на базисные пункты с округлением вниз', () => {
    expect(mulBps(10_000, 9800)).toBe(9800)
    expect(mulBps(999, 5000)).toBe(499) // 49.95 -> 49
  })
})
