import { describe, expect, it } from 'vitest'
import { giftById } from '../data/catalog'
import { buildWithdrawMessage } from './withdraw'

describe('buildWithdrawMessage', () => {
  it('содержит подарок, цену и номер выдачи', () => {
    const gift = giftById.get('plush-pepe')!
    const text = buildWithdrawMessage(gift, 'abc123')
    expect(text).toContain('Plush Pepe')
    expect(text).toContain('25 TON')
    expect(text).toContain('abc123')
  })
})
