import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DepositScreen } from './DepositScreen'
import { useWalletStore } from '../store/wallet'
import { STARS_PER_TON, TON_PER_STAR_LABEL, isValidStars, parseStars, starsToMinor } from '../lib/stars'

const user = userEvent.setup()

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/deposit']}>
      <DepositScreen />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
})

describe('lib/stars (курс Stars → TON)', () => {
  it('175 Stars = 1 TON: 175 Stars = 1000 minor, округление вниз', () => {
    expect(STARS_PER_TON).toBe(175)
    expect(starsToMinor(175)).toBe(1000)
    expect(starsToMinor(10)).toBe(57)
    expect(TON_PER_STAR_LABEL).toBe('0.0057')
    expect(starsToMinor(0)).toBe(0)
    expect(starsToMinor(-5)).toBe(0)
  })

  it('парсинг и границы 10–10 000', () => {
    expect(parseStars('1 500')).toBe(1500)
    expect(parseStars('12.5')).toBeNull()
    expect(parseStars('abc')).toBeNull()
    expect(isValidStars(9)).toBe(false)
    expect(isValidStars(10)).toBe(true)
    expect(isValidStars(10_000)).toBe(true)
    expect(isValidStars(10_001)).toBe(false)
  })
})

describe('DepositScreen (пополнение баланса)', () => {
  it('пять вкладок: TON, Крипто Бот, Stars, Подарки, Конвертер', () => {
    renderScreen()
    for (const name of ['TON', 'Крипто Бот', 'Stars', 'Подарки', 'Конвертер']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('tab', { name: 'TON' })).toHaveAttribute('aria-selected', 'true')
  })

  it('TON: «Пополнить» неактивна до 0.1 TON, быстрые суммы складываются, баланс растёт', async () => {
    renderScreen()
    const submit = screen.getByRole('button', { name: 'Пополнить' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText(/Сумма/), '0.05')
    expect(submit).toBeDisabled()

    await user.clear(screen.getByLabelText(/Сумма/))
    await user.click(screen.getByRole('button', { name: '+10 TON' }))
    await user.click(screen.getByRole('button', { name: '+1 TON' }))
    expect(screen.getByLabelText(/Сумма/)).toHaveValue('11')
    await user.click(submit)
    expect(useWalletStore.getState().getBalance()).toBe(111_000)
    expect(screen.getByRole('status')).toHaveTextContent('Баланс пополнен на 11 TON')
  })

  it('Stars: показывает сколько TON получите и зачисляет по курсу', async () => {
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Stars' }))
    const submit = screen.getByRole('button', { name: 'Пополнить' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText(/Количество Stars/), '350')
    expect(screen.getByText(/Вы получите/)).toHaveTextContent('2 TON')
    expect(screen.getByText(/1 Star =/)).toHaveTextContent('0.0057 TON')
    await user.click(submit)
    expect(useWalletStore.getState().getBalance()).toBe(102_000)
  })

  it('Stars: меньше 10 — кнопка недоступна', async () => {
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Stars' }))
    await user.type(screen.getByLabelText(/Количество Stars/), '9')
    expect(screen.getByRole('button', { name: 'Пополнить' })).toBeDisabled()
  })

  it('Конвертировать: пересчёт Stars → TON и зачисление', async () => {
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Конвертер' }))
    expect(screen.getByRole('button', { name: 'Конвертировать' })).toBeDisabled()

    await user.type(screen.getByLabelText('Количество Stars'), '1050')
    expect(screen.getByLabelText('Получите TON')).toHaveTextContent('6')
    expect(screen.getByText(/1 Star =/)).toHaveTextContent('0.0057 TON')
    await user.click(screen.getByRole('button', { name: 'Конвертировать' }))
    expect(useWalletStore.getState().getBalance()).toBe(106_000)
  })

  it('Подарки: шаги раскрываются, приём подарков честно недоступен', async () => {
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Подарки' }))
    expect(screen.getByText('Пополнить подарками')).toBeInTheDocument()
    expect(screen.getByText('Отправьте подарок')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Приём подарков скоро' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Как это работает/ }))
    expect(screen.queryByText('Отправьте подарок')).not.toBeInTheDocument()
  })
})
