import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Rocket3DCanvas, ROCKET_SKINS } from './Rocket3DCanvas'

describe('Rocket3DCanvas (3D Rocket, SEXY decal & 3 NFT Plush Pepe pilots)', () => {
  it('содержит ровно 3 уникальные модели ракеты и 3 вида NFT плюш Пепе', () => {
    expect(ROCKET_SKINS).toHaveLength(3)

    // Модель 0: Хроно Арбуз + Пепе Кадет
    const skin0 = ROCKET_SKINS[0]!
    expect(skin0.name).toBe('Chrono Watermelon')
    expect(skin0.nameRu).toBe('Хроно Арбуз')
    expect(skin0.pilotNameRu).toBe('Пепе Кадет')
    expect(skin0.pilotType).toBe(0)
    expect(skin0.decalSubtext).toBe('SEXY · TON')

    // Модель 1: Кибер Мелон + Кибер Пепе с визором
    const skin1 = ROCKET_SKINS[1]!
    expect(skin1.name).toBe('Cyber Melon')
    expect(skin1.nameRu).toBe('Кибер Мелон')
    expect(skin1.pilotNameRu).toBe('Кибер Пепе')
    expect(skin1.pilotType).toBe(1)
    expect(skin1.decalSubtext).toBe('MELON · 99')

    // Модель 2: Империал 24K + Король Пепе в золотой короне
    const skin2 = ROCKET_SKINS[2]!
    expect(skin2.name).toBe('Royal Emerald')
    expect(skin2.nameRu).toBe('Империал 24K')
    expect(skin2.pilotNameRu).toBe('Король Пепе')
    expect(skin2.pilotType).toBe(2)
    expect(skin2.decalSubtext).toBe('ROYAL · VIP')
  })

  it('ререндерится без ошибок во всех фазах полета и с разными раундами', () => {
    const { container, rerender } = render(
      <Rocket3DCanvas phase="betting" multiplier={1.0} roundId={1} />,
    )
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()

    // Фаза полёта с разными скинами
    rerender(<Rocket3DCanvas phase="flying" multiplier={1.5} roundId={1} skinIndex={0} />)
    expect(canvas).toBeInTheDocument()

    rerender(<Rocket3DCanvas phase="flying" multiplier={2.8} roundId={2} skinIndex={1} />)
    expect(canvas).toBeInTheDocument()

    rerender(<Rocket3DCanvas phase="flying" multiplier={10.4} roundId={3} skinIndex={2} />)
    expect(canvas).toBeInTheDocument()

    // Фаза краша (взрыв и ударная волна)
    rerender(<Rocket3DCanvas phase="crashed" multiplier={1.0} roundId={3} />)
    expect(canvas).toBeInTheDocument()
  })
})
