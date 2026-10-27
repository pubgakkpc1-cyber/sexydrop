import { beforeEach, describe, expect, it } from 'vitest'
import { useInventoryStore } from './inventory'

const getState = () => useInventoryStore.getState()

beforeEach(() => {
  useInventoryStore.setState({ items: [], history: [] })
})

describe('inventory store', () => {
  it('добавляет предметы с уникальными uid и пишет историю', () => {
    const added = getState().addGifts(['plush-pepe', 'fresh-socks'], 'case-open')
    expect(added).toHaveLength(2)
    expect(new Set(added.map((item) => item.uid)).size).toBe(2)
    expect(getState().items).toHaveLength(2)
    expect(getState().history).toHaveLength(2)
    expect(getState().history[0]?.type).toBe('acquire')
  })

  it('удаляет по uid и фиксирует причину в истории', () => {
    const [first] = getState().addGifts(['diamond-ring'], 'case-open')
    if (!first) throw new Error('expected item')
    getState().removeUids([first.uid], 'sold')
    expect(getState().items).toHaveLength(0)
    expect(getState().history[0]).toMatchObject({ type: 'remove', detail: 'sold', uid: first.uid })
  })

  it('отвергает удаление неизвестных uid, не меняя состояние', () => {
    getState().addGifts(['astral-shard'], 'free-case')
    expect(() => getState().removeUids(['no-such-uid'], 'test')).toThrow()
    expect(getState().items).toHaveLength(1)
    expect(getState().history).toHaveLength(1)
  })
})
