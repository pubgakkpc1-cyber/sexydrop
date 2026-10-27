import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ItemActionsSheet } from './ItemActionsSheet'
import { useInventoryStore, type InventoryItem } from '../../store/inventory'
import { useWalletStore } from '../../store/wallet'
import { sellItem } from '../../services/demoInventoryService'

const onClose = vi.fn()
const wallet = () => useWalletStore.getState()

function renderSheet(item: InventoryItem) {
  return render(
    <MemoryRouter>
      <ItemActionsSheet item={item} onClose={onClose} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useInventoryStore.setState({ items: [], history: [] })
  useWalletStore.setState({ mode: 'demo', balances: { demo: 10_000, real: 0 } })
  onClose.mockClear()
})

describe('ItemActionsSheet (3.4: продажа и передача)', () => {
  it('показывает предмет: название, редкость, цену, источник', () => {
    let item: InventoryItem | undefined
    act(() => {
      item = useInventoryStore.getState().addGifts(['plush-pepe'], 'case-open')[0]
    })
    if (!item) throw new Error('expected item')
    renderSheet(item)
    expect(screen.getByText('Plush Pepe')).toBeInTheDocument()
    expect(screen.getByText(/Легендарный · Из платного кейса/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Продать за 25 TON' })).toBeInTheDocument()
  })

  it('продажа зачисляет TON, удаляет предмет и показывает результат', async () => {
    let item: InventoryItem | undefined
    act(() => {
      item = useInventoryStore.getState().addGifts(['astral-shard'], 'case-open')[0] // 5 TON
    })
    if (!item) throw new Error('expected item')
    renderSheet(item)

    await userEvent.click(screen.getByRole('button', { name: 'Продать за 5 TON' }))
    expect(screen.getByText('Продано')).toBeInTheDocument()
    expect(wallet().getBalance('demo')).toBe(15_000)
    expect(useInventoryStore.getState().items).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'Готово' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('передача честно недоступна с пояснением', () => {
    let item: InventoryItem | undefined
    act(() => {
      item = useInventoryStore.getState().addGifts(['fresh-socks'], 'case-open')[0]
    })
    if (!item) throw new Error('expected item')
    renderSheet(item)
    expect(screen.getByRole('button', { name: 'Передать' })).toBeDisabled()
    expect(screen.getByText(/Передача подарков появится после подключения сервера/)).toBeInTheDocument()
  })

  it('устаревший предмет: ошибка вместо ложного успеха', async () => {
    let item: InventoryItem | undefined
    act(() => {
      item = useInventoryStore.getState().addGifts(['fresh-socks'], 'case-open')[0]
    })
    if (!item) throw new Error('expected item')
    // предмет продан до открытия шита (устаревшее состояние)
    sellItem(item.uid, 'req-stale')
    renderSheet(item)

    await userEvent.click(screen.getByRole('button', { name: 'Продать за 0.05 TON' }))
    expect(screen.queryByText('Продано')).not.toBeInTheDocument()
    expect(screen.getByText('Предмет уже недоступен для продажи')).toBeInTheDocument()
    // единственное начисление — от реальной продажи до открытия шита; повтор не добавил ничего
    expect(wallet().getBalance('demo')).toBe(10_050)
  })
})
