import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clampDiceTarget,
  diceMultiplier,
  diceMultiplierScaled4,
  diceTargetFromMultiplier,
  diceWinChancePercentScaled,
  DICE_MAX_TARGET,
  isValidDiceTarget,
  type DiceDirection,
} from '../lib/diceMath'
import { formatMinor, toMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { rollDice } from '../services/demoDiceService'
import { useWalletStore } from '../store/wallet'
import { GAME_RTP } from '../lib/gameConfig'
import { Input } from '../components/ui'
import { ChevronLeftIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './DiceScreen.module.css'

const PRESETS: readonly Minor[] = [100, 500, 1000, 5000] // 0.1 / 0.5 / 1 / 5 GRAM

interface DiceOutcome {
  roll: number
  won: boolean
  winMinor: Minor
  betMinor: Minor
}

/**
 * Дайс (4.7). Спека 10.7: поля «множитель / больше-меньше / шанс / ползунок» —
 * изменение любого пересчитывает остальные. Все значения — целочисленные формулы
 * (lib/diceMath): m4 = floor(98e6/c); ролл ∈ [0, 9999] делает demo-сервис
 * (в production — сервер с CSPRNG, TIER 7). Округления только вниз.
 */
export function DiceScreen() {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode])

  const [direction, setDirection] = useState<DiceDirection>('over')
  const [target, setTarget] = useState(5099) // шанс 49%
  const [amountInput, setAmountInput] = useState('1')
  const [chanceInput, setChanceInput] = useState('49')
  const [multiplierInput, setMultiplierInput] = useState('2')
  const [outcome, setOutcome] = useState<DiceOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clamped = clampDiceTarget(target, direction)
  const valid = isValidDiceTarget(clamped, direction)
  const m4 = valid ? diceMultiplierScaled4(clamped, direction) : 0
  const chancePctScaled = valid ? diceWinChancePercentScaled(clamped, direction) : 0

  // Ползунок и направление — источник истины; поля шанса/множителя отображают их.
  const changeDirection = (next: DiceDirection) => {
    setDirection(next)
    setTarget((current) => clampDiceTarget(current, next))
  }

  const applyChance = (raw: string) => {
    setChanceInput(raw)
    const pct = Number.parseFloat(raw.replace(',', '.'))
    if (!Number.isFinite(pct)) return
    const c = Math.round(pct * 100)
    if (c < 1 || c > 9800) return
    setTarget(direction === 'over' ? DICE_MAX_TARGET - c : c)
  }

  const applyMultiplier = (raw: string) => {
    setMultiplierInput(raw)
    const m = Number.parseFloat(raw.replace(',', '.'))
    if (!Number.isFinite(m) || m <= 0) return
    const mScaled = Math.round(m * 10_000)
    setTarget(diceTargetFromMultiplier(mScaled, direction))
  }

  // Цель меняется ползунком → синхронизируем поля (пересчёт «остальных»).
  useEffect(() => {
    if (!valid) return
    setChanceInput((chancePctScaled / 100).toFixed(2).replace(/\.?0+$/, ''))
    setMultiplierInput((m4 / 10_000).toFixed(4).replace(/\.?0+$/, ''))
    // Отображаемая пара chance/mult определяется целью:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, direction])

  const amountMinor: Minor | null = useMemo(() => {
    try {
      const value = toMinor(amountInput)
      return value > 0 ? value : null
    } catch {
      return null
    }
  }, [amountInput])
  const insufficient = amountMinor === null || balance < amountMinor

  const roll = () => {
    if (amountMinor === null || insufficient || !valid) return
    setError(null)
    const result = rollDice(amountMinor, clamped, direction, makeRequestId())
    if (result.status !== 'ok') {
      setError('Не удалось принять ставку — попробуйте ещё раз')
      return
    }
    setOutcome({
      roll: result.roll,
      won: result.won,
      winMinor: result.winMinor,
      betMinor: result.betMinor,
    })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
      </div>

      <h1 className={styles.title}>Дайс</h1>

      {/* Полотно: ролл, направление, цель, шанс */}
      <div className={styles.canvas}>
        <div className={styles.rollDisplay}>
          <span
            className={cx(
              styles.rollValue,
              outcome && (outcome.won ? styles.rollWon : styles.rollLost),
            )}
          >
            {outcome ? outcome.roll : '0000'}
          </span>
          <span className={styles.rollHint}>
            {outcome
              ? outcome.won
                ? `Ролл ${direction === 'over' ? 'выше' : 'ниже'} ${clamped} — выигрыш`
                : `Ролл не ${direction === 'over' ? 'выше' : 'ниже'} ${clamped}`
              : 'Ролл 0–9999 — сделайте ставку'}
          </span>
        </div>

        <div className={styles.direction} role="group" aria-label="Направление ставки">
          <button
            type="button"
            className={cx(styles.directionChip, direction === 'over' && styles.directionChipActive)}
            aria-pressed={direction === 'over'}
            onClick={() => changeDirection('over')}
          >
            Больше X
          </button>
          <button
            type="button"
            className={cx(
              styles.directionChip,
              direction === 'under' && styles.directionChipActive,
            )}
            aria-pressed={direction === 'under'}
            onClick={() => changeDirection('under')}
          >
            Меньше X
          </button>
        </div>

        <input
          className={styles.slider}
          type="range"
          min={1}
          max={DICE_MAX_TARGET}
          step={1}
          value={clamped}
          aria-label="Цель X"
          onChange={(event) => setTarget(Number(event.target.value))}
        />

        <div className={styles.targetRow}>
          <span className={styles.targetValue}>
            {direction === 'over' ? '>' : '<'} {clamped}
          </span>
          <span className={styles.chancePill}>
            {(chancePctScaled / 100).toFixed(2).replace(/\.?0+$/, '')}%
          </span>
        </div>
      </div>

      {/* Поля «шанс» и «множитель» — пересчитывают цель (спека 10.7) */}
      <div className={styles.fields}>
        <Input
          label="Шанс, %"
          inputMode="decimal"
          value={chanceInput}
          onChange={(event) => applyChance(event.target.value)}
        />
        <Input
          label="Множитель"
          inputMode="decimal"
          value={multiplierInput}
          onChange={(event) => applyMultiplier(event.target.value)}
        />
      </div>

      {/* Панель ставки */}
      <div className={styles.betPanel}>
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
          placeholder="Сумма в GRAM"
          suffix="GRAM"
          value={amountInput}
          onChange={(event) => {
            setError(null)
            setAmountInput(event.target.value)
          }}
          hint={`Баланс: ${formatMinor(balance)} GRAM · выплата floor(ставка × множитель)`}
        />

        {error && (
          <p className={styles.betError} role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className={styles.placeBet}
          disabled={amountMinor === null || insufficient || !valid}
          onClick={roll}
        >
          {amountMinor !== null ? `Бросить · ${formatMinor(amountMinor)} GRAM` : 'Бросить'}
        </button>

        {outcome && (
          <p className={outcome.won ? styles.resultWon : styles.resultLost}>
            {outcome.won
              ? `Выигрыш +${formatMinor(outcome.winMinor - outcome.betMinor)} GRAM (x${(
                  diceMultiplier(clamped, direction) || 0
                ).toFixed(2)})`
              : `Мимо: −${formatMinor(outcome.betMinor)} GRAM`}
          </p>
        )}
      </div>

      <p className={styles.note}>
        Честная игра: шанс p = {(chancePctScaled / 100).toFixed(2)}%,
        множитель = floor4({GAME_RTP}/p) — мгновенная выплата при выигрыше.
      </p>
    </div>
  )
}
