import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById, gifts, type Gift } from '../data/catalog'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { formatMinor, toMinor, type Minor } from '../lib/money'
import { useWalletStore } from '../store/wallet'
import { makeRequestId } from '../lib/requestId'
import { upgradeChancePercent } from '../services/demoUpgradeService'
import { errorText, placeUpgradeApi } from '../services/gameApi'
import { hapticImpact, hapticNotify } from '../lib/telegram'
import { playRouletteTick, playUpgradeLose, playUpgradeSelect, playUpgradeSlide, playUpgradeSpin, playUpgradeWin } from '../lib/sound'
import { GiftPickerSheet } from '../components/inventory/GiftPickerSheet'
import { UpgradeTargetSheet } from '../components/inventory/UpgradeTargetSheet'
import { BottomSheet, Button, GramAmount } from '../components/ui'
import { ChevronLeftIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import { upgradeSpinMs, useSpinSpeedStore } from '../store/spinSpeed'
import { TurboToggle } from '../components/ui/TurboToggle'
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
  const turbo = useSpinSpeedStore((s) => s.turbo)
  const SPIN_MS = upgradeSpinMs(turbo)

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
  // дополнительные подарки в ту же ставку и доплата с баланса
  const [extraUids, setExtraUids] = useState<string[]>([])
  const [extraTon, setExtraTon] = useState('')
  const [pickerMode, setPickerMode] = useState<'main' | 'add'>('main')
  const [spinStake, setSpinStake] = useState<number | null>(null)
  const [flash, setFlash] = useState<'win' | 'lose' | null>(null)
  const lastSlideSound = useRef(0)
  const balance = useWalletStore((s) => s.balances[s.mode])

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
      if (!/-\d$/.test(gift.id) || !gift.image.endsWith('.webp')) continue
      if (!gift.available || gift.priceMinor <= 0) continue
      if (!byName.has(gift.name)) byName.set(gift.name, gift)
    }
    return [...byName.values()].sort((a, b) => a.priceMinor - b.priceMinor)
  }, [])

  // В окне выбора цели — ВСЕ виды NFT (фон/модель), а не только первый у каждого подарка
  const allVariants = useMemo(
    () =>
      gifts
        .filter((g) => g.available && g.priceMinor > 0 && /-\d$/.test(g.id) && g.image.endsWith('.webp'))
        .sort((x, y) => x.priceMinor - y.priceMinor || x.id.localeCompare(y.id)),
    [],
  )

  const targetGift = targetId ? giftById.get(targetId) ?? null : null

  const extraItems = useMemo(
    () => extraUids.map((u) => items.find((i) => i.uid === u)).filter((i): i is InventoryItem => i !== undefined),
    [extraUids, items],
  )
  const extraGiftsMinor = extraItems.reduce((a, i) => a + (giftById.get(i.giftId)?.priceMinor ?? 0), 0)
  let extraMinor = 0
  try {
    extraMinor = extraTon.trim() ? Math.max(0, toMinor(extraTon.replace(',', '.'))) : 0
  } catch {
    extraMinor = 0
  }
  const extraTooBig = extraMinor > balance
  // ставка: главный подарок + добавленные подарки + доплата (во время прокрута — снимок на момент ставки)
  const stakeMinor = spinStake ?? (sourceGift ? sourceGift.priceMinor + extraGiftsMinor + extraMinor : 0)

  // Процент кольца — целочисленный floor2(p×100) из сервиса (без float-хвостов).
  const chancePct = useMemo(() => {
    if (!sourceGift || !targetGift) return null
    return upgradeChancePercent(stakeMinor, targetGift.priceMinor)
  }, [sourceGift, targetGift, stakeMinor])

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
    const above = allTargets.filter((g) => g.priceMinor > stakeMinor)
    let floorIdx = 0
    for (const mult of MULTIPLIERS) {
      const want = stakeMinor * mult
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
  }, [allTargets, sourceGift, stakeMinor])

  // Ползунок икса: чем правее — тем дороже подарок и меньше шанс. Шкала логарифмическая, цель — ближайший по цене подарок.
  const sliderTargets = useMemo(
    () => (sourceGift ? allTargets.filter((g) => g.priceMinor > stakeMinor) : []),
    [allTargets, sourceGift, stakeMinor],
  )
  const sliderBounds = useMemo(() => {
    if (!sourceGift || sliderTargets.length === 0) return null
    const lo = Math.log(sliderTargets[0]!.priceMinor / stakeMinor)
    const hi = Math.log(sliderTargets[sliderTargets.length - 1]!.priceMinor / stakeMinor)
    return { lo, hi: Math.max(hi, lo + 0.0001) }
  }, [sliderTargets, sourceGift, stakeMinor])
  const currentMult = sourceGift && targetGift && stakeMinor > 0 ? targetGift.priceMinor / stakeMinor : null
  const sliderValue =
    sliderBounds && currentMult ? Math.round(((Math.log(currentMult) - sliderBounds.lo) / (sliderBounds.hi - sliderBounds.lo)) * 1000) : 0

  const onSlide = (raw: number) => {
    if (!sourceGift || !sliderBounds || sliderTargets.length === 0) return
    const mult = Math.exp(sliderBounds.lo + (raw / 1000) * (sliderBounds.hi - sliderBounds.lo))
    const want = stakeMinor * mult
    let best = sliderTargets[0]!
    for (const g of sliderTargets) {
      if (Math.abs(Math.log(g.priceMinor / want)) < Math.abs(Math.log(best.priceMinor / want))) best = g
    }
    if (best.id !== targetId) {
      hapticImpact('light')
      setTargetId(best.id)
      const now = performance.now()
      if (now - lastSlideSound.current > 70) {
        lastSlideSound.current = now
        playUpgradeSlide(upgradeChancePercent(stakeMinor, best.priceMinor))
      }
    }
  }

  const pickMultiplier = (mult: number) => {
    const target = chipTargets.get(mult)
    if (!target) return
    hapticImpact('light')
    playUpgradeSelect()
    setTargetId(target.id)
  }

  const confirm = async () => {
    if (!source || !targetId || spin || upgrading.current) return
    if (extraTooBig) {
      setError('Доплата больше вашего баланса')
      return
    }
    setError(null)
    upgrading.current = true
    let result
    try {
      const stakeNow = stakeMinor
      result = await placeUpgradeApi([source.uid, ...extraItems.map((i) => i.uid)], targetId, makeRequestId(), extraMinor)
      setSpinStake(stakeNow)
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
    // зелёная зона — дуга с центром внизу (180°), растекается в обе стороны на ±шанс×180°
    const half = (Math.min(100, pending.chancePercent) / 100) * 180
    const landAngle = pending.won
      ? 180 + (Math.random() - 0.5) * 2 * half * 0.8
      : 180 + half + (0.08 + Math.random() * 0.84) * (360 - 2 * half)
    const landFrac = (((landAngle % 360) + 360) % 360) / 360
    const base = Math.ceil(needleDeg / 360) * 360
    setSpin({ sourceGiftId: source.giftId, pending })
    setNeedleAnimated(false)
    hapticImpact('medium')
    playUpgradeSpin()
    setFlash(null)
    // кадр без transition (сброс), затем рывок
    timers.current.push(
      window.setTimeout(() => {
        setNeedleAnimated(true)
        setNeedleDeg(base + 360 * (turbo ? 3 : 5) + landFrac * 360)
      }, 60),
    )
    // «тики» при вращении — замедляются к концу
    for (let i = 0; i < 14; i += 1) {
      const t = 60 + (SPIN_MS * (1 - Math.pow(1 - i / 14, 2))) | 0
      timers.current.push(window.setTimeout(() => { playRouletteTick(1.2 - i * 0.03); hapticImpact('light') }, t))
    }
    timers.current.push(
      window.setTimeout(() => {
        if (pending.won) playUpgradeWin()
        else playUpgradeLose()
        hapticNotify(pending.won ? 'success' : 'error')
        setFlash(pending.won ? 'win' : 'lose')
        timers.current.push(window.setTimeout(() => setFlash(null), 900))
        setOutcome(pending)
        setSpin(null)
        // сразу ставим в апгрейд самый дорогой подарок из инвентаря (после выигрыша это обычно новый подарок)
        const burned = source.uid
        let best: { uid: string; price: number } | null = null
        const used = new Set([burned, ...extraUids])
        for (const it of useInventoryStore.getState().items) {
          if (used.has(it.uid)) continue
          const price = giftById.get(it.giftId)?.priceMinor ?? 0
          if (price > 0 && (!best || price > best.price)) best = { uid: it.uid, price }
        }
        setSourceUid(best ? best.uid : null)
        setTargetId(null)
        setExtraUids([])
        setExtraTon('')
        setSpinStake(null)
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
            onClick={() => {
              if (spinning) return
              setPickerMode('main')
              setPickerOpen(true)
            }}
            aria-label="Выбрать предмет"
          >
            <span className={styles.slotLabel}>Ваш предмет</span>
            {sourceGift ? (
              <>
                <img loading="lazy" decoding="async" className={styles.slotImage} src={sourceGift.image} alt="" />
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

          <div
            className={cx(styles.ringWrap, spinning && styles.ringShake, flash === 'win' && styles.flashWin, flash === 'lose' && styles.flashLose)}
            style={spinning ? { animationDuration: `${SPIN_MS}ms` } : undefined}
          >
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
                  style={{ transform: `rotate(${180 - Math.min(100, chancePct) * 1.8}deg)`, transformOrigin: '74px 74px' }}
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
              <span className={styles.liquid} style={{ height: `${chancePct === null ? 0 : Math.min(100, chancePct)}%` }} aria-hidden />
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
                <img loading="lazy" decoding="async" className={styles.slotImage} src={targetGift.image} alt="" />
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
      <div className={styles.addBox}>
        <div className={styles.addHead}>
          <span>Добавить к ставке</span>
          <b>ставка {formatMinor(stakeMinor)} TON</b>
        </div>
        <div className={styles.addRow}>
          {extraItems.map((it) => {
            const g = giftById.get(it.giftId)
            return (
              <span key={it.uid} className={styles.addChip}>
                {g && <img src={g.image} alt="" className={styles.addChipImg} />}
                <span className={styles.addChipPrice}>{formatMinor(g?.priceMinor ?? 0)}</span>
                <button
                  type="button"
                  className={styles.addChipX}
                  aria-label={`Убрать ${g?.name ?? 'подарок'}`}
                  disabled={spinning}
                  onClick={() => setExtraUids((u) => u.filter((x) => x !== it.uid))}
                >
                  ×
                </button>
              </span>
            )
          })}
          <button
            type="button"
            className={styles.addBtn}
            disabled={!sourceGift || spinning || extraUids.length >= 5}
            onClick={() => {
              setPickerMode('add')
              setPickerOpen(true)
            }}
          >
            + подарок
          </button>
        </div>
        <label className={styles.topup}>
          <span>Доплатить с баланса</span>
          <input
            className={styles.topupInput}
            inputMode="decimal"
            placeholder="0"
            value={extraTon}
            disabled={!sourceGift || spinning}
            onChange={(e) => setExtraTon(e.target.value.replace(/[^0-9.,]/g, ''))}
            aria-label="Доплата в TON"
          />
          <span className={styles.topupUnit}>TON</span>
        </label>
        {extraTooBig && <span className={styles.topupErr}>Больше, чем на балансе ({formatMinor(balance)} TON)</span>}
      </div>

      <div className={styles.sliderBox}>
        <div className={styles.sliderHead}>
          <span className={styles.sliderMult}>{currentMult ? `x${currentMult < 10 ? currentMult.toFixed(1) : Math.round(currentMult)}` : 'x—'}</span>
          <span className={styles.sliderChance} data-testid="slider-chance">{chancePct !== null ? `шанс ${fmtPct(chancePct)}%` : 'выберите предмет'}</span>
        </div>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={1000}
          step={1}
          value={sliderValue}
          disabled={!sliderBounds || spinning}
          aria-label="Икс цели: правее — дороже подарок и меньше шанс"
          onChange={(e) => onSlide(Number(e.target.value))}
          style={{ ['--fill' as string]: `${sliderValue / 10}%` }}
        />
        <div className={styles.sliderScale} aria-hidden>
          <span>шанс выше</span>
          <span>подарок дороже</span>
        </div>
      </div>

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

      <div className={styles.turboWrap}>
        <TurboToggle disabled={spinning} />
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

      <GiftPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(item: InventoryItem) => {
          playUpgradeSelect()
          if (pickerMode === 'add') {
            if (item.uid !== sourceUid) setExtraUids((u) => (u.includes(item.uid) ? u : [...u, item.uid].slice(0, 5)))
          } else {
            setSourceUid(item.uid)
            setExtraUids((u) => u.filter((x) => x !== item.uid))
          }
          setTargetId(null)
        }}
        excludeUids={pickerMode === 'add' ? [...(sourceUid ? [sourceUid] : []), ...extraUids] : extraUids}
        title="Предмет для апгрейда"
      />

      <UpgradeTargetSheet
        open={targetPickerOpen}
        onClose={() => setTargetPickerOpen(false)}
        targets={allVariants}
        sourcePriceMinor={sourceGift ? stakeMinor : null}
        selectedId={targetId}
        onConfirm={(id) => setTargetId(id)}
      />

      <BottomSheet open={outcome !== null} onClose={() => setOutcome(null)} title="Результат">
        {outcome && (
          <div className={styles.resultWrap}>
            <img loading="lazy" decoding="async"
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
