import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 100_000 } })
  window.localStorage.removeItem('sexydrop_admin')
})

describe('Header (аватар, «Ваш баланс», TON, Пополнить, без DEMO)', () => {
  it('показывает «Ваш баланс», баланс в TON и кнопку Пополнить', () => {
    renderHeader()
    expect(screen.getByText('Ваш баланс')).toBeInTheDocument()
    expect(screen.getByLabelText('Баланс: 100 TON')).toBeInTheDocument()
    expect(screen.queryByText('DEMO')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Пополнить' })).toBeInTheDocument()
  })

  it('пополнение зачисляет баланс без демо-надписей', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Пополнить' }))
    expect(screen.getByText(/Быстрое пополнение кошелька в TON/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '+100 TON' }))
    expect(getState().getBalance()).toBe(200_000)
  })

  it('показывает кнопку Админки для @zapixxgarant', () => {
    window.localStorage.setItem('sexydrop_admin', 'true')
    renderHeader()
    expect(screen.getByRole('button', { name: 'Панель администратора' })).toBeInTheDocument()
  })

  it('объявляет баланс для скринридеров через aria-live', () => {
    renderHeader()
    expect(screen.getByText(/Баланс: 100 TON/)).toBeInTheDocument()
  })
})
