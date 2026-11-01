import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Серверный режим: действия исполняет сервер, приложение только показывает ответ.
 * Проверяем, что баланс и подарки меняются исключительно по ответу сервера.
 */
type Json = Record<string, unknown>

function reply(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function load() {
  vi.resetModules()
  vi.stubEnv('VITE_SERVER_MODE', '1')
  vi.doMock('../lib/auth', () => ({
    authHeaders: async () => ({ Authorization: 'Bearer test' }),
    getAuthToken: async () => 'test',
  }))
  const api = await import('./gameApi')
  const wallet = (await import('../store/wallet')).useWalletStore
  const inventory = (await import('../store/inventory')).useInventoryStore
  return { api, wallet, inventory }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.doUnmock('../lib/auth')
})

describe('gameApi (серверный режим)', () => {
  it('открытие кейса: баланс и подарок берутся из ответа сервера, а не считаются на устройстве', async () => {
    const { api, wallet, inventory } = await load()
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('/api/play/cases/farm/open')) {
        return reply(200, { status: 'ok', gift_id: 'plush-pepe', uid: 'srv-1', balance_minor: 4321 })
      }
      return reply(200, { balance_minor: 4321, items: [], stars: 0, quests_claimed: {}, metrics: {}, free_next_at: {}, free_quest: { pending: null, joined: 0, target: 5, completed: false }, me: {} })
    })
    vi.stubGlobal('fetch', fetchMock)
    wallet.setState({ balances: { demo: 999_999, real: 0 } })

    const result = await api.openCaseApi('farm', 'req-1')

    expect(result).toEqual({ status: 'ok', giftId: 'plush-pepe', uid: 'srv-1' })
    expect(wallet.getState().balances.demo).toBe(4321)
    expect(inventory.getState().items.map((i) => i.uid)).toContain('srv-1')
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/open'))!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ client_request_id: 'req-1' })
  })

  it('нехватка средств приходит от сервера как insufficient_funds, предмет не появляется', async () => {
    const { api, inventory } = await load()
    vi.stubGlobal('fetch', vi.fn(async () => reply(402, { detail: 'Недостаточно средств', code: 'insufficient_funds' })))
    expect(await api.openCaseApi('elite', 'req-2')).toEqual({ status: 'insufficient_funds' })
    expect(inventory.getState().items).toHaveLength(0)
  })

  it('продажа: предмет уходит, баланс — из ответа; повторная продажа не зачисляет', async () => {
    const { api, wallet, inventory } = await load()
    inventory.setState({ items: [{ uid: 'a1', giftId: 'plush-pepe', acquiredAt: 1, source: 'case-open' }] })
    const responses = [
      reply(200, { status: 'ok', credited_minor: 1500, gift_id: 'plush-pepe', balance_minor: 7500 }),
      reply(409, { detail: 'Подарок уже продан или недоступен', code: 'item_unavailable' }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => responses.shift()!))
    expect(await api.sellItemApi('a1', 'r1')).toEqual({ status: 'ok', creditedMinor: 1500, giftId: 'plush-pepe' })
    expect(wallet.getState().balances.demo).toBe(7500)
    expect(inventory.getState().items).toHaveLength(0)
    expect(await api.sellItemApi('a1', 'r2')).toEqual({ status: 'not_found' })
    expect(wallet.getState().balances.demo).toBe(7500)
  })

  it('мины: раскладка раскрывается только после конца раунда', async () => {
    const { api, wallet } = await load()
    const responses = [
      reply(200, { status: 'ok', round_id: 'round-1', balance_minor: 9000 }),
      reply(200, { status: 'ok', event: 'safe', picked_count: 1, multiplier_hundredths: 109, payout_minor: 0, mine_positions: null, balance_minor: 9000 }),
      reply(200, { status: 'ok', event: 'lost', picked_count: 1, multiplier_hundredths: 0, payout_minor: 0, mine_positions: [0, 1, 2], balance_minor: 9000 }),
      reply(200, { balance_minor: 9000, items: [], stars: 0, quests_claimed: {}, metrics: {}, free_next_at: {}, free_quest: { pending: null, joined: 0, target: 5, completed: false }, me: {} }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => responses.shift() ?? reply(200, {})))
    expect((await api.startMinesApi(1000, 3, 'm1')).status).toBe('ok')
    expect(wallet.getState().balances.demo).toBe(9000)
    const safe = await api.pickMinesApi(10, 'p1')
    expect(safe).toMatchObject({ status: 'ok', event: 'safe', minePositions: null })
    const boom = await api.pickMinesApi(0, 'p2')
    expect(boom).toMatchObject({ status: 'ok', event: 'lost', minePositions: [0, 1, 2] })
    expect(await api.pickMinesApi(5, 'p3')).toEqual({ status: 'rejected', reason: 'no_round' })
  })

  it('без входа через Telegram действия отклоняются, локально ничего не начисляется', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SERVER_MODE', '1')
    vi.doMock('../lib/auth', () => ({ authHeaders: async () => ({}), getAuthToken: async () => null }))
    const api = await import('./gameApi')
    const wallet = (await import('../store/wallet')).useWalletStore
    wallet.setState({ balances: { demo: 0, real: 0 } })
    await expect(api.openCaseApi('farm', 'x')).rejects.toMatchObject({ code: 'no_auth' })
    expect(wallet.getState().balances.demo).toBe(0)
  })

  it('обмен звёзд и задания идут через сервер', async () => {
    const { api, wallet } = await load()
    const state = { balance_minor: 2000, items: [], stars: 50, quests_claimed: { 'upgrade-1': true }, metrics: {}, free_next_at: {}, free_quest: { pending: null, joined: 0, target: 5, completed: false }, me: {} }
    const responses = [reply(200, { status: 'ok', balance_minor: 2000, credited_minor: 2000 }), reply(200, state)]
    vi.stubGlobal('fetch', vi.fn(async () => responses.shift() ?? reply(200, state)))
    expect(await api.exchangeStarsApi(350)).toBe('ok')
    expect(wallet.getState().balances.demo).toBe(2000)
    vi.stubGlobal('fetch', vi.fn(async () => reply(409, { detail: 'Недостаточно звёзд', code: 'insufficient_stars' })))
    expect(await api.exchangeStarsApi(350)).toBe('insufficient')
  })

  it('FREE 24: после третьего прокрута сервер просит пополнение, дорогой FREE — только один раз', async () => {
    const { api } = await load()
    const state = { balance_minor: 0, items: [], stars: 0, quests_claimed: {}, metrics: {}, free_next_at: {}, free_used: { free: true }, free_gate: { deposit_required: true }, free_quest: { pending: null, joined: 0, target: 5, completed: false }, me: {} }
    const claims = [
      reply(200, { status: 'ok', gift_id: 'ton_5', uid: '', deposit_required: true, balance_minor: 5 }),
      reply(403, { detail: 'Пополните', code: 'deposit_required' }),
      reply(200, { status: 'used', balance_minor: 0 }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (String(url).includes('/claim') ? claims.shift()! : reply(200, state))),
    )
    expect(await api.claimFreeCaseApi('free24', 'a')).toMatchObject({ status: 'ok', depositRequired: true })
    expect(await api.claimFreeCaseApi('free24', 'b')).toEqual({ status: 'deposit_required' })
    expect(await api.claimFreeCaseApi('free', 'c')).toEqual({ status: 'used' })
  })
})
