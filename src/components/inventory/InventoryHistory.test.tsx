import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useInventoryStore } from '../../store/inventory'
import { InventoryHistory } from './InventoryHistory'

const T0 = 1_760_000_000_000

beforeEach(() => {
  useInventoryStore.setState({ items: [], history: [] })
})

describe('InventoryHistory (3.5: история изменений инвентаря)', () => {
  it('без событий не рендерится вовсе', () => {
    render(<InventoryHistory />)
    expect(screen.queryByLabelText('История изменений инвентаря')).not.toBeInTheDocument()
  })

  it('показывает реальные события: получение, продажа с суммой из каталога; порядок — как в журнале', () => {
    useInventoryStore.setState({
      items: [],
      history: [
        {
          at: T0,
          type: 'acquire',
          uid: 'u1',
          giftId: 'plush-pepe', // 25 GRAM
          detail: 'case-open',
        },
        {
          at: T0 + 60_000,
          type: 'remove',
          uid: 'u1',
          giftId: 'plush-pepe',
          detail: 'sold',
        },
      ],
    })
    render(<InventoryHistory />)

    const section = screen.getByLabelText('История изменений инвентаря')
    expect(section).toBeInTheDocument()
    const rows = section.querySelectorAll('[class*="row"]')
    // порядок — как в массиве журнала (стор сам кладёт свежие события в начало)
    expect(rows[0]?.textContent).toContain('Получено')
    expect(rows[1]?.textContent).toContain('Продано')

    // сумма продажи выведена из реальной каталог-цены (25 GRAM), не выдумана
    expect(rows[1]?.textContent).toContain('+')
    expect(rows[1]?.textContent).toContain('25')
    expect(rows[1]?.textContent).toContain('по каталог-цене')
    expect(rows[0]?.textContent).toContain('из платного кейса')
    // время отформатировано и является элементом <time>
    expect(document.querySelector('time')).not.toBeNull()
  })

  it('неизвестный подарок в журнале не роняет UI — честный фолбэк', () => {
    useInventoryStore.setState({
      items: [],
      history: [{ at: T0, type: 'acquire', uid: 'u2', giftId: 'no-such-gift', detail: 'case-open' }],
    })
    render(<InventoryHistory />)
    const section = screen.getByLabelText('История изменений инвентаря')
    expect(section.textContent).toContain('Предмет')
    expect(section.textContent).toContain('из платного кейса')
  })

  it('ставка в Ракетке (crash-bet, 4.1) — «Ставка · в Ракетке» без суммы продажи', () => {
    useInventoryStore.setState({
      items: [],
      history: [{ at: T0, type: 'remove', uid: 'u3', giftId: 'plush-pepe', detail: 'crash-bet' }],
    })
    render(<InventoryHistory />)
    const section = screen.getByLabelText('История изменений инвентаря')
    expect(section.textContent).toContain('Ставка')
    expect(section.textContent).toContain('в Ракетке')
    // суммы в строке нет — это не продажа; выигрыш приходит в баланс при «Забрать»
    expect(section.textContent).not.toContain('+')
  })

  it('больше MAX_SHOWN событий — показывает последние 20 и честную подпись', () => {
    const history = Array.from({ length: 25 }, (_, index) => ({
      at: T0 + index * 1000,
      type: 'acquire' as const,
      uid: `u${index}`,
      giftId: 'fresh-socks',
      detail: 'free-case',
    }))
    useInventoryStore.setState({ items: [], history })
    render(<InventoryHistory />)
    expect(screen.getByText('Показаны последние 20 из 25 событий')).toBeInTheDocument()
    expect(screen.getAllByText('Fresh Socks')).toHaveLength(20)
  })
})
