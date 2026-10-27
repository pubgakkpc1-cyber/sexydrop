import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { InventoryItem } from '../../store/inventory'
import { useInventoryStore } from '../../store/inventory'
import { GiftPickerSheet } from './GiftPickerSheet'

const onClose = vi.fn()
const onConfirm = vi.fn()

function renderPicker() {
  return render(
    <MemoryRouter initialEntries={['/somewhere']}>
      {/* Проба навигации: «Открыть кейсы» реально уводит на главную */}
      <Routes>
        <Route path="/" element={<div>Каталог кейсов</div>} />
        <Route path="/somewhere" element={<div>Другой экран</div>} />
      </Routes>
      <GiftPickerSheet open onClose={onClose} onConfirm={onConfirm} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useInventoryStore.setState({ items: [], history: [] })
  onClose.mockClear()
  onConfirm.mockClear()
})

describe('GiftPickerSheet (3.3: выбор подарка для игры)', () => {
  it('показывает реальные предметы инвентаря с ценами из каталога', () => {
    act(() => {
      useInventoryStore.getState().addGifts(['plush-pepe', 'fresh-socks'], 'case-open')
    })
    renderPicker()
    expect(screen.getByText('Plush Pepe')).toBeInTheDocument()
    expect(screen.getByText('Fresh Socks')).toBeInTheDocument()
    // цена Plush Pepe = 25 GRAM (каталог)
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('сортирует по цене (дорогие сверху) и ищет по названию без учёта регистра', async () => {
    act(() => {
      useInventoryStore.getState().addGifts(['fresh-socks', 'plush-pepe', 'astral-shard'], 'case-open')
    })
    renderPicker()
    const list = screen.getByText('Plush Pepe').closest('ul')
    if (!list) throw new Error('Ожидается список')
    expect(
      [...list.querySelectorAll('[data-rarity]')].map((row) => (row.textContent ?? '').slice(0, 10)),
    ).toEqual(['Plush Pepe', 'Astral Sha', 'Fresh Sock'])

    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск подарка' }), 'pepe')
    expect(screen.getByText('Plush Pepe')).toBeInTheDocument()
    expect(screen.queryByText('Astral Shard')).not.toBeInTheDocument()
  })

  it('подтверждение заблокировано до выбора и возвращает реальный предмет после', async () => {
    let added: readonly InventoryItem[] = []
    act(() => {
      added = useInventoryStore.getState().addGifts(['astral-shard'], 'case-open')
    })
    renderPicker()
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /Astral Shard/ }))
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeEnabled()
    expect(screen.getByText(/Выбран:/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(added[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('поиск без совпадений показывает «Ничего не найдено»', async () => {
    act(() => {
      useInventoryStore.getState().addGifts(['fresh-socks'], 'case-open')
    })
    renderPicker()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск подарка' }), 'нет-такого')
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeDisabled()
  })

  it('пустой инвентарь: «Открыть кейсы» работает, «Отправить подарки» честно недоступна', async () => {
    renderPicker()
    expect(screen.getByText('Пока нет подарков')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить подарки' })).toBeDisabled()
    expect(
      screen.getByText(/Получение подарков извне появится после подключения сервера/),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Открыть кейсы' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Каталог кейсов')).toBeInTheDocument()
  })
})
