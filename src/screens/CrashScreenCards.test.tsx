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
  it('renders player cards with NFT framed box', () => {
    const { container } = renderScreen()

    // Проверяем наличие списка карточек
    const cards = container.querySelectorAll(`.${styles.playerCard}`)
    expect(cards.length).toBeGreaterThan(0)

    // Проверяем наличие NFT боксов у игроков
    const nftBoxes = container.querySelectorAll(`.${styles.playerNftBox}`)
    expect(nftBoxes.length).toBeGreaterThan(0)

    // Проверяем наличие плашек ставок с TonIcon
    const betPills = container.querySelectorAll(`.${styles.playerBetPill}`)
    expect(betPills.length).toBe(cards.length)

    // Проверяем наличие плашек выплат
    const payoutPills = container.querySelectorAll(`.${styles.playerPayoutPill}`)
    expect(payoutPills.length).toBe(cards.length)
  })

  it('моя ставка всегда первая в списке, даже если она самая маленькая', () => {
    const { container } = renderScreen()
    act(() => {
      expect(placeGramBet(100, 'req-first')).toEqual({ status: 'ok' }) // 0.1 TON — меньше всех ставок ботов
    })
    const cards = container.querySelectorAll(`.${styles.playerCard}`)
    expect(cards[0]?.classList.contains(styles.playerCardUser!)).toBe(true)
    expect(cards[0]?.textContent).toContain('YOU')
  })
})
