import { giftById } from '../data/catalog'
import { createRequestMemo } from '../lib/requestMemo'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'

export type SellResult =
  | { status: 'ok'; creditedMinor: number; giftId: string }
  | { status: 'not_found' }

/**
 * Правило продажи продукта: предмет продаётся по своей каталог-цене
 * (коэффициент 1.0). В TIER 7 право продажи, цена и атомарность переносятся
 * на сервер; клиентский вызов останется только запросом с clientRequestId.
 */
export const SALE_FACTOR = 1

const processedRequests = createRequestMemo<SellResult>()

function processOnce<T extends SellResult>(clientRequestId: string, execute: () => T): T {
  const cached = processedRequests.get(clientRequestId)
  if (cached) return cached as T
  const result = execute()
  processedRequests.set(clientRequestId, result)
  return result
}

/**
 * DEMO MODE ONLY. Продажа предмета инвентаря: удаление предмета и зачисление
 * GRAM идут одной синхронной операцией (как атомарная транзакция в TIER 7),
 * идемпотентно по clientRequestId — повтор запроса не зачисляет средства дважды.
 */
export function sellItem(uid: string, clientRequestId: string): SellResult {
  return processOnce(clientRequestId, () => {
    const inventory = useInventoryStore.getState()
    const item = inventory.items.find((candidate) => candidate.uid === uid)
    if (!item) return { status: 'not_found' } as const
    const gift = giftById.get(item.giftId)
    if (!gift) throw new Error(`Inventory item references unknown gift: ${item.giftId}`)

    // Атомарность demo-цикла: удаление и зачисление подряд без await.
    inventory.removeUids([uid], 'sold')
    useWalletStore.getState().credit(Math.trunc(gift.priceMinor * SALE_FACTOR))
    return { status: 'ok', creditedMinor: gift.priceMinor, giftId: item.giftId } as const
  })
}
