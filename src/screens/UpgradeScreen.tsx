import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, gifts, RARITY_LABELS } from '../data/catalog'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { formatMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { placeUpgrade, upgradeChancePercent } from '../services/demoUpgradeService'
import { GAME_RTP } from '../lib/gameConfig'
import { GiftPickerSheet } from '../components/inventory/GiftPickerSheet'
import { BottomSheet, Button, GramAmount } from '../components/ui'
import { ChevronLeftIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './UpgradeScreen.module.css'

interface UpgradeOutcome {
  won: boolean
  targetGiftId: string
  sourceGiftName: string
  /** Процент шанса попытки (floor2), показанный в шите проигрыша. */
  chancePercent: number
  targetPriceMinor: Minor
}

/**
 * Апгрейд (4.4). Demo Mode: шанс считается формулой
 * p = min(1, (цена источника / цена цели) × RTP 0.98) и показывается
 * честно на кольце; бросок делает локальный demo-сервис, сервер — TIER 7.
 */
export function UpgradeScreen() {
  const navigate = useNavigate()
  const items = useInventoryStore((s) => s.items)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [sourceUid, setSourceUid] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<UpgradeOutcome | null>(null)

  // Источник должен существовать в инвентаре: после раунда он сгорает.
  const source = useMemo(() => {
    const item = items.find((candidate) => candidate.uid === sourceUid)
    return item ?? null
  }, [items, sourceUid])
  const sourceGift = source ? giftById.get(source.giftId) ?? null : null

  const targets = useMemo(
    () => gifts.filter((gift) => gift.available && gift.priceMinor > 0),
    [],
  )

  // Процент кольца — целочисленный floor2(p×100) из сервиса (без float-хвостов).
  const chancePct = useMemo(() => {
    if (!sourceGift || !targetId) return null
    const target = giftById.get(targetId)
    if (!target) return null
    return upgradeChancePercent(sourceGift.priceMinor, target.priceMinor)
  }, [sourceGift, targetId])

  // Ставка больше недоступна — выбор сбрасывается (предмет сгорел).
  useEffect(() => {
    if (sourceUid !== null && source === null) setSourceUid(null)
  }, [source, sourceUid])

  const confirm = () => {
    if (!source || !targetId) return
    const result = placeUpgrade(source.uid, targetId, makeRequestId())
    if (result.status !== 'ok') return
    const target = giftById.get(targetId)
    if (!target) return
    setOutcome({
      won: result.won,
      targetGiftId: targetId,
      sourceGiftName: giftById.get(source.giftId)?.name ?? 'Подарок',
      chancePercent: upgradeChancePercent(result.sourcePriceMinor, result.targetPriceMinor),
      targetPriceMinor: target.priceMinor,
    })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
        <span className={styles.demoChip}>Demo Mode</span>
      </div>

      <h1 className={styles.title}>Апгрейд</h1>

      {/* Полотно: источник → кольцо шанса → цель */}
      <div className={styles.board}>
        <div className={styles.ringWrap}>
          <svg className={styles.ringSvg} viewBox="0 0 148 148" aria-hidden>
            <circle cx="74" cy="74" r="66" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" />
            {chancePct !== null && (
              <circle
                cx="74"
                cy="74"
                r="66"
                fill="none"
                stroke="#ffffff"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(chancePct / 100) * 2 * Math.PI * 66} ${2 * Math.PI * 66}`}
              />
            )}
          </svg>
          <img
            className={styles.ringArt}
            src={targetId ? giftById.get(targetId)?.image : undefined}
            alt=""
          />
          <span className={styles.chancePill}>
            {chancePct === null ? '—' : `${chancePct.toFixed(2).replace(/\.?0+$/, '')}%`}
          </span>
        </div>

        <div className={styles.pairs}>
          <div className={styles.pairSlot}>
            <span className={styles.pairLabel}>Ваш предмет</span>
            {source ? (
              <>
                <img
                  className={styles.pairImage}
                  src={giftById.get(source.giftId)?.image}
                  alt=""
                />
                <span className={styles.pairName}>{giftById.get(source.giftId)?.name}</span>
                <span className={cx(styles.pairLabel, styles.sourcePrice)}>
                  <GramAmount minor={sourceGift?.priceMinor ?? 0} />
                </span>
              </>
            ) : (
              <span className={styles.pairName}>не выбран</span>
            )}
          </div>
          <span className={styles.arrow} aria-hidden>
            →
          </span>
          <div className={styles.pairSlot}>
            <span className={styles.pairLabel}>Цель</span>
            {targetId ? (
              <>
                <img className={styles.pairImage} src={giftById.get(targetId)?.image} alt="" />
                <span className={styles.pairName}>{giftById.get(targetId)?.name}</span>
                <span className={cx(styles.pairLabel, styles.sourcePrice)}>
                  <GramAmount minor={giftById.get(targetId)?.priceMinor ?? 0} />
                </span>
              </>
            ) : (
              <span className={styles.pairName}>не выбрана</span>
            )}
          </div>
        </div>
      </div>

      {/* Источник — только реальные предметы инвентаря */}
      <div className={styles.sourceRow}>
        <div className={styles.sourceInfo}>
          {source ? (
            <>
              <img className={styles.sourceImage} src={giftById.get(source.giftId)?.image} alt="" />
              <span className={styles.sourceMeta}>
                <span className={styles.sourceName}>{giftById.get(source.giftId)?.name}</span>
                <span className={styles.sourceHint}>
                  {RARITY_LABELS[sourceGift?.rarity ?? 'common']} ·{' '}
                  <GramAmount minor={sourceGift?.priceMinor ?? 0} />
                </span>
              </span>
            </>
          ) : (
            <span className={styles.sourceMeta}>
              <span className={styles.sourceName}>Предмет для апгрейда</span>
              <span className={styles.sourceHint}>
                {items.length === 0 ? 'Инвентарь пуст' : 'Выберите из инвентаря'}
              </span>
            </span>
          )}
        </div>
        <button
          type="button"
          className={styles.pickButton}
          onClick={() => setPickerOpen(true)}
          disabled={items.length === 0}
        >
          Выбрать
        </button>
      </div>

      {/* Цели из каталога — формулу шанса считает сервис, не рисуем руками */}
      <h2 className={styles.sectionTitle}>Выберите цель</h2>
      <div className={styles.targetGrid}>
        {targets.map((gift) => (
          <button
            key={gift.id}
            type="button"
            className={cx(styles.target, targetId === gift.id && styles.targetActive)}
            aria-pressed={targetId === gift.id}
            onClick={() => setTargetId(gift.id)}
          >
            <img className={styles.targetImage} src={gift.image} alt="" />
            <span className={styles.targetName}>{gift.name}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.placeBet}
        disabled={!source || !targetId}
        onClick={confirm}
      >
        Апгрейдить
      </button>

      <p className={styles.note}>
        Demo Mode: шанс p = min(1, цена источника / цена цели × {GAME_RTP}); проигрыш
        сжигает предмет. Серверный расчёт и Provably Fair — TIER 7 (7.6).
      </p>

      <GiftPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(item: InventoryItem) => setSourceUid(item.uid)}
        title="Предмет для апгрейда"
      />

      <BottomSheet open={outcome !== null} onClose={() => setOutcome(null)} title="Результат">
        {outcome && (
          <div className={styles.resultWrap}>
            <img
              className={cx(styles.resultImage, !outcome.won && styles.resultLost)}
              src={giftById.get(outcome.targetGiftId)?.image}
              alt=""
            />
            <span
              className={cx(
                styles.resultTitle,
                outcome.won ? styles.resultTitleWon : styles.resultTitleLost,
              )}
            >
              {outcome.won ? 'Апгрейд удался!' : 'Не получилось'}
            </span>
            <span className={styles.resultMeta}>
              {outcome.won
                ? `Получено: ${giftById.get(outcome.targetGiftId)?.name} · ${formatMinor(
                    outcome.targetPriceMinor,
                  )} TON`
                : `${outcome.sourceGiftName} сгорел · шанс был ${outcome.chancePercent
                    .toFixed(2)
                    .replace(/\.?0+$/, '')}%`}
            </span>
            <Button fullWidth variant="cta" onClick={() => setOutcome(null)}>
              Готово
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
