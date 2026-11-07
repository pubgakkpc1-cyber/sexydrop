import { apiGet } from './api'
import { SERVER_MODE } from './serverMode'
import { useWalletStore } from '../store/wallet'
import { useInventoryStore, type InventoryItem, type InventorySource } from '../store/inventory'
import { REF_CHAT_URL, useRefBankStore } from '../store/refBank'
import { useStarsBalanceStore } from '../store/starsBalance'
import { useQuestsStore } from '../store/quests'
import { useProfileStore } from '../store/profile'
import { useFreeCasesStore } from '../store/freeCases'

export interface ServerItem {
  uid: string
  gift_id: string
  price_minor: number
  source: string
  acquired_at: number
}

export interface FreeQuestServer {
  pending: { uid: string; gift_id: string; expires_at: number; claimed_at: number } | null
  joined: number
  target: number
  completed: boolean
}

export interface ServerState {
  balance_minor: number
  items: ServerItem[]
  stars: number
  quests_claimed: Record<string, boolean>
  metrics: { casesOpened: number; minesRounds: number; upgrades: number; wagered: number; friendDeposits: number }
  free_next_at: Record<string, number>
  free_used: { free: boolean }
  free_gate: { deposit_required: boolean }
  free_quest: FreeQuestServer
  ref_bank?: { stars: number; min: number; per_friend: number; chat_url?: string; history?: Array<{ at: number; d: number; t: string }> }
  me: { id: number; username: string | null; name: string | null }
}

const SOURCES: readonly InventorySource[] = ['case-open', 'free-case', 'upgrade', 'craft', 'raffle', 'crash-drop', 'crash-win']

/** Баланс — только то, что сказал сервер (локально его изменить нельзя: любое действие проверяется там). */
export function setServerBalance(minor: number): void {
  useWalletStore.setState((s) => ({ balances: { ...s.balances, [s.mode]: minor } }))
}

export function setServerItems(items: readonly ServerItem[]): void {
  const mapped: InventoryItem[] = items.map((i) => ({
    uid: i.uid,
    giftId: i.gift_id,
    acquiredAt: i.acquired_at,
    source: (SOURCES as readonly string[]).includes(i.source) ? (i.source as InventorySource) : 'case-open',
  }))
  useInventoryStore.setState({ items: mapped })
}

export function addServerItem(uid: string, giftId: string, source: InventorySource): void {
  if (!uid) return
  useInventoryStore.setState((s) =>
    s.items.some((i) => i.uid === uid) ? s : { items: [...s.items, { uid, giftId, acquiredAt: Date.now(), source }] },
  )
}

export function removeServerItem(uid: string): void {
  useInventoryStore.setState((s) => ({ items: s.items.filter((i) => i.uid !== uid) }))
}

function applyFreeQuest(q: FreeQuestServer): void {
  const quest = useFreeCasesStore.getState().quest
  useFreeCasesStore.setState({
    quest: {
      ...quest,
      pendingReward: q.pending
        ? { giftId: q.pending.gift_id, uid: q.pending.uid, wonAt: q.pending.claimed_at, expiresAt: q.pending.expires_at }
        : null,
      referralsJoined: q.pending ? q.joined : 0,
      premiumTotal: q.joined,
      friendsBaseline: 0,
    },
  })
}

export function applyServerState(state: ServerState): void {
  const prevPending = useFreeCasesStore.getState().quest.pendingReward
  setServerBalance(state.balance_minor)
  setServerItems(state.items)
  useStarsBalanceStore.setState({ stars: state.stars })
  if (state.ref_bank) {
    useRefBankStore.setState({
      stars: state.ref_bank.stars,
      min: state.ref_bank.min,
      chatUrl: state.ref_bank.chat_url || REF_CHAT_URL,
      history: Array.isArray(state.ref_bank.history) ? state.ref_bank.history : [],
    })
  }
  useQuestsStore.setState({ claimed: state.quests_claimed })
  useProfileStore.setState({
    casesOpened: state.metrics.casesOpened,
    minesRounds: state.metrics.minesRounds,
    upgrades: state.metrics.upgrades,
    wageredMinor: state.metrics.wagered,
    friendDeposits: state.metrics.friendDeposits,
  })
  const claims = { ...useFreeCasesStore.getState().lastClaimAt }
  for (const id of ['free', 'free24'] as const) {
    // время следующего сброса > 0 — кейс уже открыт в этом периоде
    claims[id] = (state.free_next_at[id] ?? 0) > 0 ? Date.now() : 0
  }
  // дорогой FREE открывается один раз за всё время
  if (state.free_used?.free) claims.free = 4_102_444_800_000
  useFreeCasesStore.setState({
    lastClaimAt: claims,
    freeUsed: state.free_used?.free ?? false,
    depositRequired: state.free_gate?.deposit_required ?? false,
  })
  applyFreeQuest(state.free_quest)
  // задание выполнено, сервер уже выдал подарок: окно «Награда разблокирована» остаётся, пока игрок его не закроет
  if (prevPending && !state.free_quest.pending && state.items.some((i) => i.uid === prevPending.uid)) {
    const quest = useFreeCasesStore.getState().quest
    useFreeCasesStore.setState({ quest: { ...quest, pendingReward: prevPending, referralsJoined: 5 } })
  }
}

let inflight: Promise<boolean> | null = null

/** Подтягивает с сервера баланс, подарки, звёзды, задания и кулдауны. false — нет входа или связи. */
export function hydrateFromServer(): Promise<boolean> {
  if (!SERVER_MODE) return Promise.resolve(false)
  inflight ??= apiGet<ServerState>('/api/me/state')
    .then((state) => {
      applyServerState(state)
      return true
    })
    .catch(() => false)
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Запускается один раз при старте приложения: первичная загрузка и обновление раз в 20 секунд и при возврате в приложение. */
export function startServerSync(): void {
  if (!SERVER_MODE) return
  void hydrateFromServer()
  window.setInterval(() => void hydrateFromServer(), 20_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void hydrateFromServer()
  })
}
