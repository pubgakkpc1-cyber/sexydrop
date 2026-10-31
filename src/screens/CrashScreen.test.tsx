import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CrashScreen } from './CrashScreen'
import {
  _resetCrashForTests,
  _setCrashRngForTests,
  isCrashEngineRunning,
  placeGramBet,
} from '../services/demoCrashService'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

/** Прокрутка времени движка внутри act — чтобы React успел отрисовать кадр. */
function advanceEngine(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/games/crash']}>
      <Routes>
        <Route path="/" element={<div>Каталог кейсов</div>} />
        <Route path="/games/crash" element={<CrashScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetCrashForTests()
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  // Подменяем только интервальные таймеры движка: полный fake timers глушит
  // планировщик React (setTimeout) и рендеры перестают флашиться в jsdom.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
})

afterEach(() => {
  _resetCrashForTests()
  vi.useRealTimers()
})

describe('CrashScreen (4.2: UI и состояния раунда)', () => {
  it('монтируется с движком и размонтируется с паузой (ставка не теряется)', () => {
    const { unmount } = renderScreen()
    expect(isCrashEngineRunning()).toBe(true)
    unmount()
    expect(isCrashEngineRunning()).toBe(false)
  })

  it('окно ставок: CTA «Сделать ставку», обратный отсчёт и честная заметка', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: 'Сделать ставку' })).toBeInTheDocument()
    expect(screen.getByText(/Старт через/)).toBeInTheDocument()
    expect(screen.getByText(/множитель растёт плавно/i)).toBeInTheDocument()
  })

  it('CTA открывает шит ставки с переключателем Подарки / TON', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Сделать ставку' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Сделать ставку')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Подарки' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'TON' })).toBeInTheDocument()
  })

  it('ставка через шит: подтверждение видно на экране, шит закрывается', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Сделать ставку' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Поставить 0.1 TON' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ставка принята')).toBeInTheDocument()
    expect(screen.getByText('0.1 TON')).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_900)
  })

  it('полёт: множитель растёт; «Забрать» начисляет выигрыш floor(1000 × 1.41)', async () => {
    _setCrashRngForTests(() => 0.51) // краш x2.00 — позже кешаута
    renderScreen()
    expect(placeGramBet(1000, 'req-bet')).toEqual({ status: 'ok' })

    advanceEngine(5000) // полёт начался
    advanceEngine(2000) // 40 тиков роста → показ 1.41

    const cashoutButton = screen.getByRole('button', { name: /Забрать x1\.41/ })
    await user.click(cashoutButton)

    expect(screen.getByText(/Выигрыш \+1\.4 TON/)).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_410)
  })

  it('краш: «Улетел!», чип истории x2.0, «Ставка сгорела»', () => {
    _setCrashRngForTests(() => 0.51)
    renderScreen()
    expect(placeGramBet(1000, 'req-bet')).toEqual({ status: 'ok' })

    advanceEngine(5000 + 4200) // окно ставок + полёт до краша

    expect(screen.getByText('Улетел!')).toBeInTheDocument()
    // «x2.00» — и на полотне (краш), и в чипе истории
    expect(screen.getAllByText('x2.00')).toHaveLength(2)
    expect(screen.getByText('Ставка сгорела')).toBeInTheDocument()
  })

  it('полёт без ставки — честная подсказка, без выдуманных игроков', () => {
    _setCrashRngForTests(() => 0.51)
    renderScreen()
    advanceEngine(5000)

    expect(screen.getByText(/Поставить на след. раунд/)).toBeInTheDocument()
    expect(screen.getByText(/Ставки других игроков раунда обновляются/i)).toBeInTheDocument()
  })
})
