import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CrashScreen } from './CrashScreen'
import { _resetCrashForTests, placeGramBet } from '../services/demoCrashService'
import { useWalletStore } from '../store/wallet'
import { useInventoryStore } from '../store/inventory'
import styles from './CrashScreen.module.css'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/games/crash']}>
      <Routes>
        <Route path="/games/crash" element={<CrashScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetCrashForTests()
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
})

afterEach(() => {
  _resetCrashForTests()
})

describe('CrashScreen Player Cards Styling & NFT Frame', () => {
  it('без ботов: пока нет ставки — подсказка вместо карточек; после ставки одна карточка с NFT-рамкой', () => {
    const { container, getByText } = renderScreen()
    expect(container.querySelectorAll(`.${styles.playerCard}`)).toHaveLength(0)
    expect(getByText(/Пока нет ставок/)).toBeInTheDocument()

    act(() => {
      expect(placeGramBet(100, 'req-card')).toEqual({ status: 'ok' })
    })
    const cards = container.querySelectorAll(`.${styles.playerCard}`)
    expect(cards).toHaveLength(1)
    expect(container.querySelectorAll(`.${styles.playerNftBox}`)).toHaveLength(1)
    expect(container.querySelectorAll(`.${styles.playerBetPill}`)).toHaveLength(1)
    expect(container.querySelectorAll(`.${styles.playerPayoutPill}`)).toHaveLength(1)
  })

  it('моя ставка — единственная и первая в списке', () => {
    const { container } = renderScreen()
    act(() => {
      expect(placeGramBet(100, 'req-first')).toEqual({ status: 'ok' }) // 0.1 TON
    })
    const cards = container.querySelectorAll(`.${styles.playerCard}`)
    expect(cards[0]?.classList.contains(styles.playerCardUser!)).toBe(true)
    expect(cards[0]?.textContent).toContain('YOU')
  })
})
