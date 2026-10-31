import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RocketRewardSheet } from './RocketRewardSheet'
import { giftById } from '../../data/catalog'
import { useCrashStore } from '../../store/crash'
import { useInventoryStore } from '../../store/inventory'
import { useWalletStore } from '../../store/wallet'

const gift = giftById.get('astral-shard')!

beforeEach(() => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useCrashStore.setState({
    phase: 'flying',
    roundId: 1,
    ticksLeft: 0,
    multiplier: 2,
    crashPoint: null,
    history: [],
    myBet: null,
    queuedNextBet: null,
  })
  act(() => {
    useInventoryStore.getState().addGifts([gift.id], 'crash-win')
  })
})

describe('RocketRewardSheet («Награда Ракеты!»)', () => {
  it('показывает подарок, цену и три действия', () => {
    render(<RocketRewardSheet gift={gift} onClose={vi.fn()} />)
    expect(screen.getByText('Награда Ракеты!')).toBeInTheDocument()
    expect(screen.getByText('Astral Shard')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Поставить в Ракете' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Продать' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Оставить' })).toBeInTheDocument()
  })

  it('«Продать» зачисляет каталог-цену и убирает подарок из инвентаря', async () => {
    const onClose = vi.fn()
    render(<RocketRewardSheet gift={gift} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Продать' }))
    expect(useWalletStore.getState().getBalance()).toBe(105_000)
    expect(useInventoryStore.getState().items).toHaveLength(0)
    expect(onClose).toHaveBeenCalled()
  })

  it('«Поставить в Ракете» ставит подарок в очередь на следующий раунд', async () => {
    const onClose = vi.fn()
    render(<RocketRewardSheet gift={gift} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Поставить в Ракете' }))
    expect(useCrashStore.getState().queuedNextBet).toMatchObject({ kind: 'gift', giftId: gift.id })
    expect(useInventoryStore.getState().items).toHaveLength(0)
    expect(onClose).toHaveBeenCalled()
  })

  it('«Оставить» только закрывает окно: подарок остаётся в инвентаре', async () => {
    const onClose = vi.fn()
    render(<RocketRewardSheet gift={gift} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Оставить' }))
    expect(onClose).toHaveBeenCalled()
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })
})
