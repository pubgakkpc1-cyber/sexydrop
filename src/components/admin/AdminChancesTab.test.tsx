import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminChancesTab } from './AdminChancesTab'

describe('AdminChancesTab', () => {
  it('показывает кейсы с RTP не выше 98% и раскрывает таблицу шансов', async () => {
    render(<AdminChancesTab />)
    const bronze = screen.getByRole('button', { name: /Bronze/ })
    const rtp = Number(/RTP ([\d.]+)%/.exec(bronze.textContent ?? '')?.[1])
    expect(rtp).toBeGreaterThan(90)
    expect(rtp).toBeLessThanOrEqual(98)

    await userEvent.click(bronze)
    expect(screen.getAllByText('Шанс').length).toBeGreaterThan(0)
    // шансы раскрытого кейса в сумме дают 100%
    const cells = screen.getAllByRole('cell').filter((c) => /%$/.test(c.textContent ?? ''))
    const sum = cells.reduce((s, c) => s + parseFloat(c.textContent ?? '0'), 0)
    expect(sum).toBeGreaterThan(99.5)
    expect(sum).toBeLessThan(100.5)
  })

  it('поиск фильтрует кейсы', async () => {
    render(<AdminChancesTab />)
    await userEvent.type(screen.getByLabelText('Поиск кейса'), 'gold')
    expect(screen.getByRole('button', { name: /Gold/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bronze/ })).not.toBeInTheDocument()
  })
})
