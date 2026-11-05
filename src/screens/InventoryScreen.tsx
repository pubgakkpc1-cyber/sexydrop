import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, type Gift } from '../data/catalog'
import { useInventoryStore } from '../store/inventory'
import { DiamondIcon, SearchIcon, ShareIcon } from '../components/shell/icons'
import { InventoryGiftCard } from '../components/inventory/InventoryGiftCard'
import { LockedGiftSheet, type LockedAction } from '../components/inventory/LockedGiftSheet'
import { useFreeCasesStore } from '../store/freeCases'
import { Button, Input } from '../components/ui'
import { sellItemApi, withdrawItemApi } from '../services/gameApi'
import { SERVER_MODE } from '../lib/serverMode'
import { makeRequestId } from '../lib/requestId'
import { formatMinor } from '../lib/money'
import { openOwnerChat, OWNER_HANDLE } from '../lib/telegram'
import { buildWithdrawMessage } from '../lib/withdraw'
import styles from './screens.module.css'
import filterStyles from './InventoryScreen.module.css'

/**
 * Инвентарь (3.1/3.2): пустое и заполненное состояния, карточки подарков
 * и фильтры. Фильтры и сортировка — клиентский вид поверх реального состояния
 * стора; сами данные приходят только из настоящих операций (открытие кейсов и т.д.).
 */
const SELL_ANIM_MS = 520
/** Сколько друзей нужно для подарка из FREE (как на сервере, play_service.QUEST_FRIENDS). */
const QUEST_TARGET = 5

export function InventoryScreen() {
  const navigate = useNavigate()
  const items = useInventoryStore((s) => s.items)

  const [query, setQuery] = useState('')
  /** Короткое подтверждение продажи («Продано +X TON»). */
  const [soldNote, setSoldNote] = useState<string | null>(null)
  const [sellingUid, setSellingUid] = useState<string | null>(null)
  const [lockedAction, setLockedAction] = useState<LockedAction | null>(null)

  // Подарок из одноразового FREE-кейса: лежит в инвентаре под замком, пока не приглашены 5 друзей
  const quest = useFreeCasesStore((s) => s.quest)
  const pending = quest.pendingReward
  const lockedGift =
    pending && Date.now() < pending.expiresAt && !items.some((i) => i.uid === pending.uid)
      ? giftById.get(pending.giftId) ?? null
      : null
  const lockedProgress = { joined: Math.min(quest.referralsJoined, QUEST_TARGET), target: QUEST_TARGET }

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
  const totalCount = items.length + (lockedGift ? 1 : 0)
  const showLocked =
    lockedGift !== null && (!filtering || lockedGift.name.toLowerCase().includes(query.trim().toLowerCase()))

  // Продажа в два шага: карточка плавно «улетает» (с плашкой +X TON), затем подарок реально продаётся
  const handleSell = (uid: string) => {
    if (sellingUid !== null) return
    setSellingUid(uid)
    window.setTimeout(() => {
      void sellItemApi(uid, makeRequestId())
        .then((res) => {
          if (res.status === 'ok') {
            setSoldNote(`Продано: +${formatMinor(res.creditedMinor)} TON`)
            window.setTimeout(() => setSoldNote(null), 2500)
          }
        })
        .catch(() => undefined)
        .finally(() => setSellingUid(null))
    }, SELL_ANIM_MS)
  }

  // Вывод: сервер блокирует подарок и заводит заявку, затем открывается чат с менеджером
  const handleWithdraw = (gift: Gift, uid: string) => {
    const open = () => openOwnerChat(buildWithdrawMessage(gift, uid))
    if (!SERVER_MODE) {
      open()
      return
    }
    void withdrawItemApi(uid).then(open).catch(() => undefined)
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
          : totalCount > 0
            ? `${totalCount} шт.`
            : 'Здесь появятся ваши подарки'}
      </p>

      {totalCount > 0 && (
      <div className={filterStyles.sendBanner}>
        <div className={filterStyles.sendText}>
          <strong>Отправьте подарки {OWNER_HANDLE}</strong>
          <span>Используйте их в Апгрейде или Быстрой продаже</span>
        </div>
        <button
          type="button"
          className={filterStyles.sendBtn}
          onClick={() => openOwnerChat()}
        >
          <ShareIcon className={filterStyles.sendIcon} aria-hidden />
          Отправить
        </button>
      </div>
      )}

      {soldNote && (
        <p className={filterStyles.soldNote} role="status">
          {soldNote}
        </p>
      )}

      {totalCount === 0 ? (
        /* Пустое состояние: алмаз в круге, отправка подарков менеджеру, «или» — кейсы. */
        <div className={filterStyles.emptyCard}>
          <span className={filterStyles.emptyIcon} aria-hidden>
            <DiamondIcon />
          </span>
          <strong className={filterStyles.emptyTitle}>Ваш инвентарь пуст</strong>
          <p className={filterStyles.emptyText}>
            Отправьте подарки в{' '}
            <button type="button" className={filterStyles.emptyLink} onClick={() => openOwnerChat()}>
              {OWNER_HANDLE}
            </button>{' '}
            чтобы использовать их для пополнения баланса, апгрейдов или игры в Ракету.
          </p>
          <Button fullWidth onClick={() => openOwnerChat()}>
            Отправить подарок
          </Button>
          <p className={filterStyles.emptyHint}>
            Менеджер проверит подарок и зачислит его сюда.
          </p>
          <span className={filterStyles.emptyOr}>или</span>
          <p className={filterStyles.emptyText}>
            Откройте кейсы — полученные подарки появятся здесь
          </p>
          <Button fullWidth variant="secondary" onClick={() => navigate('/')}>
            Открыть кейсы
          </Button>
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

          {visible.length === 0 && !showLocked ? (
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
              {showLocked && lockedGift && (
                <InventoryGiftCard
                  key="free-locked"
                  gift={lockedGift}
                  locked={lockedProgress}
                  onSell={() => setLockedAction('sell')}
                  onWithdraw={() => setLockedAction('withdraw')}
                  onLocked={setLockedAction}
                />
              )}
              {visible.map(({ item, gift }) => (
                <InventoryGiftCard key={item.uid} gift={gift} selling={sellingUid === item.uid}
                  onSell={() => handleSell(item.uid)}
                  onWithdraw={() => handleWithdraw(gift, item.uid)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {lockedGift && pending && lockedAction && (
        <LockedGiftSheet
          gift={lockedGift}
          action={lockedAction}
          joined={lockedProgress.joined}
          target={lockedProgress.target}
          expiresAt={pending.expiresAt}
          onClose={() => setLockedAction(null)}
        />
      )}

      <p className={filterStyles.helpCard}>
        Нужна помощь с подарками? Напишите {OWNER_HANDLE} — поддержка поможет.
      </p>

    </div>
  )
}
