import { afterEach, describe, expect, it } from 'vitest'
import { caseById } from '../data/catalog'
import { claimFreeCase } from '../services/demoCaseService'
import { defaultEntries, setCaseWeights } from './caseOdds'

describe('caseOdds', () => {
  afterEach(() => setCaseWeights('free24', null))

  it('веса админа подменяют шансы кейса, сброс возвращает дефолт', () => {
    const def = caseById.get('free24')!
    const [keep, ...rest] = defaultEntries('free24')
    setCaseWeights('free24', { [keep!.itemId]: 5 })
    expect(def.entries).toEqual([{ itemId: keep!.itemId, weight: 5 }])
    // розыгрыш реально берёт веса из кейса: выпадает только оставшийся приз
    const res = claimFreeCase('free24', 'odds-test-1', Date.now(), () => 0.5)
    expect(res.status === 'ok' ? res.giftId : null).toBe(keep!.itemId)
    setCaseWeights('free24', null)
    expect(def.entries.length).toBe(rest.length + 1)
  })
})
