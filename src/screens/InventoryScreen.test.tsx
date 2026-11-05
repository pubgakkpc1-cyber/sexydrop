import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useFreeCasesStore } from '../store/freeCases'
import { InventoryScreen } from './InventoryScreen'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/inventory']}>
      <Routes>
        {/* Проба навигации: проверяем, что кнопки реально уводят с экрана инвентаря */}
        <Route path="/" element={<div>Каталог кейсов</div>} />
        <Route path="/games" element={<div>PLAY-HUB-ROUTE</div>} />
        <Route path="/games/upgrade" element={<div>UPGRADE-ROUTE</div>} />
        <Route path="/inventory" element={<InventoryScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

const card = (name: string) => screen.getByRole('article', { name })

beforeEach(() => {
  useInventoryStore.setState({ items: [], history: [] })
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  setQuest(null, 0)
})

function setQuest(giftId: string | null, joined: number) {
  const quest = useFreeCasesStore.getState().quest
  useFreeCasesStore.setState({
    quest: {
      ...quest,
      pendingReward: giftId
        ? { giftId, uid: 'free-uid', wonAt: Date.now(), expiresAt: Date.now() + 3 * 86_400_000 }
        : null,
      referralsJoined: joined,
    },
  })
}

describe('InventoryScreen: подарок из FREE под замком', () => {
  it('показывает подарок с замком и честный прогресс приглашений', async () => {
    setQuest('plush-pepe', 2)
    renderScreen()
    const locked = screen.getByRole('article', { name: /под замком/ })
    expect(within(locked).getByText('2 / 5')).toBeInTheDocument()
    await userEvent.click(within(locked).getByRole('button', { name: 'Вывести' }))
    expect(screen.getByText('Чтобы вывести подарок, пригласите ещё 3 друзей')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Пригласить друзей/ })).toBeInTheDocument()
  })

  it('продажа подарка под замком тоже просит пригласить друзей', async () => {
    setQuest('plush-pepe', 4)
    renderScreen()
    const locked = screen.getByRole('article', { name: /под замком/ })
    await userEvent.click(within(locked).getByRole('button', { name: /Продать за/ }))
    expect(screen.getByText('Чтобы продать подарок, пригласите ещё 1 друга')).toBeInTheDocument()
  })
})

describe('InventoryScreen (пустой и заполненный инвентарь)', () => {
  it('пустое состояние: «Ваши подарки», карточка с CTA «Открыть кейсы»', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Ваши подарки' })).toBeInTheDocument()
    expect(screen.getByText('Ваш инвентарь пуст')).toBeInTheDocument()
    expect(screen.getByText(/Откройте кейсы — полученные подарки появятся здесь/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Открыть кейсы' })).toBeInTheDocument()
    expect(screen.queryByText(/шт\./)).not.toBeInTheDocument()
  })

  it('пустой инвентарь: отправка подарков на @SexyDropOwner и «или» кейсы', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: '@SexyDropOwner' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить подарок' })).toBeEnabled()
    expect(screen.getByText('или')).toBeInTheDocument()
  })

  it('с подарками: плашка «Отправьте подарки @SexyDropOwner» с активной кнопкой', () => {
    act(() => {
      useInventoryStore.getState().addGifts(['plush-pepe'], 'case-open')
    })
    renderScreen()
    expect(screen.getByText(/Отправьте подарки @SexyDropOwner/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeEnabled()
  })

  it('CTA «Открыть кейсы» реально ведёт на главную', async () => {
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Открыть кейсы' }))
    expect(screen.getByText('Каталог кейсов')).toBeInTheDocument()
  })

  it('заполненное состояние: карточки с названием, ценой и кнопками', () => {
    act(() => {
      useInventoryStore.getState().addGifts(['plush-pepe', 'fresh-socks'], 'case-open')
    })
    renderScreen()
    expect(screen.getByText('2 шт.')).toBeInTheDocument()
    const pepe = card('Plush Pepe')
    // цена из каталога, а не выдуманная: Plush Pepe = 25 TON
    expect(within(pepe).getByRole('button', { name: 'Продать за 25 TON' })).toBeInTheDocument()
    expect(within(pepe).getByRole('button', { name: 'Вывести' })).toBeEnabled()
    expect(within(pepe).getByRole('button', { name: 'Апгрейд' })).toBeInTheDocument()
    expect(within(pepe).getByRole('button', { name: 'Play Hub' })).toBeInTheDocument()
    expect(card('Fresh Socks')).toBeInTheDocument()
  })

  it('кнопки «Апгрейд» и «Play Hub» ведут на свои экраны', async () => {
    act(() => {
      useInventoryStore.getState().addGifts(['astral-shard'], 'case-open')
    })
    const first = renderScreen()
    await userEvent.click(within(card('Astral Shard')).getByRole('button', { name: 'Апгрейд' }))
    expect(screen.getByText('UPGRADE-ROUTE')).toBeInTheDocument()
    first.unmount()

    renderScreen()
    await userEvent.click(within(card('Astral Shard')).getByRole('button', { name: 'Play Hub' }))
    expect(screen.getByText('PLAY-HUB-ROUTE')).toBeInTheDocument()
  })

  it('жизненный цикл: наполнение и опустошение через операции стора', () => {
    renderScreen()
    expect(screen.getByText('Ваш инвентарь пуст')).toBeInTheDocument()

    let added: readonly InventoryItem[] = []
    act(() => {
      added = useInventoryStore.getState().addGifts(['astral-shard'], 'case-open')
    })
    expect(screen.queryByText('Ваш инвентарь пуст')).not.toBeInTheDocument()
    expect(card('Astral Shard')).toBeInTheDocument()
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

describe('InventoryScreen — фильтры', () => {
  function seedInventory() {
    act(() => {
      useInventoryStore.getState().addGifts(
        ['plush-pepe', 'fresh-socks', 'astral-shard', 'heart-locket'],
        'case-open',
      )
    })
  }

  it('поиск по названию нечувствителен к регистру', async () => {
    renderScreen()
    seedInventory()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск подарка' }), 'pepe')
    expect(screen.getByText('Показано 1 из 4')).toBeInTheDocument()
    expect(card('Plush Pepe')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Fresh Socks' })).not.toBeInTheDocument()
  })

  it('когда фильтр ничего не находит — состояние «Ничего не найдено» и сброс', async () => {
    renderScreen()
    seedInventory()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск подарка' }), 'нет-такого')
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(screen.getByText('4 шт.')).toBeInTheDocument()
    expect(card('Plush Pepe')).toBeInTheDocument()
    expect(card('Fresh Socks')).toBeInTheDocument()
  })

  it('«Продать за …» прямо на карточке: баланс растёт, карточка исчезает', async () => {
    renderScreen()
    seedInventory()
    await userEvent.click(within(card('Astral Shard')).getByRole('button', { name: 'Продать за 5 TON' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Продано: +5 TON')
    expect(useWalletStore.getState().getBalance()).toBe(105_000)
    expect(screen.getByText('3 шт.')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Astral Shard' })).not.toBeInTheDocument()
  })
})
