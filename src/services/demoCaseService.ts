import { caseById, giftById, isTonPrize, type CaseDefinition, type FreeCaseId } from '../data/catalog'
import { pickWeighted } from '../lib/caseMath'
import { createRequestMemo } from '../lib/requestMemo'
import { useFreeCasesStore } from '../store/freeCases'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useReferralsStore } from '../store/referrals'
import { track } from '../lib/telemetry'
import { useProfileStore } from '../store/profile'
import { getTelegramUser } from '../lib/telegram'

export type OpenCaseResult =
  | { status: 'ok'; giftId: string; uid: string }
  | { status: 'insufficient_funds' }

export type ClaimFreeResult =
  | { status: 'ok'; giftId: string; uid: string }
  | { status: 'cooldown'; nextAvailableAt: number }

/**
 * DEMO MODE ONLY. Эмулирует серверный цикл «проверка → списание → розыгрыш →
 * начисление → история» одной синхронной операцией с идемпотентностью по
 * client_request_id. Реальная серверная реализация с атомарными транзакциями
 * БД, CSPRNG и журналом транзакций — TIER 7 (roadmap 2.7/7.5/7.7).
 */
const processedRequests = createRequestMemo<OpenCaseResult | ClaimFreeResult>()

function processOnce<T extends OpenCaseResult | ClaimFreeResult>(
  clientRequestId: string,
  execute: () => T,
): T {
  const cached = processedRequests.get(clientRequestId)
  if (cached) return cached as T
  const result = execute()
  processedRequests.set(clientRequestId, result)
  return result
}

function requirePaidCase(caseId: string): CaseDefinition {
  const definition = caseById.get(caseId)
  if (!definition) throw new Error(`Unknown case: ${caseId}`)
  if (definition.freeCooldownMs !== null) throw new Error(`Case ${caseId} is free, use claimFreeCase`)
  return definition
}

/** Покупка и открытие платного кейса. Идемпотентно по clientRequestId. */
export function openCase(
  caseId: string,
  clientRequestId: string,
  rng: () => number = Math.random,
): OpenCaseResult {
  return processOnce(clientRequestId, () => {
    const definition = requirePaidCase(caseId)
    const wallet = useWalletStore.getState()

    if (wallet.getBalance() < definition.priceMinor) {
      return { status: 'insufficient_funds' } as const
    }

    // Атомарность demo-цикла: списание и начисление идут подряд без внешних
    // await, поэтому состояние не может «разъехаться» посреди операции.
    wallet.debit(definition.priceMinor)
    const chosen = pickWeighted(definition.entries, rng)
    if (isTonPrize(chosen.itemId)) {
      // выигрыш в TON: сразу на баланс, в инвентарь не попадает
      const amount = Number(chosen.itemId.slice(4))
      wallet.credit(amount)
      useProfileStore.getState().caseOpened()
      track({ type: 'case', case: caseId, price: definition.priceMinor, prize: amount })
      return { status: 'ok', giftId: chosen.itemId, uid: '' } as const
    }
    const [item] = useInventoryStore.getState().addGifts([chosen.itemId], 'case-open')
    if (!item) throw new Error('Inventory did not accept the gift')
    useProfileStore.getState().caseOpened()
    track({ type: 'case', case: caseId, price: definition.priceMinor, prize: giftById.get(chosen.itemId)?.priceMinor ?? 0 })
    return { status: 'ok', giftId: chosen.itemId, uid: item.uid } as const
  })
}

/** Получение бесплатного кейса с проверкой кулдауна. Идемпотентно по clientRequestId. */
export function claimFreeCase(
  caseId: FreeCaseId,
  clientRequestId: string,
  now: number = Date.now(),
  rng: () => number = Math.random,
): ClaimFreeResult {
  return processOnce(clientRequestId, () => {
    const definition = caseById.get(caseId)
    if (!definition || definition.freeCooldownMs === null) {
      throw new Error(`Not a free case: ${caseId}`)
    }
    const freeCases = useFreeCasesStore.getState()
    const nextAvailableAt = freeCases.nextAvailableAt(caseId, now)
    if (nextAvailableAt > now) {
      return { status: 'cooldown', nextAvailableAt } as const
    }

    const chosen = pickWeighted(definition.entries, rng)
    if (isTonPrize(chosen.itemId)) {
      useWalletStore.getState().credit(Number(chosen.itemId.slice(4)))
      freeCases.claim(caseId, now)
      useProfileStore.getState().caseOpened()
      useReferralsStore.getState().onFreeCaseOpened(getTelegramUser()?.id?.toString())
      track({ type: 'case', case: caseId, price: 0, prize: Number(chosen.itemId.slice(4)) })
      return { status: 'ok', giftId: chosen.itemId, uid: '' } as const
    }
    const [item] = useInventoryStore.getState().addGifts([chosen.itemId], 'free-case')
    if (!item) throw new Error('Inventory did not accept the gift')
    freeCases.claim(caseId, now)
    useProfileStore.getState().caseOpened()
    useReferralsStore.getState().onFreeCaseOpened(getTelegramUser()?.id?.toString())
    track({ type: 'case', case: caseId, price: 0, prize: giftById.get(chosen.itemId)?.priceMinor ?? 0 })
    return { status: 'ok', giftId: chosen.itemId, uid: item.uid } as const
  })
}
