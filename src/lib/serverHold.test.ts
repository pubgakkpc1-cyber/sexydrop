import { describe, expect, it } from 'vitest'
import { useWalletStore } from '../store/wallet'
import { holdServerUpdates, releaseServerUpdates, setServerBalance } from './serverSync'

describe('удержание ответа сервера на время прокрута кейса', () => {
  it('баланс не меняется, пока рулетка крутится, и обновляется после остановки', () => {
    setServerBalance(1000)
    const mode = useWalletStore.getState().mode
    holdServerUpdates()
    setServerBalance(5000)
    expect(useWalletStore.getState().balances[mode]).toBe(1000)
    releaseServerUpdates()
    expect(useWalletStore.getState().balances[mode]).toBe(5000)
  })
})
