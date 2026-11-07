import { getWebApp, shareTelegramLink } from './telegram'

/** Какая гифка уходит другу: своя для каждого места с реферальной ссылкой. */
export type RefGifKind = 'invite' | 'unlock' | 'roulette'

interface ShareCapableWebApp {
  initData?: string
  shareMessage?: (id: string, callback?: (sent: boolean) => void) => void
  isVersionAtLeast?: (version: string) => boolean
}

/**
 * «Пригласить друзей»: сервер готовит сообщение «гифка + подпись с текстовой ссылкой "Тык — …"»,
 * Telegram открывает выбор чата (WebApp.shareMessage, Bot API 8.0+). Если Telegram старый или
 * сервер не ответил — обычное «Поделиться» ссылкой с текстом.
 */
export async function shareRefGif(kind: RefGifKind, link: string, fallbackText: string): Promise<'gif' | 'link'> {
  const webApp = getWebApp() as unknown as ShareCapableWebApp | undefined
  const canShareMessage =
    typeof webApp?.shareMessage === 'function' && (webApp.isVersionAtLeast?.('8.0') ?? true) && Boolean(webApp.initData)
  if (canShareMessage) {
    try {
      const res = await fetch('/api/referrals/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: webApp!.initData, kind }),
      })
      if (res.ok) {
        const { id } = (await res.json()) as { id?: string }
        if (id) {
          webApp!.shareMessage!(id)
          return 'gif'
        }
      }
    } catch {
      /* сеть/сервер — ниже обычное «Поделиться» */
    }
  }
  shareTelegramLink(link, fallbackText)
  return 'link'
}
