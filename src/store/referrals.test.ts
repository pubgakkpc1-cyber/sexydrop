import { beforeEach, describe, expect, it } from 'vitest'
import { parseReferrerId, setReferralTransport, REFERRAL_BONUS_STARS, type ReferralEvent } from '../lib/referral'
import { useReferralsStore, referralStarsEarned } from './referrals'
import { useStarsBalanceStore } from './starsBalance'

beforeEach(() => {
  setReferralTransport(null)
  useReferralsStore.setState({ referredBy: null, qualified: false, outbox: [], credited: {} })
  useStarsBalanceStore.setState({ stars: 0 })
})

describe('рефералы: +2 ★ за друга, открывшего бесплатный кейс', () => {
  it('start_param «ref-123» разбирается, мусор отбрасывается', () => {
    expect(parseReferrerId('ref-123456')).toBe('123456')
    expect(parseReferrerId('ref-')).toBeNull()
    expect(parseReferrerId('abc')).toBeNull()
    expect(parseReferrerId(undefined)).toBeNull()
  })

  it('пригласившего запоминают один раз и не себя', () => {
    useReferralsStore.getState().setReferrer('555', '555')
    expect(useReferralsStore.getState().referredBy).toBeNull()
    useReferralsStore.getState().setReferrer('555', '777')
    useReferralsStore.getState().setReferrer('999', '777')
    expect(useReferralsStore.getState().referredBy).toBe('555')
  })

  it('друг открыл бесплатный кейс: событие уходит пригласившему один раз (без канала — в очередь)', () => {
    useReferralsStore.getState().setReferrer('555', '777')
    useReferralsStore.getState().onFreeCaseOpened('777')
    useReferralsStore.getState().onFreeCaseOpened('777')
    const s = useReferralsStore.getState()
    expect(s.qualified).toBe(true)
    expect(s.outbox).toHaveLength(1)
    expect(s.outbox[0]).toMatchObject({ referrerId: '555', friendId: '777' })

    const delivered: ReferralEvent[] = []
    setReferralTransport((e) => delivered.push(e))
    useReferralsStore.getState().flushOutbox()
    expect(delivered).toHaveLength(1)
    expect(useReferralsStore.getState().outbox).toHaveLength(0)
  })

  it('пригласивший получает +2 ★ мгновенно и ровно один раз за друга', () => {
    expect(useReferralsStore.getState().creditFriend('777')).toBe(true)
    expect(useReferralsStore.getState().creditFriend('777')).toBe(false)
    expect(useReferralsStore.getState().creditFriend('888')).toBe(true)
    expect(useStarsBalanceStore.getState().stars).toBe(REFERRAL_BONUS_STARS * 2)
    expect(referralStarsEarned(useReferralsStore.getState().credited)).toBe(4)
  })
})
