import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, RARITY_LABELS } from '../../data/catalog'
import { useInventoryStore, type InventoryItem } from '../../store/inventory'
import { BottomSheet, Button, GramAmount, Input } from '../ui'
import { CubeIcon } from '../shell/icons'
import { cx } from '../../lib/cx'
import { openOwnerChat, OWNER_HANDLE } from '../../lib/telegram'
import styles from './GiftPickerSheet.module.css'

export interface GiftPickerSheetProps {
  open: boolean
  onClose: () => void
  /** Подтверждение выбора: получает реальный предмет инвентаря (uid, giftId). */
  onConfirm: (item: InventoryItem) => void
  title?: string
  /** Эти подарки уже в ставке — в списке их не показываем. */
  excludeUids?: readonly string[]
  /** Режим «несколько сразу»: отмечаем галочками до maxSelect подарков и подтверждаем одним нажатием. */
  multiple?: boolean
  maxSelect?: number
  onConfirmMany?: (items: InventoryItem[]) => void
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
  excludeUids,
  multiple = false,
  maxSelect = 5,
  onConfirmMany,
}: GiftPickerSheetProps) {
  const navigate = useNavigate()
  const allItems = useInventoryStore((s) => s.items)
  const items = useMemo(
    () => (excludeUids && excludeUids.length ? allItems.filter((i) => !excludeUids.includes(i.uid)) : allItems),
    [allItems, excludeUids],
  )
  const [query, setQuery] = useState('')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])

  // Каждое открытие — чистое состояние: без прошлого поиска и выбора
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedUid(null)
      setPicked([])
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
            <Button variant="secondary" onClick={() => openOwnerChat()}>
              Отправить подарки
            </Button>
            <p className={styles.emptyHint}>
              Отправьте подарки {OWNER_HANDLE}: после проверки они появятся в инвентаре
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
                  className={cx(styles.row, (multiple ? picked.includes(item.uid) : item.uid === selectedUid) && styles.rowActive)}
                  data-rarity={gift.rarity}
                  aria-pressed={multiple ? picked.includes(item.uid) : item.uid === selectedUid}
                  onClick={() => {
                    if (!multiple) return setSelectedUid(item.uid)
                    setPicked((p) =>
                      p.includes(item.uid) ? p.filter((u) => u !== item.uid) : p.length >= maxSelect ? p : [...p, item.uid],
                    )
                  }}
                >
                  {(multiple ? picked.includes(item.uid) : item.uid === selectedUid) && <span className={styles.check} aria-hidden>✓</span>}
                  <img loading="lazy" decoding="async"
                    className={cx(styles.image, /_\d\.webp$/.test(gift.image) ? styles.imageFull : styles.imageContain)}
                    src={gift.image}
                    alt=""
                  />
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
            {multiple ? (
              <>
                <span className={picked.length ? styles.selected : styles.selectedMuted}>
                  {picked.length
                    ? <>Выбрано: <strong>{picked.length}</strong> из {maxSelect} · <GramAmount minor={rows.filter((r) => picked.includes(r.item.uid)).reduce((a, r) => a + r.gift.priceMinor, 0)} /></>
                    : `Отметьте до ${maxSelect} подарков`}
                </span>
                <Button
                  fullWidth
                  disabled={picked.length === 0}
                  onClick={() => {
                    onConfirmMany?.(rows.filter((r) => picked.includes(r.item.uid)).map((r) => r.item))
                    onClose()
                  }}
                >
                  {picked.length > 1 ? `Добавить ${picked.length}` : 'Добавить'}
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </>
      )}
    </BottomSheet>
  )
}
