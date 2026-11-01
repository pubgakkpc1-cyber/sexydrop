import { getWebApp } from './telegram'
import { setReferralTransport } from './referral'
import { useReferralsStore } from '../store/referrals'
import { useFreeCasesStore } from '../store/freeCases'

interface MineResponse {
  friends: Array<{ id: string; premium: boolean; qualified: boolean }>
}

function initData(): string | undefined {
  return (getWebApp() as unknown as { initData?: string } | undefined)?.initData || undefined
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const data = initData()
  if (!data) return null
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: data, ...body }),
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/**
 * Забирает с сервера друзей текущего игрока: за каждого, кто открыл бесплатный кейс, начисляет
 * +2 ★ (один раз), а друзей с Telegram Premium передаёт в задание «5 друзей» бесплатного кейса.
 */
export async function syncReferrals(): Promise<void> {
  const res = await post<MineResponse>('/api/referrals/mine', {})
  if (!res) return
  const referrals = useReferralsStore.getState()
  let premium = 0
  for (const friend of res.friends) {
    if (!friend.qualified) continue
    referrals.creditFriend(friend.id)
    if (friend.premium) premium += 1
  }
  useFreeCasesStore.getState().setPremiumTotal(premium)
}

/** Друг сообщает серверу, что пришёл по ссылке (join) и открыл бесплатный кейс (qualify). */
export function startReferralSync(): void {
  setReferralTransport(() => {
    void post('/api/referrals/qualify', {})
  })
  const { referredBy, qualified } = useReferralsStore.getState()
  if (referredBy) {
    void post('/api/referrals/join', { inviter_id: Number(referredBy) }).then(() => {
      if (qualified) void post('/api/referrals/qualify', {})
    })
  }
  void syncReferrals()
  window.setInterval(() => void syncReferrals(), 60_000)
}
