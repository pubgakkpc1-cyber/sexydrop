import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CaseDetailScreen } from './CaseDetailScreen'
import { useWalletStore } from '../store/wallet'
import { useFreeCasesStore } from '../store/freeCases'

describe('CaseDetailScreen (Референс Epic Gift Bot)', () => {
  beforeEach(() => {
    useWalletStore.setState({
      mode: 'demo',
      balances: { demo: 100000, real: 0 },
    })
    useFreeCasesStore.setState({
      lastClaimAt: { free: 0, free24: 0 },
    })
  })

  it('рендерит шапку, рулетку, кнопку и 2-колоночную сетку наград', () => {
    render(
      <MemoryRouter initialEntries={['/case/farm']}>
        <Routes>
          <Route path="/case/:caseId" element={<CaseDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    // Шапка
    expect(screen.getByRole('button', { name: 'Вернуться назад' })).toBeInTheDocument()

    // Встроенная рулетка
    expect(screen.getByLabelText('Рулетка кейса')).toBeInTheDocument()

    // Кнопка открытия
    expect(screen.getByText(/Открыть за/)).toBeInTheDocument()

    // Сетка наград
    expect(screen.getByLabelText('Содержимое кейса')).toBeInTheDocument()
  })

  it('для бесплатного кейса доступна кнопка «Открыть бесплатно»', () => {
    render(
      <MemoryRouter initialEntries={['/case/free24']}>
        <Routes>
          <Route path="/case/:caseId" element={<CaseDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const button = screen.getByText('Открыть бесплатно')
    expect(button).toBeInTheDocument()
  })

  it('для бесплатного кейса на кулдауне отображает таймер «Возвращайтесь через»', () => {
    // Устанавливаем время последнего получения только что
    useFreeCasesStore.setState({
      lastClaimAt: { free: 0, free24: Date.now() },
    })

    render(
      <MemoryRouter initialEntries={['/case/free24']}>
        <Routes>
          <Route path="/case/:caseId" element={<CaseDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Возвращайтесь через')).toBeInTheDocument()
  })

  it('при клике на кнопку открытия запускается прокрутка рулетки', () => {
    render(
      <MemoryRouter initialEntries={['/case/farm']}>
        <Routes>
          <Route path="/case/:caseId" element={<CaseDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const openBtn = screen.getByText(/Открыть за/)
    fireEvent.click(openBtn)

    // Кнопка переходит в состояние вращения
    expect(screen.getByText('Крутим...')).toBeInTheDocument()
  })
})
