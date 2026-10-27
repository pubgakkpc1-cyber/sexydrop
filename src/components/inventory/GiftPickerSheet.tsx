import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, RARITY_LABELS } from '../../data/catalog'
import { useInventoryStore, type InventoryItem } from '../../store/inventory'
import { BottomSheet, Button, GramAmount, Input } from '../ui'
import { CubeIcon } from '../shell/icons'
import { cx } from '../../lib/cx'
import styles from './GiftPickerSheet.module.css'

export interface GiftPickerSheetProps {
  open: boolean
  onClose: () => void
  /** Подтверждение выбора: получает реальный предмет инвентаря (uid, giftId). */
  onConfirm: (item: InventoryItem) => void
  title?: string
}

/**
 * Выбор подарка для игры (3.3, спека раздела 9). Показывает ТОЛЬКО реальные
 * предметы инвентаря; цена у каждого предмета — из каталога (справочная:
 * в Dual Betting 4.1 итоговую цену операции фиксирует сервер, а не клиент).
 * Пустой инвентарь — состояние с «Открыть кейсы» и честно недоступной
 * «Отправить подарки» (подтверждённого внешнего сервиса пока нет).
 */
export function GiftPickerSheet({
  open,
  onClose,
  onConfirm,
  title = 'Выберите ваш подарок',
}: GiftPickerSheetProps) {
  const navigate = useNavigate()
  const items = useInventoryStore((s) => s.items)
  const [query, setQuery] = useState('')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)

  // Каждое открытие — чистое состояние: без прошлого поиска и выбора
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedUid(null)
    }
  }, [open])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .flatMap((item) => {
        const gift = giftById.get(item.giftId)
        return gift ? [{ item, gift }] : []
      })
      .filter(({ gift }) => q === '' || gift.name.toLowerCase().includes(q))
      .sort(
        (a, b) => b.gift.priceMinor - a.gift.priceMinor || a.item.uid.localeCompare(b.item.uid),
      )
  }, [items, query])

  const selected = selectedUid === null ? null : (rows.find(({ item }) => item.uid === selectedUid) ?? null)

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {items.length === 0 ? (
        <div className={styles.empty}>
          <CubeIcon className={styles.emptyIcon} />
          <strong>Пока нет подарков</strong>
          <span>Откройте кейс, чтобы получить подарок</span>
          <Button
            onClick={() => {
              onClose()
              navigate('/')
            }}
          >
            Открыть кейсы
          </Button>
          <div className={styles.emptySecondary}>
            <Button variant="secondary" disabled>
              Отправить подарки
            </Button>
            <p className={styles.emptyHint}>
              Получение подарков извне появится после подключения сервера
            </p>
          </div>
        </div>
      ) : (
        <>
          <Input
            type="search"
            aria-label="Поиск подарка"
            placeholder="Поиск подарка"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className={styles.list}>
            {rows.map(({ item, gift }) => (
              <li key={item.uid}>
                <button
                  type="button"
                  className={cx(styles.row, item.uid === selectedUid && styles.rowActive)}
                  data-rarity={gift.rarity}
                  aria-pressed={item.uid === selectedUid}
                  onClick={() => setSelectedUid(item.uid)}
                >
                  <img className={styles.image} src={gift.image} alt="" />
                  <span className={styles.name}>{gift.name}</span>
                  <span className={styles.meta}>
                    <span className={styles.rarity}>{RARITY_LABELS[gift.rarity]}</span>
                    <GramAmount minor={gift.priceMinor} />
                  </span>
                </button>
              </li>
            ))}
            {rows.length === 0 && <li className={styles.noMatches}>Ничего не найдено</li>}
          </ul>
          <div className={styles.footer}>
            {selected ? (
              <span className={styles.selected}>
                Выбран: <strong>{selected.gift.name}</strong>
                {' · '}
                <GramAmount minor={selected.gift.priceMinor} />
              </span>
            ) : (
              <span className={styles.selectedMuted}>Выберите подарок из списка</span>
            )}
            <Button
              fullWidth
              disabled={!selected}
              onClick={() => {
                if (selected) {
                  onConfirm(selected.item)
                  onClose()
                }
              }}
            >
              Подтвердить
            </Button>
          </div>
        </>
      )}
    </BottomSheet>
  )
}
