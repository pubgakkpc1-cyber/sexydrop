import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById } from '../data/catalog'
import { useInventoryStore } from '../store/inventory'
import { DiamondIcon, SearchIcon, ShareIcon } from '../components/shell/icons'
import { InventoryGiftCard } from '../components/inventory/InventoryGiftCard'
import { Button, Input } from '../components/ui'
import { sellItem } from '../services/demoInventoryService'
import { makeRequestId } from '../lib/requestId'
import { formatMinor } from '../lib/money'
import styles from './screens.module.css'
import filterStyles from './InventoryScreen.module.css'

/**
 * Инвентарь (3.1/3.2): пустое и заполненное состояния, карточки подарков
 * и фильтры. Фильтры и сортировка — клиентский вид поверх реального состояния
 * стора; сами данные приходят только из настоящих операций (открытие кейсов и т.д.).
 */
const SELL_ANIM_MS = 520

export function InventoryScreen() {
  const navigate = useNavigate()
  const items = useInventoryStore((s) => s.items)

  const [query, setQuery] = useState('')
  /** Короткое подтверждение продажи («Продано +X TON»). */
  const [soldNote, setSoldNote] = useState<string | null>(null)
  const [sellingUid, setSellingUid] = useState<string | null>(null)

  const joined = useMemo(
    () =>
      items.flatMap((item) => {
        const gift = giftById.get(item.giftId)
        return gift ? [{ item, gift }] : []
      }),
    [items],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = joined.filter(({ gift }) => q === '' || gift.name.toLowerCase().includes(q))
    // Новые сверху: по времени получения, при равенстве — стабильный порядок по uid
    return [...filtered].sort(
      (x, y) => y.item.acquiredAt - x.item.acquiredAt || x.item.uid.localeCompare(y.item.uid),
    )
  }, [joined, query])

  const filtering = query.trim() !== ''

  // Продажа в два шага: карточка плавно «улетает» (с плашкой +X TON), затем подарок реально продаётся
  const handleSell = (uid: string) => {
    if (sellingUid !== null) return
    setSellingUid(uid)
    window.setTimeout(() => {
      const res = sellItem(uid, makeRequestId())
      setSellingUid(null)
      if (res.status === 'ok') {
        setSoldNote(`Продано: +${formatMinor(res.creditedMinor)} TON`)
        window.setTimeout(() => setSoldNote(null), 2500)
      }
    }, SELL_ANIM_MS)
  }

  const resetFilters = () => {
    setQuery('')
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Ваши подарки</h1>
      <p className={styles.lead}>
        {filtering
          ? `Показано ${visible.length} из ${items.length}`
          : items.length > 0
            ? `${items.length} шт.`
            : 'Здесь появятся ваши подарки'}
      </p>

      <div className={filterStyles.sendBanner}>
        <div className={filterStyles.sendText}>
          <strong>Отправьте подарки боту @sexydropbot</strong>
          <span>Используйте их в Апгрейде или Быстрой продаже</span>
        </div>
        <button
          type="button"
          className={filterStyles.sendBtn}
          disabled
          title="Приём подарков включится после подключения сервера"
        >
          <ShareIcon className={filterStyles.sendIcon} aria-hidden />
          Скоро
        </button>
      </div>

      {soldNote && (
        <p className={filterStyles.soldNote} role="status">
          {soldNote}
        </p>
      )}

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
            Открывайте кейсы и играйте, чтобы получать ценные подарки
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
                <InventoryGiftCard key={item.uid} gift={gift} selling={sellingUid === item.uid}
                  onSell={() => handleSell(item.uid)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <p className={filterStyles.helpCard}>
        Нужна помощь с подарками? Напишите нам в боте @sexydropbot — поддержка поможет.
      </p>

    </div>
  )
}
