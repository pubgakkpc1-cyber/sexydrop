import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { isChunkLoadError, lazyScreen } from './chunkReload'
import { AppErrorBoundary } from '../components/shell/AppErrorBoundary'

const realLocation = window.location

afterEach(() => {
  Object.defineProperty(window, 'location', { value: realLocation, configurable: true })
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

function stubLocation() {
  const replace = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { href: 'https://app.test/?x=1#/case/free', hash: '#/case/free', replace },
    configurable: true,
  })
  return replace
}

describe('защита от серого экрана после деплоя', () => {
  it('узнаёт ошибки загрузки файла экрана в разных браузерах', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/Case-1.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it('экран не загрузился — одна перезагрузка за свежей версией, без петли', async () => {
    const replace = stubLocation()
    const Broken = lazyScreen(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))
    render(
      <Suspense fallback={<span>грузим</span>}>
        <Broken />
      </Suspense>,
    )
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(1))
    expect(String(replace.mock.calls[0]?.[0])).toMatch(/[?&]v=\d+#\/case\/free$/)
    // вторая неудача сразу после — уже без перезагрузки, покажется экран ошибки
    const Again = lazyScreen(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <AppErrorBoundary>
        <Suspense fallback={null}>
          <Again />
        </Suspense>
      </AppErrorBoundary>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Экран не загрузился')
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument()
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('любая другая ошибка экрана — сообщение с кнопками вместо серого экрана', () => {
    stubLocation()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const Boom = () => {
      throw new Error('boom')
    }
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('button', { name: 'На главную' })).toBeInTheDocument()
  })
})
