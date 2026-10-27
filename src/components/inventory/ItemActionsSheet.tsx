import { useState } from 'react'
import { giftById, RARITY_LABELS } from '../../data/catalog'
import { sellItem } from '../../services/demoInventoryService'
import { makeRequestId } from '../../lib/requestId'
import { formatMinor } from '../../lib/money'
import type { InventoryItem } from '../../store/inventory'
import { BottomSheet, Button, GramAmount } from '../ui'
import styles from './ItemActionsSheet.module.css'

const SOURCE_LABELS: Record<InventoryItem['source'], string> = {
  'case-open': 'Из платного кейса',
  'free-case': 'Из бесплатного кейса',
  upgrade: 'Получено апгрейдом',
  craft: 'Получено крафтом',
  raffle: 'Выиграно в розыгрыше',
  'crash-drop': 'Космический дроп в Ракетке',
  'crash-win': 'Победа в Ракетке (эквивалент NFT)',
}

export interface ItemActionsSheetProps {
  item: InventoryItem
  onClose: () => void
}

/**
 * Действия с предметом инвентаря (3.4): продажа и передача. Продажа выполняется
 * demo-сервисом с идемпотентным clientRequestId (контракт сервера TIER 7).
 * Передача — честно недоступна: правила продукта и серверная механика ещё не
 * определены, внешние ссылки не подтверждены (правило спеки 2.4/9).
 */
export function ItemActionsSheet({ item, onClose }: ItemActionsSheetProps) {
  const gift = giftById.get(item.giftId)
  const [sold, setSold] = useState<{ creditedMinor: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!gift) return null

  const handleSell = () => {
    const result = sellItem(item.uid, makeRequestId())
    if (result.status === 'ok') {
      setSold({ creditedMinor: result.creditedMinor })
    } else {
      // Предмет уже продан/недоступен (например, лист из устаревшего состояния):
      // честное восстановление вместо ложного успеха.
      setError('Предмет уже недоступен для продажи')
    }
  }

  return (
    <BottomSheet open onClose={onClose} title="Предмет инвентаря">
      {sold ? (
        <div className={styles.center}>
          <strong className={styles.soldTitle}>Продано</strong>
          <p className={styles.soldNote}>
            Начислено <GramAmount minor={sold.creditedMinor} /> — баланс обновлён
          </p>
          <Button fullWidth onClick={onClose}>
            Готово
          </Button>
        </div>
      ) : (
        <div className={styles.body}>
          <span className={styles.art} data-rarity={gift.rarity}>
            <img className={styles.image} src={gift.image} alt="" />
          </span>
          <strong className={styles.name}>{gift.name}</strong>
          <span className={styles.meta}>
            {RARITY_LABELS[gift.rarity]}
            {' · '}
            {SOURCE_LABELS[item.source]}
            {' · '}
            <GramAmount minor={gift.priceMinor} />
          </span>

          <div className={styles.actions}>
            <Button fullWidth onClick={handleSell}>
              Продать за {formatMinor(gift.priceMinor)} TON
            </Button>
            <p className={styles.hint}>Продажа по каталог-цене; серверные правила появятся позже</p>
            <Button fullWidth variant="secondary" disabled>
              Передать
            </Button>
            <p className={styles.hint}>Передача подарков появится после подключения сервера</p>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}
    </BottomSheet>
  )
}
