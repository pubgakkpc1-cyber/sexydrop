import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useInventoryStore } from '../../store/inventory'
import { BottomNav } from './BottomNav'

function renderNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useInventoryStore.setState({ items: [], history: [] })
})

describe('BottomNav (спека: Инвентарь, Пригласить, Главная, Рейтинг, Заработок)', () => {
  it('содержит ровно пять вкладок в порядке спецификации', () => {
    renderNav()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
    expect(links.map((link) => link.textContent)).toEqual([
      'Инвентарь',
      'Пригласить',
      'Главная',
      'Рейтинг',
      'Заработок',
    ])
  })

  it('помечает активную вкладку aria-current="page"', () => {
    renderNav('/rating')
    expect(screen.getByRole('link', { name: /Рейтинг/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Главная/ })).not.toHaveAttribute('aria-current')
  })

  it('переключает вкладку по клику', async () => {
    renderNav()
    await userEvent.click(screen.getByRole('link', { name: /Инвентарь/ }))
    expect(screen.getByRole('link', { name: /Инвентарь/ })).toHaveAttribute('aria-current', 'page')
  })

  it('показывает счётчик предметов инвентаря из состояния', () => {
    useInventoryStore.setState({
      items: [
        { uid: 'u1', giftId: 'plush-pepe', acquiredAt: 1, source: 'case-open' },
        { uid: 'u2', giftId: 'fresh-socks', acquiredAt: 2, source: 'case-open' },
      ],
      history: [],
    })
    renderNav()
    expect(screen.getByLabelText('2 предмета')).toBeInTheDocument()
  })

  it('скрывает бейдж при пустом инвентаре', () => {
    renderNav()
    expect(screen.queryByLabelText(/предметов/)).not.toBeInTheDocument()
  })
})
