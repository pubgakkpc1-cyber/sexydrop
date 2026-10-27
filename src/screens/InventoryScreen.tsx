import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, type Rarity } from '../data/catalog'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { DiamondIcon, SearchIcon } from '../components/shell/icons'
import { GiftCard } from '../components/inventory/GiftCard'
import { ItemActionsSheet } from '../components/inventory/ItemActionsSheet'
import { InventoryHistory } from '../components/inventory/InventoryHistory'
import { Button, Input } from '../components/ui'
import { cx } from '../lib/cx'
import styles from './screens.module.css'
import filterStyles from './InventoryScreen.module.css'

type RarityFilter = 'all' | Rarity
type SortMode = 'new' | 'expensive' | 'cheap'

const RARITY_FILTERS: ReadonlyArray<{ id: RarityFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'common', label: 'Обычные' },
  { id: 'rare', label: 'Редкие' },
  { id: 'epic', label: 'Эпические' },
  { id: 'legendary', label: 'Легендарные' },
]

const SORT_MODES: ReadonlyArray<{ id: SortMode; label: string }> = [
  { id: 'new', label: 'Новые' },
  { id: 'expensive', label: 'Дорогие' },
  { id: 'cheap', label: 'Дешёвые' },
]

/**
 * Инвентарь (3.1/3.2): пустое и заполненное состояния, карточки подарков
 * и фильтры. Фильтры и сортировка — клиентский вид поверх реального состояния
 * стора; сами данные приходят только из настоящих операций (открытие кейсов и т.д.).
 */
export function InventoryScreen() {
  const navigate = useNavigate()
  const items = useInventoryStore((s) => s.items)

  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState<RarityFilter>('all')
  const [sort, setSort] = useState<SortMode>('new')
  /** Предмет, для которого открыт шит действий (3.4: продажа/передача). */
  const [selected, setSelected] = useState<InventoryItem | null>(null)

  const joined = useMemo(
    () =>
      items.flatMap((item) => {
        const gift = giftById.get(item.giftId)
        return gift ? [{ item, gift }] : []
      }),
    [items],
  )

  const counts = useMemo(() => {
    const map: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }
    for (const { gift } of joined) map[gift.rarity] += 1
    return map
  }, [joined])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = joined.filter(
      ({ gift }) =>
        (rarity === 'all' || gift.rarity === rarity) &&
        (q === '' || gift.name.toLowerCase().includes(q)),
    )
    return [...filtered].sort((a, b) => {
      if (sort === 'expensive') return b.gift.priceMinor - a.gift.priceMinor
      if (sort === 'cheap') return a.gift.priceMinor - b.gift.priceMinor
      // «Новые»: по времени получения, при равенстве — стабильный порядок по uid
      return b.item.acquiredAt - a.item.acquiredAt || a.item.uid.localeCompare(b.item.uid)
    })
  }, [joined, query, rarity, sort])

  const filtering = query.trim() !== '' || rarity !== 'all'

  const resetFilters = () => {
    setQuery('')
    setRarity('all')
    setSort('new')
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Инвентарь</h1>
      <p className={styles.lead}>
        {filtering
          ? `Показано ${visible.length} из ${items.length}`
          : items.length > 0
            ? `${items.length} шт.`
            : 'Твои подарки'}
      </p>

      {items.length === 0 ? (
        /* Пустое состояние по референсу @epic_gift_bot: тёмная карточка, алмаз
           в круге, честная CTA кейсов (внешние ссылки референса не подтверждены). */
        <div className={filterStyles.emptyCard}>
          <span className={filterStyles.emptyIcon} aria-hidden>
            <DiamondIcon />
          </span>
          <strong className={filterStyles.emptyTitle}>Ваш инвентарь пуст</strong>
          <p className={filterStyles.emptyText}>
            Откройте кейсы — полученные подарки появятся здесь
          </p>
          <Button fullWidth onClick={() => navigate('/')}>
            Открыть кейсы
          </Button>
          <p className={filterStyles.emptyHint}>
            Demo Mode: предметы создаются локально и не являются ценностями
          </p>
        </div>
      ) : (
        <>
          <div className={filterStyles.filters}>
            <Input
              type="search"
              aria-label="Поиск подарка"
              placeholder="Поиск подарка"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div role="group" aria-label="Фильтр по редкости" className={filterStyles.chips}>
              {RARITY_FILTERS.map(({ id, label }) => {
                const count = id === 'all' ? joined.length : counts[id]
                return (
                  <button
                    key={id}
                    type="button"
                    className={cx(filterStyles.chip, rarity === id && filterStyles.chipActive)}
                    aria-pressed={rarity === id}
                    onClick={() => setRarity(id)}
                  >
                    {label}
                    <span className={filterStyles.chipCount}>{count}</span>
                  </button>
                )
              })}
            </div>
            <div role="group" aria-label="Сортировка" className={filterStyles.chips}>
              {SORT_MODES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={cx(filterStyles.chip, sort === id && filterStyles.chipActive)}
                  aria-pressed={sort === id}
                  onClick={() => setSort(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className={styles.placeholder}>
              <SearchIcon className={styles.placeholderIcon} />
              <strong>Ничего не найдено</strong>
              <span>Попробуйте изменить фильтры или поиск</span>
              <Button size="sm" variant="secondary" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </div>
          ) : (
            <div className={filterStyles.grid}>
              {visible.map(({ item, gift }) => (
                <GiftCard key={item.uid} gift={gift} onClick={() => setSelected(item)} />
              ))}
            </div>
          )}
        </>
      )}

      <InventoryHistory />

      {selected && (
        <ItemActionsSheet
          item={selected}
          onClose={() => {
            // Если предмет продан, он уже удалён из стора — селект очищается
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
