import { giftById } from '../../data/catalog'
import { useInventoryStore, type InventoryEvent } from '../../store/inventory'
import { CubeIcon } from '../shell/icons'
import { GramAmount } from '../ui'
import { cx } from '../../lib/cx'
import styles from './InventoryHistory.module.css'

const MAX_SHOWN = 20

const ACQUIRE_LABELS: Record<string, string> = {
  'case-open': 'из платного кейса',
  'free-case': 'из бесплатного кейса',
  upgrade: 'апгрейдом',
  craft: 'крафтом',
}

/** Причины изъятия, являющиеся ставкой в игру (4.1/4.4/4.5) — не продажи. */
const BET_REASONS: Record<string, string> = {
  'crash-bet': 'в Ракетке',
  'upgrade-bet': 'в Апгрейде',
  'craft-bet': 'в Крафте',
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function eventRowParts(event: InventoryEvent): {
  action: string
  detail: string
  creditedMinor: number | null
  actionClass: 'actionAcquire' | 'actionSold' | 'actionBet'
} {
  if (event.type === 'acquire') {
    return {
      action: 'Получено',
      detail: ACQUIRE_LABELS[event.detail] ?? event.detail,
      creditedMinor: null,
      actionClass: 'actionAcquire',
    }
  }
  const betGame = BET_REASONS[event.detail]
  if (betGame) {
    // Предмет поставлен в игру (4.1/4.4/4.5): это не продажа — суммы в строке нет.
    return { action: 'Ставка', detail: betGame, creditedMinor: null, actionClass: 'actionBet' }
  }
  return {
    action: 'Продано',
    detail: event.detail === 'sold' ? 'по каталог-цене' : event.detail,
    // Сумма продажи выводится из реальной цены каталога (SALE_FACTOR = 1, правило 3.4);
    // журнал не хранит сумму, чтобы не расползаться с единственным источником истины.
    creditedMinor: giftById.get(event.giftId)?.priceMinor ?? null,
    actionClass: 'actionSold',
  }
}

/**
 * История изменений инвентаря (3.5): UI-выдача журнала `useInventoryStore.history`
 * — только реальные операции пользователя (получение из кейсов, продажа).
 * Показываются последние MAX_SHOWN событий; полная история — на сервере (TIER 7).
 */
export function InventoryHistory() {
  const history = useInventoryStore((s) => s.history)
  if (history.length === 0) return null

  const shown = history.slice(0, MAX_SHOWN)

  return (
    <section className={styles.section} aria-label="История изменений инвентаря">
      <h2 className={styles.title}>История</h2>
      <div className={styles.list}>
        {shown.map((event) => {
          const { action, detail, creditedMinor, actionClass } = eventRowParts(event)
          const gift = giftById.get(event.giftId)
          return (
            <div key={`${event.uid}-${event.at}-${event.type}`} className={styles.row}>
              {gift ? (
                <img className={styles.art} src={gift.image} alt="" />
              ) : (
                <span className={styles.artFallback}>
                  <CubeIcon aria-hidden />
                </span>
              )}
              <span className={styles.info}>
                <span className={styles.name}>{gift?.name ?? 'Предмет'}</span>
                <span className={styles.meta}>
                  <span className={cx(styles.action, styles[actionClass])}>
                    {action}
                  </span>
                  {' · '}
                  {detail}
                </span>
              </span>
              <span className={styles.right}>
                {creditedMinor !== null && (
                  <span className={styles.credited}>
                    +
                    <GramAmount minor={creditedMinor} />
                  </span>
                )}
                <time dateTime={new Date(event.at).toISOString()} className={styles.time}>
                  {timeFormatter.format(event.at)}
                </time>
              </span>
            </div>
          )
        })}
      </div>
      {history.length > shown.length && (
        <p className={styles.note}>Показаны последние {shown.length} из {history.length} событий</p>
      )}
      <p className={styles.note}>
        Журнал Demo Mode хранится локально и сбрасывается при перезагрузке; серверная
        история — TIER 7.
      </p>
    </section>
  )
}
