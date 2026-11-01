import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminChancesTab } from './AdminChancesTab'

function chanceInputs(): HTMLInputElement[] {
  return screen.getAllByRole('textbox', { name: /^Шанс / }) as HTMLInputElement[]
}

describe('AdminChancesTab', () => {
  it('показывает кейсы с RTP не выше 98% и раскрывает таблицу шансов', async () => {
    render(<AdminChancesTab />)
    const bronze = screen.getByRole('button', { name: /Bronze/ })
    const rtp = Number(/RTP ([\d.]+)%/.exec(bronze.textContent ?? '')?.[1])
    expect(rtp).toBeGreaterThan(90)
    expect(rtp).toBeLessThanOrEqual(98)

    await userEvent.click(bronze)
    // шансы раскрытого кейса в сумме дают 100%
    const sum = chanceInputs().reduce((s, i) => s + parseFloat(i.value), 0)
    expect(sum).toBeGreaterThan(99.5)
    expect(sum).toBeLessThan(100.5)
  })

  it('впиши шанс приза — остальные подстраиваются до 100%', async () => {
    render(<AdminChancesTab />)
    await userEvent.click(screen.getByRole('button', { name: /Bronze/ }))
    const [first] = chanceInputs()
    await userEvent.clear(first!)
    await userEvent.type(first!, '50')
    await userEvent.tab()
    const inputs = chanceInputs()
    expect(parseFloat(inputs[0]!.value)).toBe(50)
    const sum = inputs.reduce((s, i) => s + parseFloat(i.value), 0)
    expect(sum).toBeGreaterThan(99.5)
    expect(sum).toBeLessThan(100.5)
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled()
  })

  it('приз можно убрать из кейса и вернуть', async () => {
    render(<AdminChancesTab />)
    await userEvent.click(screen.getByRole('button', { name: /Bronze/ }))
    const before = chanceInputs().length
    const [first] = chanceInputs()
    const name = first!.getAttribute('aria-label')!.replace('Шанс ', '')
    await userEvent.click(screen.getByRole('button', { name: `Убрать ${name}` }))
    expect(chanceInputs().length).toBe(before)
    expect(parseFloat(chanceInputs()[0]!.value)).toBe(0)
    const sum = chanceInputs().reduce((s, i) => s + parseFloat(i.value), 0)
    expect(sum).toBeGreaterThan(99.5)
    await userEvent.click(screen.getByRole('button', { name: `Вернуть ${name}` }))
    expect(parseFloat(chanceInputs()[0]!.value)).toBe(1)
  })

  it('поиск фильтрует кейсы', async () => {
    render(<AdminChancesTab />)
    await userEvent.type(screen.getByLabelText('Поиск кейса'), 'gold')
    expect(screen.getByRole('button', { name: /Gold/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bronze/ })).not.toBeInTheDocument()
  })
})
