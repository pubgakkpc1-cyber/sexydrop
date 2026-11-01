import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, gifts, type Gift } from '../data/catalog'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { formatMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { upgradeChancePercent } from '../services/demoUpgradeService'
import { errorText, placeUpgradeApi } from '../services/gameApi'
import { hapticImpact, hapticNotify } from '../lib/telegram'
import { playRouletteTick, playWinChime } from '../lib/sound'
import { GiftPickerSheet } from '../components/inventory/GiftPickerSheet'
import { UpgradeTargetSheet } from '../components/inventory/UpgradeTargetSheet'
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
  const [targetPickerOpen, setTargetPickerOpen] = useState(false)
  const [sourceUid, setSourceUid] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<UpgradeOutcome | null>(null)
  // Анимация: предмет уже сгорел в сервисе, но на экране «живёт» до конца вращения
  const [spin, setSpin] = useState<{ sourceGiftId: string; pending: UpgradeOutcome } | null>(null)
  const [needleDeg, setNeedleDeg] = useState(0)
  const [needleAnimated, setNeedleAnimated] = useState(false)
  const timers = useRef<number[]>([])
  const upgrading = useRef(false)
  const [error, setError] = useState<string | null>(null)

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
      // только актуальные NFT-подарки с реальными ценами (старые подарки каталога не показываем)
      if (!/-\d$/.test(gift.id) || !gift.image.endsWith('.png')) continue
      if (!gift.available || gift.priceMinor <= 0) continue
      if (!byName.has(gift.name)) byName.set(gift.name, gift)
    }
    return [...byName.values()].sort((a, b) => a.priceMinor - b.priceMinor)
  }, [])

  // В окне выбора цели — ВСЕ виды NFT (фон/модель), а не только первый у каждого подарка
  const allVariants = useMemo(
    () =>
      gifts
        .filter((g) => g.available && g.priceMinor > 0 && /-\d$/.test(g.id) && g.image.endsWith('.png'))
        .sort((x, y) => x.priceMinor - y.priceMinor || x.id.localeCompare(y.id)),
    [],
  )

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

  // Цель для каждого икса. Предметов в каталоге мало и цены сильно разнесены, поэтому ближайшая цель
  // у соседних иксов часто совпадала — и кнопки «ничего не делали». Теперь цели подбираются по порядку
  // и всегда РАЗНЫЕ: каждый следующий икс даёт более дорогую цель, чем предыдущий.
  const chipTargets = useMemo(() => {
    const map = new Map<number, Gift | null>()
    if (!sourceGift) return map
    const above = allTargets.filter((g) => g.priceMinor > sourceGift.priceMinor)
    let floorIdx = 0
    for (const mult of MULTIPLIERS) {
      const want = sourceGift.priceMinor * mult
      let bestIdx = -1
      for (let i = floorIdx; i < above.length; i += 1) {
        const dist = Math.abs(Math.log(above[i]!.priceMinor / want))
        if (bestIdx === -1 || dist < Math.abs(Math.log(above[bestIdx]!.priceMinor / want))) bestIdx = i
      }
      if (bestIdx === -1) {
        map.set(mult, null)
      } else {
        map.set(mult, above[bestIdx]!)
        floorIdx = bestIdx + 1
      }
    }
    return map
  }, [allTargets, sourceGift])

  const pickMultiplier = (mult: number) => {
    const target = chipTargets.get(mult)
    if (!target) return
    hapticImpact('light')
    setTargetId(target.id)
  }

  const confirm = async () => {
    if (!source || !targetId || spin || upgrading.current) return
    setError(null)
    upgrading.current = true
    let result
    try {
      result = await placeUpgradeApi(source.uid, targetId, makeRequestId())
    } catch (e) {
      setError(errorText(e))
      return
    } finally {
      upgrading.current = false
    }
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
            onClick={() => !spinning && setPickerOpen(true)}
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

          <button
            type="button"
            className={cx(styles.slot, targetGift && styles.slotFilled)}
            onClick={() => !spinning && setTargetPickerOpen(true)}
            aria-label="Выбрать цель"
          >
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
                <span className={styles.slotName}>выбрать цель</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Быстрый выбор цели по иксу */}
      <div className={styles.multRow} role="group" aria-label="Быстрый выбор икса">
        {MULTIPLIERS.map((m) => (
          <button
            key={m}
            type="button"
            className={cx(styles.multChip, targetId !== null && chipTargets.get(m)?.id === targetId && styles.multChipActive)}
            disabled={!sourceGift || spinning || !chipTargets.get(m)}
            aria-pressed={targetId !== null && chipTargets.get(m)?.id === targetId}
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

      {error && (
        <p className={styles.note} role="alert">
          {error}
        </p>
      )}
      <p className={styles.note}>
        Улучшайте свои предметы до легендарных NFT.
      </p>

      <GiftPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(item: InventoryItem) => setSourceUid(item.uid)}
        title="Предмет для апгрейда"
      />

      <UpgradeTargetSheet
        open={targetPickerOpen}
        onClose={() => setTargetPickerOpen(false)}
        targets={allVariants}
        sourcePriceMinor={sourceGift ? sourceGift.priceMinor : null}
        selectedId={targetId}
        onConfirm={(id) => setTargetId(id)}
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
