import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MINES_TILES,
  minesMultiplier,
  minesMultiplierHundredths,
} from '../lib/minesMath'
import { formatMinor, toMinor, mulByMultiplier, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import {
  cashoutMines,
  pickMines,
  startMines,
  type MinesPickResult,
} from '../services/demoMinesService'
import { useWalletStore } from '../store/wallet'
import { GAME_RTP } from '../lib/gameConfig'
import { Input } from '../components/ui'
import { ChevronLeftIcon, BombIcon, TonIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './MinesScreen.module.css'

const PRESETS: readonly Minor[] = [100, 500, 1000, 5000] // 0.1 / 0.5 / 1 / 5 GRAM
const MINES_PRESETS: readonly number[] = [1, 3, 5, 10, 24]

interface RoundView {
  phase: 'playing' | 'lost' | 'cashed' | 'cleared'
  betMinor: Minor
  picked: number[]
  minePositions: number[] | null
  payoutMinor: Minor
}

/**
 * Мины (4.8). Доска 5×5; раскладку генерирует demo-сервис при старте и держит
 * у себя («сервер») — клиент видит только открытые клетки и раскрытие в конце.
 * Множители и выплаты — только формулы minesMath (округление только вниз).
 */
export function MinesScreen() {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode])

  const [minesCount, setMinesCount] = useState(3)
  const [amountInput, setAmountInput] = useState('1')
  const [round, setRound] = useState<RoundView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const amountMinor: Minor | null = useMemo(() => {
    try {
      const value = toMinor(amountInput)
      return value > 0 ? value : null
    } catch {
      return null
    }
  }, [amountInput])
  const insufficient = amountMinor === null || balance < amountMinor
  const playing = round !== null && round.phase === 'playing'
  const finished = round !== null && round.phase !== 'playing'

  const start = () => {
    if (amountMinor === null || insufficient) return
    setError(null)
    const result = startMines(amountMinor, minesCount, makeRequestId())
    if (result.status !== 'ok') {
      setError(
        result.reason === 'insufficient_funds'
          ? 'Недостаточно средств на балансе'
          : 'Не удалось принять ставку — попробуйте ещё раз',
      )
      return
    }
    setRound({
      phase: 'playing',
      betMinor: amountMinor,
      picked: [],
      minePositions: null,
      payoutMinor: 0,
    })
  }

  const pick = (tileIndex: number) => {
    if (!playing || round.picked.includes(tileIndex)) return
    setError(null)
    const result: MinesPickResult = pickMines(tileIndex, makeRequestId())
    if (result.status !== 'ok') {
      setError('Ход не принят — попробуйте ещё раз')
      return
    }
    if (result.event === 'safe') {
      setRound((current) =>
        current ? { ...current, picked: [...current.picked, tileIndex] } : current,
      )
      return
    }
    setRound({
      phase: result.event === 'lost' ? 'lost' : 'cleared',
      betMinor: round.betMinor,
      picked: result.event === 'cleared' ? [...round.picked, tileIndex] : round.picked,
      minePositions: result.minePositions,
      payoutMinor: result.payoutMinor,
    })
  }

  const take = () => {
    if (!playing || round.picked.length === 0) return
    setError(null)
    const result = cashoutMines(makeRequestId())
    if (result.status !== 'ok') {
      setError('Забрать не удалось — попробуйте ещё раз')
      return
    }
    setRound({
      phase: 'cashed',
      betMinor: round.betMinor,
      picked: round.picked,
      minePositions: result.minePositions,
      payoutMinor: result.payoutMinor,
    })
  }

  const openedCount = round?.picked.length ?? 0
  const currentMultiplierHundredths = playing
    ? minesMultiplierHundredths(minesCount, openedCount)
    : 0
  const canCashout = playing && openedCount > 0

  const tileContent = (index: number) => {
    if (round === null) return null
    const mines = round.minePositions ?? []
    if (mines.includes(index)) {
      return (
        <span data-testid="bomb-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <BombIcon style={{ width: '22px', height: '22px', color: '#ff5c5c' }} />
        </span>
      )
    }
    if (round.picked.includes(index)) {
      return (
        <span data-testid="gem-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <TonIcon style={{ width: '22px', height: '22px' }} />
        </span>
      )
    }
    return finished ? '·' : null
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
        <span className={styles.demoChip}>Demo Mode</span>
      </div>

      <h1 className={styles.title}>Мины</h1>

      <div className={styles.canvas}>
        <div className={styles.minesRow}>
          <span className={styles.minesLabel}>Мин на поле:</span>
          <div className={styles.minesChips} role="group" aria-label="Число мин">
            {MINES_PRESETS.map((count) => (
              <button
                key={count}
                type="button"
                className={cx(styles.mineChip, minesCount === count && styles.mineChipActive)}
                aria-pressed={minesCount === count}
                disabled={playing}
                onClick={() => setMinesCount(count)}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.board} role="group" aria-label={`Поле ${MINES_TILES} клеток`}>
          {Array.from({ length: MINES_TILES }, (_, index) => (
            <button
              key={index}
              type="button"
              className={cx(
                styles.tile,
                round?.picked.includes(index) && styles.tilePicked,
                round?.minePositions?.includes(index) && styles.tileMine,
                finished && !round.picked.includes(index) && !round.minePositions?.includes(index)
                  ? styles.tileDim
                  : '',
              )}
              aria-label={`Клетка ${index + 1}`}
              disabled={!playing || round?.picked.includes(index) === true}
              onClick={() => pick(index)}
            >
              {tileContent(index)}
            </button>
          ))}
        </div>

        <div className={styles.statusRow}>
          <span>
            {playing
              ? `Открыто ${openedCount} · x${(minesMultiplier(minesCount, Math.max(1, openedCount)) || 0).toFixed(2)}`
              : finished
                ? 'Раунд завершён'
                : `Шанс на клетку: ${((100 * (MINES_TILES - minesCount)) / MINES_TILES).toFixed(0)}%`}
          </span>
          <span>Мин: {minesCount}</span>
        </div>
      </div>

      <div className={styles.betPanel}>
        {!playing && (
          <>
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
              hint={`Баланс: ${formatMinor(balance)} TON`}
            />

            {error && (
              <p className={styles.betError} role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              className={styles.placeBet}
              disabled={amountMinor === null || insufficient}
              onClick={start}
            >
              {amountMinor !== null ? `Начать · ${formatMinor(amountMinor)} TON` : 'Начать'}
            </button>
          </>
        )}

        {playing && (
          <>
            {error && (
              <p className={styles.betError} role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className={styles.cashout}
              disabled={!canCashout}
              onClick={take}
            >
              {canCashout
                ? `Забрать x${(currentMultiplierHundredths / 100).toFixed(2)} · +${formatMinor(
                    mulByMultiplier(round.betMinor, currentMultiplierHundredths / 100),
                  )} TON`
                : 'Откройте клетку, чтобы забрать'}
            </button>
          </>
        )}

        {finished && (
          <>
            <p className={round.phase === 'lost' ? styles.resultLost : styles.resultWon}>
              {round.phase === 'lost'
                ? `Мина! −${formatMinor(round.betMinor)} TON`
                : round.phase === 'cleared'
                  ? `Полный сбор +${formatMinor(round.payoutMinor)} TON`
                  : `Забрано +${formatMinor(round.payoutMinor)} TON`}
            </p>
            <button type="button" className={styles.again} onClick={() => setRound(null)}>
              Играть снова
            </button>
          </>
        )}
      </div>

      <p className={styles.note}>
        Demo Mode: раскладка мин — локальный ГСЧ при старте раунда, множитель =
        floor2({GAME_RTP}·C(25,k)/C(25−m,k)) — округление только вниз, забор закрывает раунд.
        Серверная раскладка и Provably Fair — TIER 7 (7.6).
      </p>
    </div>
  )
}
