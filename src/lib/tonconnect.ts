import type { TonConnectUI } from '@tonconnect/ui'

let instance: Promise<TonConnectUI> | null = null

/**
 * Один экземпляр TON Connect на приложение; библиотека (и окно выбора кошелька: Tonkeeper,
 * Tonhub, MyTonWallet, Telegram Wallet и др.) грузится только когда открыт способ «TON».
 */
export function getTonConnect(): Promise<TonConnectUI> {
  if (!instance) {
    instance = import('@tonconnect/ui').then(
      ({ TonConnectUI, THEME }) =>
        new TonConnectUI({
          manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
          uiPreferences: { theme: THEME.DARK },
          language: 'ru',
          actionsConfiguration: { twaReturnUrl: 'https://t.me/sexydropbot' },
        }),
    )
    instance.catch(() => {
      instance = null
    })
  }
  return instance
}
