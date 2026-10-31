import { create } from 'zustand'

export type DisplayCurrency = 'TON' | 'STARS'

const KEY = 'sexydrop_display_currency'

function load(): DisplayCurrency {
  try {
    return window.localStorage.getItem(KEY) === 'STARS' ? 'STARS' : 'TON'
  } catch {
    return 'TON'
  }
}

interface DisplayCurrencyState {
  currency: DisplayCurrency
  setCurrency: (currency: DisplayCurrency) => void
}

/** В какой валюте показывать баланс в шапке (на сами деньги не влияет). */
export const useDisplayCurrencyStore = create<DisplayCurrencyState>((set) => ({
  currency: load(),
  setCurrency: (currency) => {
    try {
      window.localStorage.setItem(KEY, currency)
    } catch {
      /* без localStorage — просто не запоминаем */
    }
    set({ currency })
  },
}))
