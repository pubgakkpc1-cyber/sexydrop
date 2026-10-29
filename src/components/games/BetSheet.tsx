import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, RARITY_LABELS } from '../../data/catalog'
import { useInventoryStore } from '../../store/inventory'
import { useWalletStore } from '../../store/wallet'
import { formatMinor, toMinor, type Minor } from '../../lib/money'
import { makeRequestId } from '../../lib/requestId'
import {
  placeGiftBet,
  placeGramBet,
  queueNextRoundGiftBet,
  queueNextRoundGramBet,
} from '../../services/demoCrashService'
import { useCrashStore } from '../../store/crash'
import { BottomSheet, Button, GramAmount, Input } from '../ui'
import { CubeIcon, GiftIcon, TonIcon } from '../shell/icons'
import { cx } from '../../lib/cx'
import styles from './BetSheet.module.css'

export type BetSheetTab = 'gifts' | 'gram'

const PRESETS: readonly Minor[] = [100, 500, 1000, 5000] // 0.1 / 0.5 / 1 / 5 GRAM
export const LAST_CRASH_BET_KEY = 'sexydrop_crash_last_bet'

export interface BetSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Шит ставки для «Ракетки» (Dual Betting, 4.1): переключатель Подарки /
 * TON. В Demo Mode цену операции назначает локальный сервис; в production
 * цену ставки сервер фиксирует сам (спека 9, TIER 7).
 */
export function BetSheet({ open, onClose }: BetSheetProps) {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode])
  const items = useInventoryStore((s) => s.items)

  const [tab, setTab] = useState<BetSheetTab>('gram')
  const [amountInput, setAmountInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage?.getItem(LAST_CRASH_BET_KEY) || '0.1'
    }
    return '0.1'
  })
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Каждое открытие — чистое состояние с подгрузкой последней ставки.
  useEffect(() => {
    if (open) {
      setTab('gram')
      const saved = typeof window !== 'undefined' ? window.localStorage?.getItem(LAST_CRASH_BET_KEY) : null
      setAmountInput(saved || '0.1')
      setSelectedUid(null)
      setError(null)
    }
  }, [open])

  const giftRows = useMemo(() => {
    return items
      .flatMap((item) => {
        const gift = giftById.get(item.giftId)
        return gift ? [{ item, gift }] : []
      })
      .sort(
        (a, b) => b.gift.priceMinor - a.gift.priceMinor || a.item.uid.localeCompare(b.item.uid),
      )
  }, [items])

  // Сумма GRAM: парсинг только через строку (правило money.ts), минорные единицы.
  const amountMinor: Minor | null = useMemo(() => {
    try {
      return toMinor(amountInput)
    } catch {
      return null
    }
  }, [amountInput])

  const selectedRow = selectedUid === null ? null : (giftRows.find(({ item }) => item.uid === selectedUid) ?? null)
  const insufficient = amountMinor === null || balance < amountMinor

  const phase = useCrashStore((s) => s.phase)
  const isNextRound = phase !== 'betting'

  const confirm = () => {
    setError(null)
    if (tab === 'gram') {
      if (amountMinor === null || insufficient) return
      const result = isNextRound
        ? queueNextRoundGramBet(amountMinor, makeRequestId())
        : placeGramBet(amountMinor, makeRequestId())

      if (result.status === 'ok') {
        try {
          window.localStorage?.setItem(LAST_CRASH_BET_KEY, amountInput)
        } catch {
          /* no-op */
        }
        onClose()
      } else {
        setError('Не удалось принять ставку — попробуйте ещё раз')
      }
      return
    }
    if (!selectedRow) return
    const result = isNextRound
      ? queueNextRoundGiftBet(selectedRow.item.uid, makeRequestId())
      : placeGiftBet(selectedRow.item.uid, makeRequestId())

    if (result.status === 'ok') {
      onClose()
    } else {
      setError('Не удалось принять ставку — попробуйте ещё раз')
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isNextRound ? 'Ставка на след. раунд' : 'Сделать ставку'}
    >
      {/* Переключатель Dual Betting Подарки / TON */}
      <div className={styles.segmented} role="group" aria-label="Тип ставки">
        <button
          type="button"
          className={cx(styles.segment, tab === 'gifts' && styles.segmentActive)}
          aria-pressed={tab === 'gifts'}
          onClick={() => setTab('gifts')}
        >
          <GiftIcon className={styles.tabIcon} />
          <span>Подарки</span>
        </button>
        <button
          type="button"
          className={cx(styles.segment, tab === 'gram' && styles.segmentActive)}
          aria-pressed={tab === 'gram'}
          onClick={() => setTab('gram')}
        >
          <TonIcon className={styles.tabIcon} />
          <span>TON</span>
        </button>
      </div>

      {tab === 'gram' ? (
        <div className={styles.gramTab}>
          <div className={styles.presets} role="group" aria-label="Быстрые суммы">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={cx(styles.preset, amountMinor === preset && styles.presetActive)}
                aria-pressed={amountMinor === preset}
                onClick={() => setAmountInput(formatMinor(preset))}
              >
                {formatMinor(preset)}
              </button>
            ))}
          </div>
          <Input
            label="Сумма ставки"
            inputMode="decimal"
            placeholder="Сумма в TON"
            suffix="TON"
            value={amountInput}
            onChange={(event) => {
              setError(null)
              setAmountInput(event.target.value)
            }}
            error={
              amountMinor !== null && amountMinor < 100
                ? 'Минимальная ставка — 0.1 TON'
                : amountMinor !== null && insufficient
                ? 'Недостаточно TON'
                : undefined
            }
            hint={balanceHint(balance)}
          />
        </div>
      ) : items.length === 0 ? (
        /* Пустой инвентарь: честное состояние без выдуманных сервисов (спека 9). */
        <div className={styles.empty}>
          <CubeIcon className={styles.emptyIcon} />
          <strong className={styles.emptyTitle}>Нет доступных подарков</strong>
          <Button
            variant="cta"
            fullWidth
            onClick={() => {
              onClose()
              navigate('/')
            }}
          >
            Открыть кейсы
          </Button>
          <span className={styles.divider} role="separator" aria-label="ИЛИ">
            ИЛИ
          </span>
          <Button variant="secondary" fullWidth disabled>
            Отправить подарки
          </Button>
          <p className={styles.emptyHint}>
            Получение подарков извне появится после подключения сервера
          </p>
        </div>
      ) : (
        <div className={styles.giftTab}>
          <ul className={styles.list}>
            {giftRows.map(({ item, gift }) => (
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
          </ul>
          <p className={styles.giftNote}>
            Подарок конвертируется в ставку по каталог-цене; при краше предмет сгорает,
            при «Забрать» выигрыш выдаётся равноценным NFT (или TON).
          </p>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button
        fullWidth
        size="lg"
        variant="cta"
        disabled={tab === 'gram' ? amountMinor === null || insufficient || amountMinor < 100 : !selectedRow}
        onClick={confirm}
        aria-label={confirmLabel(tab, amountMinor, selectedRow?.gift.name, isNextRound)}
      >
        {confirmLabel(tab, amountMinor, selectedRow?.gift.name, isNextRound)}
      </Button>
    </BottomSheet>
  )
}

function balanceHint(balance: Minor): string {
  return `Баланс: ${formatMinor(balance)} TON`
}

function confirmLabel(
  tab: BetSheetTab,
  amountMinor: Minor | null,
  giftName: string | undefined,
  isNextRound: boolean = false,
): string {
  const prefix = isNextRound ? 'На след. раунд: ' : 'Поставить '
  if (tab === 'gram') {
    return amountMinor !== null ? `${prefix}${formatMinor(amountMinor)} TON` : isNextRound ? 'Поставить на след. раунд' : 'Сделать ставку'
  }
  return giftName ? `${prefix}${giftName}` : 'Выберите подарок'
}
