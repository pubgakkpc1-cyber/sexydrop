import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { caseById, giftById } from '../../data/catalog'
import { CaseMultiOpen } from './CaseMultiOpen'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('CaseMultiOpen', () => {
  it('крутит ленты, потом показывает итог и отпускает удержанные обновления', () => {
    const gameCase = [...caseById.values()].find((c) => c.freeCooldownMs === null && c.entries.length > 2)!
    const ids = gameCase.entries.slice(0, 3).map((e) => e.itemId)
    const results = ids.map((giftId, i) => ({ giftId, uid: `u${i}` }))
    const done = vi.fn()
    render(<CaseMultiOpen gameCase={gameCase} results={results} onAnimationDone={done} onClose={() => undefined} />)
    expect(screen.getByText('Открываем ×3')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(12_000)
    })
    expect(screen.getByText('Выпало')).toBeInTheDocument()
    expect(done).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Забрать' })).toBeInTheDocument()
    expect(giftById.get(ids[0]!)).toBeDefined()
  })
})
