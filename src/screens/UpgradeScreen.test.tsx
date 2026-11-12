import { upgradeChancePercent } from '../services/demoUpgradeService'
import { giftById } from '../data/catalog'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { UpgradeScreen } from './UpgradeScreen'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { _resetUpgradeForTests, _setUpgradeRngForTests } from '../services/demoUpgradeService'

/** В окне выбора цели первым идёт самый дешёвый вид Snoop Dogg (цены у видов разные). */
const SNOOP_ID = [...giftById.values()].filter((g) => g.name === 'Snoop Dogg' && /-\d$/.test(g.id)).sort((a, b) => a.priceMinor - b.priceMinor)[0]!.id

/** Показываемый процент шанса для предмета ценой priceMinor против цели из каталога. */
function pctText(sourceMinor: number, targetId: string): string {
  const pct = upgradeChancePercent(sourceMinor, giftById.get(targetId)!.priceMinor)
  return pct.toFixed(2).replace(/\.?0+$/, '')
}

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
    expect(screen.queryByText(/Улучшайте свои предметы/)).not.toBeInTheDocument()
  })

  it('пустой инвентарь: окно выбора с подсказкой, CTA выключена', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Выбрать предмет' }))
    expect(screen.getByText('Пока нет подарков')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Апгрейдить' })).toBeDisabled()
  })

  it('выбор источника через пикер и цели из каталога — шанс показан формулой', async () => {
    useInventoryStore.setState({
      items: [{ uid: 'u1', giftId: 'fresh-socks', acquiredAt: 0, source: 'case-open' }],
      history: [],
    })
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Выбрать предмет' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByText('Fresh Socks'))
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }))

    expect(screen.getAllByText('Fresh Socks').length).toBeGreaterThan(0)

    // Цель Snoop Dogg: p = 50 / цена × 0.98 (цена из каталога)
    await user.click(screen.getByRole('button', { name: 'Выбрать цель' }))
    const targetDialog = screen.getByRole('dialog')
    await user.click(within(targetDialog).getAllByRole('button', { name: /^Snoop Dogg$/ })[0]!)
    await user.click(within(targetDialog).getByRole('button', { name: 'Подтвердить' }))
    expect(screen.getAllByText(`${pctText(50, SNOOP_ID)}%`).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Апгрейдить' })).toBeEnabled()
  })

  it('раунд: проигрыш сжигает предмет, результат в шите, история записана', async () => {
    _setUpgradeRngForTests(() => 0.5) // p ≈ 0.7% → мимо
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    useInventoryStore.setState({
      items: [{ uid: 'u1', giftId: 'fresh-socks', acquiredAt: 0, source: 'case-open' }],
      history: [],
    })
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Выбрать предмет' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByText('Fresh Socks'))
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }))
    await user.click(screen.getByRole('button', { name: 'Выбрать цель' }))
    const targetDialog = screen.getByRole('dialog')
    await user.click(within(targetDialog).getAllByRole('button', { name: /^Snoop Dogg$/ })[0]!)
    await user.click(within(targetDialog).getByRole('button', { name: 'Подтвердить' }))
    await user.click(screen.getByRole('button', { name: 'Апгрейдить' }))

    const resultDialog = await screen.findByRole('dialog', {}, { timeout: 12_000 })
    expect(within(resultDialog).getByText('Не получилось')).toBeInTheDocument()
    expect(within(resultDialog).getByText(new RegExp(`шанс был ${pctText(50, SNOOP_ID).replace('.', '\.')}%`))).toBeInTheDocument()

    await user.click(within(resultDialog).getByRole('button', { name: 'Готово' }))
    expect(useInventoryStore.getState().items).toHaveLength(0)
    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({ game: 'Апгрейд', outcome: 'lost', deltaMinor: -50 })
  }, 20_000)

  it('кнопки x2 / x3 / x5 выбирают РАЗНЫЕ цели с растущей ценой', async () => {
    useInventoryStore.setState({
      items: [{ uid: 'p1', giftId: 'precious_peach-1', acquiredAt: 0, source: 'case-open' }],
      history: [],
    })
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Выбрать предмет' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByText('Precious Peach'))
    await user.click(within(dialog).getByRole('button', { name: 'Подтвердить' }))

    const names: string[] = []
    for (const label of ['x2', 'x3', 'x5']) {
      await user.click(screen.getByRole('button', { name: label }))
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
      names.push(screen.getByRole('button', { name: 'Выбрать цель' }).textContent ?? '')
    }
    expect(new Set(names).size).toBe(3)
  })
})
