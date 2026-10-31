import { useEffect, useMemo, useState } from 'react'
import { RARITY_LABELS, type Gift } from '../../data/catalog'
import { upgradeChancePercent } from '../../services/demoUpgradeService'
import { BottomSheet, Button, GramAmount, Input } from '../ui'
import { cx } from '../../lib/cx'
import styles from './GiftPickerSheet.module.css'

export interface UpgradeTargetSheetProps {
  open: boolean
  onClose: () => void
  /** Цели апгрейда (отсортированы по возрастанию цены). */
  targets: readonly Gift[]
  /** Цена предмета-источника, minor (для шанса на карточках); null — предмет не выбран. */
  sourcePriceMinor: number | null
  selectedId: string | null
  onConfirm: (giftId: string) => void
}

function fmtPct(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

type Order = 'cheap' | 'expensive'

/**
 * Окно выбора цели апгрейда — в том же виде, что и выбор предмета-ставки:
 * поиск, сетка карточек с шансом, выбор и «Подтвердить».
 */
export function UpgradeTargetSheet({
  open,
  onClose,
  targets,
  sourcePriceMinor,
  selectedId,
  onConfirm,
}: UpgradeTargetSheetProps) {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<Order>('cheap')
  const [pickedId, setPickedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setPickedId(selectedId)
    }
  }, [open, selectedId])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = targets
      .filter((g) => (sourcePriceMinor === null || g.priceMinor > sourcePriceMinor || g.id === selectedId))
      .filter((g) => q === '' || g.name.toLowerCase().includes(q))
    return [...list].sort((a, b) => (order === 'cheap' ? a.priceMinor - b.priceMinor : b.priceMinor - a.priceMinor))
  }, [targets, query, order, sourcePriceMinor, selectedId])

  const picked = pickedId === null ? null : (targets.find((g) => g.id === pickedId) ?? null)
  const pickedChance =
    picked && sourcePriceMinor !== null ? upgradeChancePercent(sourcePriceMinor, picked.priceMinor) : null

  return (
    <BottomSheet open={open} onClose={onClose} title="Цель апгрейда">
      <div className={styles.toolbar}>
        <Input
          type="search"
          aria-label="Поиск цели"
          placeholder="Поиск подарка"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.chips} role="group" aria-label="Сортировка целей">
          <button type="button" className={cx(styles.chip, order === 'cheap' && styles.chipActive)} aria-pressed={order === 'cheap'} onClick={() => setOrder('cheap')}>
            Больше шанс
          </button>
          <button type="button" className={cx(styles.chip, order === 'expensive' && styles.chipActive)} aria-pressed={order === 'expensive'} onClick={() => setOrder('expensive')}>
            Дороже
          </button>
        </div>
      </div>

      <ul className={styles.list}>
        {rows.map((gift) => {
          const pct = sourcePriceMinor === null ? null : upgradeChancePercent(sourcePriceMinor, gift.priceMinor)
          const active = gift.id === pickedId
          return (
            <li key={gift.id}>
              <button
                type="button"
                className={cx(styles.row, active && styles.rowActive)}
                data-rarity={gift.rarity}
                aria-pressed={active}
                aria-label={gift.name}
                onClick={() => setPickedId(gift.id)}
              >
                {active && <span className={styles.check} aria-hidden>✓</span>}
                {pct !== null && <span className={styles.badge}>{fmtPct(pct)}%</span>}
                <img
                  className={cx(styles.image, /_\d\.png$/.test(gift.image) ? styles.imageFull : styles.imageContain)}
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
          )
        })}
        {rows.length === 0 && <li className={styles.noMatches}>Ничего не найдено</li>}
      </ul>

      <div className={styles.footer}>
        {picked ? (
          <span className={styles.selected}>
            Цель: <strong>{picked.name}</strong>
            {' · '}
            <GramAmount minor={picked.priceMinor} />
            {pickedChance !== null && <> · шанс {fmtPct(pickedChance)}%</>}
          </span>
        ) : (
          <span className={styles.selectedMuted}>Выберите подарок из списка</span>
        )}
        <Button
          fullWidth
          disabled={!picked}
          onClick={() => {
            if (picked) {
              onConfirm(picked.id)
              onClose()
            }
          }}
        >
          Подтвердить
        </Button>
      </div>
    </BottomSheet>
  )
}
