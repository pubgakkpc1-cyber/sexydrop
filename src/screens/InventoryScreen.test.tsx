import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { InventoryScreen } from './InventoryScreen'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/inventory']}>
      <Routes>
        {/* Проба навигации: проверяем, что CTA реально уводит с экрана инвентаря */}
        <Route path="/" element={<div>Каталог кейсов</div>} />
        <Route path="/inventory" element={<InventoryScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useInventoryStore.setState({ items: [], history: [] })
})

describe('InventoryScreen (3.1: пустой и заполненный инвентарь)', () => {
  it('пустое состояние: карточка референса с CTA «Открыть кейсы»', () => {
    renderScreen()
    expect(screen.getByText('Ваш инвентарь пуст')).toBeInTheDocument()
    expect(screen.getByText(/Откройте кейсы — полученные подарки появятся здесь/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть кейсы' })).toBeInTheDocument()
    expect(screen.getByText('Твои подарки')).toBeInTheDocument()
    expect(screen.queryByText(/шт\./)).not.toBeInTheDocument()
  })

  it('CTA «Открыть кейсы» реально ведёт на главную', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Открыть кейсы' }))
    expect(screen.getByText('Каталог кейсов')).toBeInTheDocument()
  })

  it('заполненное состояние: счётчик, карточки с названием и редкостью', () => {
    act(() => {
      useInventoryStore.getState().addGifts(['plush-pepe', 'fresh-socks'], 'case-open')
    })
    renderScreen()
    expect(screen.getByText('2 шт.')).toBeInTheDocument()
    expect(screen.getByTitle('Plush Pepe · Легендарный')).toBeInTheDocument()
    expect(screen.getByTitle('Fresh Socks · Обычный')).toBeInTheDocument()
    // цена из каталога, а не выдуманная: Plush Pepe = 25 GRAM
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('жизненный цикл: наполнение и опустошение через операции стора (контракт 3.4)', () => {
    renderScreen()
    expect(screen.getByText('Ваш инвентарь пуст')).toBeInTheDocument()

    let added: readonly InventoryItem[] = []
    act(() => {
      added = useInventoryStore.getState().addGifts(['astral-shard'], 'case-open')
    })
    expect(screen.queryByText('Ваш инвентарь пуст')).not.toBeInTheDocument()
    expect(screen.getByTitle('Astral Shard · Эпический')).toBeInTheDocument()
    expect(screen.getByText('1 шт.')).toBeInTheDocument()

    act(() => {
      useInventoryStore.getState().removeUids(
        added.map((item) => item.uid),
        'sold',
      )
    })
    expect(screen.getByText('Ваш инвентарь пуст')).toBeInTheDocument()
    expect(screen.queryByText(/шт\./)).not.toBeInTheDocument()
  })
})

describe('InventoryScreen — фильтры (3.2)', () => {
  function seedInventory() {
    act(() => {
      useInventoryStore.getState().addGifts(
        ['plush-pepe', 'fresh-socks', 'astral-shard', 'heart-locket'],
        'case-open',
      )
    })
  }

  it('чипы редкости показывают счётчики и фильтруют карточки', async () => {
    renderScreen()
    seedInventory()
    expect(screen.getByText('4 шт.')).toBeInTheDocument()
    // «Эпические» — ровно один подарок этой редкости в наборе
    await userEvent.click(screen.getByRole('button', { name: /Эпические/ }))
    expect(screen.getByText('Показано 1 из 4')).toBeInTheDocument()
    expect(screen.getByTitle('Astral Shard · Эпический')).toBeInTheDocument()
    expect(screen.queryByTitle('Plush Pepe · Легендарный')).not.toBeInTheDocument()
  })

  it('поиск по названию нечувствителен к регистру', async () => {
    renderScreen()
    seedInventory()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск подарка' }), 'pepe')
    expect(screen.getByText('Показано 1 из 4')).toBeInTheDocument()
    expect(screen.getByTitle('Plush Pepe · Легендарный')).toBeInTheDocument()
    expect(screen.queryByTitle('Fresh Socks · Обычный')).not.toBeInTheDocument()
  })

  it('сортировка «Дорогие» ставит самый дорогой подарок первым', async () => {
    renderScreen()
    seedInventory()
    await userEvent.click(screen.getByRole('button', { name: 'Дорогие' }))
    const grid = screen.getByTitle('Plush Pepe · Легендарный').parentElement
    if (!grid) throw new Error('Ожидается сетка карточек')
    const titles = Array.from(grid.children).map((card) => card.getAttribute('title'))
    expect(titles).toEqual([
      'Plush Pepe · Легендарный', // 25 GRAM
      'Astral Shard · Эпический', // 5 GRAM
      'Heart Locket · Редкий', // 1 GRAM
      'Fresh Socks · Обычный', // 0.05 GRAM
    ])
  })

  it('когда фильтр ничего не находит — состояние «Ничего не найдено» и сброс', async () => {
    renderScreen()
    seedInventory()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск подарка' }), 'нет-такого')
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.queryByTitle(/· /)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(screen.getByText('4 шт.')).toBeInTheDocument()
    expect(screen.getByTitle('Plush Pepe · Легендарный')).toBeInTheDocument()
    expect(screen.getByTitle('Fresh Socks · Обычный')).toBeInTheDocument()
  })

  it('клик по карточке открывает действия предмета (3.4)', async () => {
    renderScreen()
    seedInventory()
    await userEvent.click(screen.getByTitle('Astral Shard · Эпический'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Предмет инвентаря')
    expect(screen.getByRole('button', { name: 'Продать за 5 TON' })).toBeInTheDocument()
    // закрытие крестиком возвращает экран без диалога
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('продажа через экран обновляет баланс и возвращает карточки в актуальном виде', async () => {
    renderScreen()
    seedInventory()
    await userEvent.click(screen.getByTitle('Astral Shard · Эпический'))
    await userEvent.click(screen.getByRole('button', { name: 'Продать за 5 TON' }))
    // «Продано» появляется и в шите, и в истории (3.5) — смотрим именно в диалог
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Продано')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Готово' }))
    expect(screen.getByText('3 шт.')).toBeInTheDocument()
    expect(screen.queryByTitle('Astral Shard · Эпический')).not.toBeInTheDocument()
  })
})
