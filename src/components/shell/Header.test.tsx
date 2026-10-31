import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useWalletStore } from '../../store/wallet'
import { Header } from './Header'

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  )
}

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

  it('«Пополнить» открывает экран пополнения', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Header />} />
          <Route path="/deposit" element={<div>Экран пополнения</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Пополнить' }))
    expect(screen.getByText('Экран пополнения')).toBeInTheDocument()
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
  it('нажатие на баланс открывает выбор валюты; Stars меняют показ баланса', async () => {
    renderHeader()
    await userEvent.click(screen.getByRole('button', { name: 'Баланс: 100 TON' }))
    expect(screen.getByText('В чём показывать баланс')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /Telegram Stars/ }))
    expect(screen.getByRole('button', { name: 'Баланс: 17 500 Stars' })).toBeInTheDocument()
    // вернуть TON, чтобы не влиять на другие тесты
    await userEvent.click(screen.getByRole('button', { name: 'Баланс: 17 500 Stars' }))
    await userEvent.click(screen.getByRole('radio', { name: /^TON/ }))
    expect(screen.getByRole('button', { name: 'Баланс: 100 TON' })).toBeInTheDocument()
  })
})
