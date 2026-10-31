/** Награда пригласившему за каждого друга, который открыл бесплатный кейс. */
export const REFERRAL_BONUS_STARS = 2

/** «ref-12345» → «12345»; всё остальное — не реферальный параметр. */
export function parseReferrerId(startParam: string | undefined | null): string | null {
  if (!startParam) return null
  const m = /^ref-(\d{3,20})$/.exec(startParam.trim())
  return m ? m[1]! : null
}

export interface ReferralEvent {
  referrerId: string
  friendId: string
  at: number
}

type Transport = (event: ReferralEvent) => void

let transport: Transport | null = null

/**
 * Канал доставки события «друг открыл бесплатный кейс» пригласившему. Пока серверной части нет,
 * события копятся в очереди (store/referrals) и отправляются, как только канал подключён.
 */
export function setReferralTransport(next: Transport | null): void {
  transport = next
}

export function sendReferralEvent(event: ReferralEvent): boolean {
  if (!transport) return false
  try {
    transport(event)
    return true
  } catch {
    return false
  }
}
