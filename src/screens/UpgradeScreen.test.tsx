import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { UpgradeScreen } from './UpgradeScreen'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { _resetUpgradeForTests, _setUpgradeRngForTests } from '../services/demoUpgradeService'

const user = userEvent.setup()

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/games/upgrade']}>
      <Routes>
        <Route path="/games/upgrade" element={<UpgradeScreen />} />
        <Route path="/" element={<div>Каталог кейсов</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetUpgradeForTests()
  _setUpgradeRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useGamesHistoryStore.setState({ entries: [] })
})

afterEach(() => {
  _resetUpgradeForTests()
  vi.restoreAllMocks()
})

describe('UpgradeScreen (4.4: UI апгрейда)', () => {
  it('шапка: Назад, заголовок и честная формула', () => {
    renderScreen()
    expect(screen.getByText('Апгрейд')).toBeInTheDocument()
    expect(screen.getByText(/Апгрейд: шанс p = min\(1/)).toBeInTheDocument()
  })

  it('пустой инвентарь: «Выбрать» недоступна, CTA выключена', () => {
    renderScreen()
    expect(screen.getByText(/Инвентарь пуст/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Выбрать' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Апгрейдить' })).toBeDisabled()
  })

  it('выбор источника через пикер и цели из каталога — шанс показан формулой', async () => {
    useInventoryStore.setState({
      items: [{ uid: 'u1', giftId: 'fresh-socks', acquiredAt: 0, source: 'case-open' }],
      history: [],
    })
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Выбрать' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByText('Fresh Socks'))
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }))

    expect(screen.getAllByText('Fresh Socks').length).toBeGreaterThan(0)

    // Цель Snoop Dogg (7000): p = 50/7000 × 0.98 = 0.7%
    await user.click(screen.getAllByRole('button', { name: /^Snoop Dogg$/ })[0]!)
    expect(screen.getAllByText('0.7%').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Апгрейдить' })).toBeEnabled()
  })

  it('раунд: проигрыш сжигает предмет, результат в шите, история записана', async () => {
    _setUpgradeRngForTests(() => 0.5) // p = 0.7% → мимо
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useInventoryStore.setState({
      items: [{ uid: 'u1', giftId: 'fresh-socks', acquiredAt: 0, source: 'case-open' }],
      history: [],
    })
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Выбрать' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByText('Fresh Socks'))
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }))
    await user.click(screen.getAllByRole('button', { name: /^Snoop Dogg$/ })[0]!)
    await user.click(screen.getByRole('button', { name: 'Апгрейдить' }))

    const resultDialog = await screen.findByRole('dialog', {}, { timeout: 5000 })
    expect(within(resultDialog).getByText('Не получилось')).toBeInTheDocument()
    expect(within(resultDialog).getByText(/шанс был 0.7%/)).toBeInTheDocument()

    await user.click(within(resultDialog).getByRole('button', { name: 'Готово' }))
    expect(useInventoryStore.getState().items).toHaveLength(0)
    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({ game: 'Апгрейд', outcome: 'lost', deltaMinor: -50 })
  })
})
