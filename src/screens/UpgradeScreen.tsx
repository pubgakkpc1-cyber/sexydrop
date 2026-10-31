import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, gifts, RARITY_LABELS, type Gift } from '../data/catalog'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { formatMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { placeUpgrade, upgradeChancePercent } from '../services/demoUpgradeService'
import { GAME_RTP } from '../lib/gameConfig'
import { hapticImpact, hapticNotify } from '../lib/telegram'
import { playRouletteTick, playWinChime } from '../lib/sound'
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

/** Быстрый выбор цели: во сколько раз дороже источника. */
const MULTIPLIERS = [2, 3, 5, 10, 25] as const
const SPIN_MS = 3200
const RING_R = 66
const RING_LEN = 2 * Math.PI * RING_R

function fmtPct(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

/**
 * Апгрейд (4.4). Demo Mode: шанс считается формулой
 * p = min(1, (цена источника / цена цели) × RTP 0.98) и показывается
 * честно на кольце; бросок делает локальный demo-сервис, сервер — TIER 7.
 * Результат известен сразу, стрелка на кольце лишь красиво «доезжает» до него.
 */
export function UpgradeScreen() {
  const navigate = useNavigate()
  const items = useInventoryStore((s) => s.items)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [sourceUid, setSourceUid] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<UpgradeOutcome | null>(null)
  // Анимация: предмет уже сгорел в сервисе, но на экране «живёт» до конца вращения
  const [spin, setSpin] = useState<{ sourceGiftId: string; pending: UpgradeOutcome } | null>(null)
  const [needleDeg, setNeedleDeg] = useState(0)
  const [needleAnimated, setNeedleAnimated] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const list = timers.current
    return () => list.forEach((id) => window.clearTimeout(id))
  }, [])

  const source = useMemo(() => {
    const item = items.find((candidate) => candidate.uid === sourceUid)
    return item ?? null
  }, [items, sourceUid])
  const sourceGift: Gift | null = spin
    ? giftById.get(spin.sourceGiftId) ?? null
    : source
      ? giftById.get(source.giftId) ?? null
      : null

  // Одна карточка на название подарка, по возрастанию цены
  const allTargets = useMemo(() => {
    const byName = new Map<string, Gift>()
    for (const gift of gifts) {
      if (!gift.available || gift.priceMinor <= 0) continue
      if (!byName.has(gift.name)) byName.set(gift.name, gift)
    }
    return [...byName.values()].sort((a, b) => a.priceMinor - b.priceMinor)
  }, [])

  // Когда предмет выбран, показываем только цели дороже него (иначе апгрейд бессмысленен)
  const targets = useMemo(() => {
    if (!sourceGift) return allTargets
    return allTargets.filter((g) => g.priceMinor > sourceGift.priceMinor || g.id === targetId)
  }, [allTargets, sourceGift, targetId])

  const targetGift = targetId ? giftById.get(targetId) ?? null : null

  // Процент кольца — целочисленный floor2(p×100) из сервиса (без float-хвостов).
  const chancePct = useMemo(() => {
    if (!sourceGift || !targetGift) return null
    return upgradeChancePercent(sourceGift.priceMinor, targetGift.priceMinor)
  }, [sourceGift, targetGift])

  // Ставка больше недоступна — выбор сбрасывается (предмет сгорел).
  useEffect(() => {
    if (spin === null && sourceUid !== null && source === null) setSourceUid(null)
  }, [source, sourceUid, spin])

  const pickMultiplier = (mult: number) => {
    if (!sourceGift) return
    const want = sourceGift.priceMinor * mult
    // ближайшая по цене цель к желаемому иксу
    let best: Gift | null = null
    for (const g of allTargets) {
      if (g.priceMinor <= sourceGift.priceMinor) continue
      if (!best || Math.abs(g.priceMinor - want) < Math.abs(best.priceMinor - want)) best = g
    }
    if (best) {
      hapticImpact('light')
      setTargetId(best.id)
    }
  }

  const confirm = () => {
    if (!source || !targetId || spin) return
    const result = placeUpgrade(source.uid, targetId, makeRequestId())
    if (result.status !== 'ok') return
    const target = giftById.get(targetId)
    if (!target) return
    const pending: UpgradeOutcome = {
      won: result.won,
      targetGiftId: targetId,
      sourceGiftName: giftById.get(source.giftId)?.name ?? 'Подарок',
      chancePercent: upgradeChancePercent(result.sourcePriceMinor, result.targetPriceMinor),
      targetPriceMinor: target.priceMinor,
    }

    // Стрелка делает несколько оборотов и встаёт в зелёный сектор (победа) или мимо него
    const winShare = Math.min(100, pending.chancePercent) / 100
    const landFrac = pending.won
      ? winShare * (0.12 + Math.random() * 0.76)
      : winShare + (1 - winShare) * (0.12 + Math.random() * 0.76)
    const base = Math.ceil(needleDeg / 360) * 360
    setSpin({ sourceGiftId: source.giftId, pending })
    setNeedleAnimated(false)
    hapticImpact('medium')
    // кадр без transition (сброс), затем рывок
    timers.current.push(
      window.setTimeout(() => {
        setNeedleAnimated(true)
        setNeedleDeg(base + 360 * 5 + landFrac * 360)
      }, 60),
    )
    // «тики» при вращении — замедляются к концу
    for (let i = 0; i < 14; i += 1) {
      const t = 60 + (SPIN_MS * (1 - Math.pow(1 - i / 14, 2))) | 0
      timers.current.push(window.setTimeout(() => { playRouletteTick(1.2 - i * 0.03); hapticImpact('light') }, t))
    }
    timers.current.push(
      window.setTimeout(() => {
        if (pending.won) playWinChime()
        hapticNotify(pending.won ? 'success' : 'error')
        setOutcome(pending)
        setSpin(null)
        setSourceUid(null)
      }, SPIN_MS + 500),
    )
  }

  const shownGift = (id: string | null) => (id ? giftById.get(id) ?? null : null)
  const spinning = spin !== null

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
      </div>

      <h1 className={styles.title}>Апгрейд</h1>

      {/* Полотно: ваш предмет → кольцо шанса → цель */}
      <div className={cx(styles.board, spinning && styles.boardSpinning)}>
        <div className={styles.duel}>
          <button
            type="button"
            className={cx(styles.slot, sourceGift && styles.slotFilled)}
            onClick={() => items.length > 0 && !spinning && setPickerOpen(true)}
            aria-label="Выбрать предмет"
          >
            <span className={styles.slotLabel}>Ваш предмет</span>
            {sourceGift ? (
              <>
                <img className={styles.slotImage} src={sourceGift.image} alt="" />
                <span className={styles.slotName}>{sourceGift.name}</span>
                <span className={styles.slotPrice}><GramAmount minor={sourceGift.priceMinor} /></span>
              </>
            ) : (
              <>
                <span className={styles.slotPlus} aria-hidden>+</span>
                <span className={styles.slotName}>не выбран</span>
              </>
            )}
          </button>

          <div className={styles.ringWrap}>
            <svg className={styles.ringSvg} viewBox="0 0 148 148" aria-hidden>
              <circle cx="74" cy="74" r={RING_R} fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="10" />
              {chancePct !== null && (
                <circle
                  className={styles.ringWin}
                  cx="74"
                  cy="74"
                  r={RING_R}
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(100, chancePct) / 100) * RING_LEN} ${RING_LEN}`}
                />
              )}
            </svg>
            <div
              className={styles.needle}
              style={{
                transform: `rotate(${needleDeg}deg)`,
                transition: needleAnimated ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.7, 0.1, 1)` : 'none',
              }}
              aria-hidden
            >
              <span className={styles.needleTip} />
            </div>
            <div className={styles.ringCenter}>
              <span className={styles.chanceValue}>
                {chancePct === null ? '—' : `${fmtPct(chancePct)}%`}
              </span>
              <span className={styles.chanceLabel}>шанс</span>
            </div>
          </div>

          <div className={cx(styles.slot, targetGift && styles.slotFilled, styles.slotTarget)}>
            <span className={styles.slotLabel}>Цель</span>
            {targetGift ? (
              <>
                <img className={styles.slotImage} src={targetGift.image} alt="" />
                <span className={styles.slotName}>{targetGift.name}</span>
                <span className={styles.slotPrice}><GramAmount minor={targetGift.priceMinor} /></span>
              </>
            ) : (
              <>
                <span className={styles.slotPlus} aria-hidden>?</span>
                <span className={styles.slotName}>не выбрана</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Источник — только реальные предметы инвентаря */}
      <div className={styles.sourceRow}>
        <div className={styles.sourceInfo}>
          {sourceGift ? (
            <>
              <img className={styles.sourceImage} src={sourceGift.image} alt="" />
              <span className={styles.sourceMeta}>
                <span className={styles.sourceName}>{sourceGift.name}</span>
                <span className={styles.sourceHint}>
                  {RARITY_LABELS[sourceGift.rarity]} · <GramAmount minor={sourceGift.priceMinor} />
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
          disabled={items.length === 0 || spinning}
        >
          Выбрать
        </button>
      </div>

      {/* Быстрый выбор цели по иксу */}
      <div className={styles.multRow} role="group" aria-label="Быстрый выбор икса">
        {MULTIPLIERS.map((m) => (
          <button
            key={m}
            type="button"
            className={styles.multChip}
            disabled={!sourceGift || spinning}
            onClick={() => pickMultiplier(m)}
          >
            x{m}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.placeBet}
        disabled={!source || !targetId || spinning}
        onClick={confirm}
      >
        {spinning ? 'Крутим…' : 'Апгрейдить'}
      </button>

      {/* Цели из каталога: шанс на каждой карточке считает сервис */}
      <h2 className={styles.sectionTitle}>Выберите цель</h2>
      <div className={styles.targetGrid}>
        {targets.map((gift) => {
          const pct = sourceGift ? upgradeChancePercent(sourceGift.priceMinor, gift.priceMinor) : null
          return (
            <button
              key={gift.id}
              type="button"
              aria-label={gift.name}
              className={cx(styles.target, targetId === gift.id && styles.targetActive)}
              aria-pressed={targetId === gift.id}
              disabled={spinning}
              onClick={() => setTargetId(gift.id)}
            >
              {pct !== null && <span className={styles.targetChance}>{fmtPct(pct)}%</span>}
              <img className={styles.targetImage} src={gift.image} alt="" />
              <span className={styles.targetName}>{gift.name}</span>
              <span className={styles.targetPrice}>{formatMinor(gift.priceMinor)} TON</span>
            </button>
          )
        })}
      </div>

      <p className={styles.note}>
        Апгрейд: шанс p = min(1, цена источника / цена цели × {GAME_RTP}).
        Улучшайте свои предметы до легендарных NFT.
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
              src={shownGift(outcome.targetGiftId)?.image}
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
                ? `Получено: ${shownGift(outcome.targetGiftId)?.name} · ${formatMinor(
                    outcome.targetPriceMinor,
                  )} TON`
                : `${outcome.sourceGiftName} сгорел · шанс был ${fmtPct(outcome.chancePercent)}%`}
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
