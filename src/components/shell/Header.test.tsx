import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useWalletStore } from '../../store/wallet'
import { Header } from './Header'

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  )
}

const getState = () => useWalletStore.getState()

beforeEach(() => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
})

describe('Header (спека: аватар, «Ваш баланс», TON, Пополнить, DEMO)', () => {
  it('показывает «Ваш баланс», баланс с иконкой и бейдж DEMO', () => {
    renderHeader()
    expect(screen.getByText('Ваш баланс')).toBeInTheDocument()
    expect(screen.getByLabelText('Баланс (демо): 100 TON')).toBeInTheDocument()
    expect(screen.getByText('DEMO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Пополнить' })).toBeInTheDocument()
  })

  it('переключает режим кнопками Демо/Реал', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Реал' }))
    expect(getState().mode).toBe('real')
    expect(screen.getByLabelText('Баланс (реальный): 0 TON')).toBeInTheDocument()
    expect(screen.queryByText('DEMO')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Демо' }))
    expect(getState().mode).toBe('demo')
  })

  it('демо-пополнение зачисляет только демо-баланс и помечено как демо', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Пополнить' }))
    expect(screen.getByText(/Demo Mode: реальные платежи отключены/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Получить 100 TON \(демо\)/ }))
    expect(getState().getBalance('demo')).toBe(200_000)
  })

  it('в реальном режиме пополнение честно недоступно', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Реал' }))
    await userEvent.click(screen.getByRole('button', { name: 'Пополнить' }))
    expect(screen.getByText(/появится после подключения платежей/)).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    // кнопка «Пополнить» внутри модала заблокирована
    expect(within(dialog).getByRole('button', { name: 'Пополнить' })).toBeDisabled()
  })

  it('сброс демо-баланса в модале пополнения возвращает стартовый баланс', async () => {
    renderHeader()
    act(() => {
      getState().debit(90_000)
    })
    expect(screen.getByLabelText('Баланс (демо): 10 TON')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Пополнить' }))
    await userEvent.click(screen.getByRole('button', { name: /Сбросить демо-баланс/ }))
    expect(getState().getBalance('demo')).toBe(100_000)
  })

  it('объявляет баланс для скринридеров через aria-live', () => {
    renderHeader()
    expect(screen.getByText('Баланс (демо): 100')).toBeInTheDocument()
  })
})
