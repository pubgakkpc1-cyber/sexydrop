import { useState } from 'react'
import type { Gift } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { makeRequestId } from '../../lib/requestId'
import { queueNextRoundGiftBet } from '../../services/demoCrashService'
import { sellItem } from '../../services/demoInventoryService'
import { useInventoryStore } from '../../store/inventory'
import { BottomSheet } from '../ui'
import { RocketIcon, TonIcon } from '../shell/icons'
import styles from './RocketRewardSheet.module.css'

export interface RocketRewardSheetProps {
  gift: Gift
  onClose: () => void
}

/**
 * «Награда Ракеты!»: выигранный NFT уже лежит в инвентаре; игрок выбирает —
 * поставить его в Ракете, продать по каталог-цене или оставить.
 */
export function RocketRewardSheet({ gift, onClose }: RocketRewardSheetProps) {
  const [error, setError] = useState<string | null>(null)

  // Последний полученный предмет с этим giftId — именно тот, что выпал только что.
  const findUid = (): string | null => {
    const items = useInventoryStore.getState().items.filter((i) => i.giftId === gift.id)
    const latest = items.sort((a, b) => b.acquiredAt - a.acquiredAt)[0]
    return latest?.uid ?? null
  }

  const handleBet = () => {
    const uid = findUid()
    if (!uid) {
      setError('Подарок уже недоступен')
      return
    }
    const res = queueNextRoundGiftBet(uid, makeRequestId())
    if (res.status === 'ok') onClose()
    else setError('Не удалось поставить подарок — попробуйте ещё раз')
  }

  const handleSell = () => {
    const uid = findUid()
    if (!uid) {
      setError('Подарок уже недоступен')
      return
    }
    const res = sellItem(uid, makeRequestId())
    if (res.status === 'ok') onClose()
    else setError('Подарок уже недоступен')
  }

  return (
    <BottomSheet open onClose={onClose} title="Награда Ракеты!">
      <div className={styles.body}>
        <span className={styles.art} data-rarity={gift.rarity}>
          <img
            className={gift.image.endsWith('.png') ? styles.imageFull : styles.imageContain}
            src={gift.image}
            alt=""
          />
        </span>
        <strong className={styles.name}>{gift.name}</strong>
        <span className={styles.chip}>Выигрыш</span>
        <span className={styles.price}>
          {formatMinor(gift.priceMinor)}
          <TonIcon className={styles.priceIcon} aria-hidden />
        </span>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="button" className={styles.cta} onClick={handleBet}>
          <RocketIcon className={styles.ctaIcon} aria-hidden />
          Поставить в Ракете
        </button>
        <div className={styles.row}>
          <button type="button" className={styles.sell} onClick={handleSell}>
            Продать
          </button>
          <button type="button" className={styles.keep} onClick={onClose}>
            Оставить
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
