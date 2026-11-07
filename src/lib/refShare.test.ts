import { afterEach, describe, expect, it, vi } from 'vitest'
import { shareRefGif } from './refShare'

function setWebApp(extra: Record<string, unknown>) {
  ;(window as { Telegram?: unknown }).Telegram = {
    WebApp: { initDataUnsafe: { user: { id: 5 } }, initData: 'signed', ready() {}, expand() {}, ...extra },
  }
}

afterEach(() => {
  delete (window as { Telegram?: unknown }).Telegram
  vi.unstubAllGlobals()
})

const LINK = 'https://t.me/sexydropbot?startapp=ref-5'

describe('shareRefGif: гифка со ссылкой в «Поделиться»', () => {
  it('Telegram 8.0+: сервер готовит гифку своего вида, открывается shareMessage', async () => {
    const shareMessage = vi.fn()
    const openTelegramLink = vi.fn()
    setWebApp({ shareMessage, openTelegramLink, isVersionAtLeast: () => true })
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'prep-1' }) }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(shareRefGif('unlock', LINK, 'текст')).resolves.toBe('gif')
    expect(fetchMock).toHaveBeenCalledWith('/api/referrals/share', expect.objectContaining({ method: 'POST' }))
    const init = (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1]
    expect(JSON.parse(init.body)).toEqual({
      init_data: 'signed',
      kind: 'unlock',
    })
    expect(shareMessage).toHaveBeenCalledWith('prep-1')
    expect(openTelegramLink).not.toHaveBeenCalled()
  })

  it('сервер не смог — обычное «Поделиться» ссылкой', async () => {
    const shareMessage = vi.fn()
    const openTelegramLink = vi.fn()
    setWebApp({ shareMessage, openTelegramLink, isVersionAtLeast: () => true })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))

    await expect(shareRefGif('invite', LINK, 'Залетай')).resolves.toBe('link')
    expect(shareMessage).not.toHaveBeenCalled()
    expect(decodeURIComponent(String(openTelegramLink.mock.calls[0]?.[0]))).toContain(LINK)
  })

  it('старый Telegram без shareMessage — сразу ссылка, без запроса к серверу', async () => {
    const openTelegramLink = vi.fn()
    setWebApp({ openTelegramLink })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(shareRefGif('roulette', LINK, 'Залетай')).resolves.toBe('link')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(openTelegramLink).toHaveBeenCalledTimes(1)
  })
})
