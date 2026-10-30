import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BetSheet } from './BetSheet'
import { useCrashStore } from '../../store/crash'
import { useInventoryStore } from '../../store/inventory'
import { useWalletStore } from '../../store/wallet'

const user = userEvent.setup()

function renderSheet(onClose = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/games/crash']}>
      <Routes>
        <Route path="/" element={<div>Каталог кейсов</div>} />
        <Route path="/games/crash" element={<BetSheet open onClose={onClose} />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useCrashStore.setState({
    phase: 'betting',
    roundId: 0,
    ticksLeft: 120,
    multiplier: 1,
    crashPoint: null,
    history: [],
    myBet: null,
  })
})

describe('BetSheet (4.1: Dual Betting)', () => {
  it('открывается на вкладке TON: пресет 0.1 активен, CTA «Поставить 0.1 TON»', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByRole('button', { name: 'TON' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(dialog).getByRole('button', { name: '0.1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(dialog).getByRole('button', { name: 'Поставить 0.1 TON' })).toBeEnabled()
  })

  it('пресеты переключают сумму ставки', async () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: '5' }))
    expect(within(dialog).getByRole('button', { name: 'Поставить 5 TON' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: '0.1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('кастомная сумма парсится в минорные единицы и реально ставится', async () => {
    const onClose = vi.fn()
    renderSheet(onClose)
    const dialog = screen.getByRole('dialog')

    const input = within(dialog).getByLabelText('Сумма ставки')
    await user.clear(input)
    await user.type(input, '2.5')
    expect(within(dialog).getByRole('button', { name: 'Поставить 2.5 TON' })).toBeEnabled()

    await user.click(within(dialog).getByRole('button', { name: 'Поставить 2.5 TON' }))

    expect(onClose).toHaveBeenCalled()
    expect(useWalletStore.getState().getBalance('demo')).toBe(97_500) // 100 − 2.5
    expect(useCrashStore.getState().myBet).toEqual({
      kind: 'gram',
      valueMinor: 2500,
      status: 'active',
    })
  })

  it('сумма больше баланса: честная ошибка и disabled', async () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')

    const input = within(dialog).getByLabelText('Сумма ставки')
    await user.clear(input)
    await user.type(input, '999')

    expect(within(dialog).getByText('Недостаточно TON')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Поставить 999 TON' })).toBeDisabled()
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
  })

  it('некорректный ввод: кнопка disabled с нейтральной подписью', async () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')

    const input = within(dialog).getByLabelText('Сумма ставки')
    await user.clear(input)
    await user.type(input, 'abc')

    expect(within(dialog).getByRole('button', { name: 'Сделать ставку' })).toBeDisabled()
  })

  it('вкладка «Подарки» при пустом инвентаре: честное состояние без выдуманных сервисов', async () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: 'Подарки' }))

    expect(within(dialog).getByText('Нет доступных подарков')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Отправить подарки' })).toBeDisabled()

    // «Открыть кейсы» реально уводит на главную
    await user.click(within(dialog).getByRole('button', { name: 'Открыть кейсы' }))
    expect(screen.getByText('Каталог кейсов')).toBeInTheDocument()
  })

  it('выбор подарка и подтверждение: предмет конвертируется по каталог-цене', async () => {
    const onClose = vi.fn()
    renderSheet(onClose)
    useInventoryStore.getState().addGifts(['plush-pepe'], 'case-open') // 25 TON

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Подарки' }))

    const row = within(dialog).getByRole('button', { name: /Plush Pepe/ })
    await user.click(row)
    expect(row).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(dialog).getByRole('button', { name: 'Поставить Plush Pepe' }))

    expect(onClose).toHaveBeenCalled()
    // предмет ушёл из инвентаря как ставка «в Ракетке» (журнал 3.5)
    expect(useInventoryStore.getState().items).toHaveLength(0)
    expect(useInventoryStore.getState().history[0]).toMatchObject({ detail: 'crash-bet' })
    expect(useCrashStore.getState().myBet).toEqual({
      kind: 'gift',
      valueMinor: 25_000,
      status: 'active',
      uid: expect.any(String),
      giftId: 'plush-pepe',
    })
    // баланс GRAM при ставке подарком не списывается
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
  })
  it('авто вывод: переключатель, шаги ± по 0.1 и множитель уходит в ставку', async () => {
    window.localStorage.removeItem('sexydrop_crash_auto')
    window.localStorage.removeItem('sexydrop_crash_last_bet')
    renderSheet()
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('switch', { name: 'Авто вывод' }))
    const input = within(dialog).getByRole('textbox', { name: 'Множитель авто вывода' })
    expect(input).toHaveValue('1.5')
    await user.click(within(dialog).getByRole('button', { name: 'Больше' }))
    await user.click(within(dialog).getByRole('button', { name: 'Больше' }))
    expect(input).toHaveValue('1.7')
    await user.click(within(dialog).getByRole('button', { name: 'Меньше' }))
    expect(input).toHaveValue('1.6')

    await user.click(within(dialog).getByRole('button', { name: 'Поставить 0.1 TON' }))
    expect(useCrashStore.getState().myBet).toMatchObject({ kind: 'gram', autoCashout: 1.6 })
  })
})
