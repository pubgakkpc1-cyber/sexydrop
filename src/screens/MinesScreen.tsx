import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MINES_TILES,
  minesMultiplier,
  minesMultiplierHundredths,
} from '../lib/minesMath'
import { formatMinor, toMinor, mulByMultiplier, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { cashoutMinesApi, errorText, pickMinesApi, startMinesApi } from '../services/gameApi'
import { useWalletStore } from '../store/wallet'
import { MAX_BET_MINOR, MIN_BET_MINOR } from '../lib/gameConfig'
import { Input } from '../components/ui'
import { ChevronLeftIcon, DropBombIcon, TonIcon } from '../components/shell/icons'
import { MULT_TIER_STYLE, multTier } from '../lib/multTier'
import { hapticImpact, hapticNotify } from '../lib/telegram'
import {
  playMinesBoom,
  playMinesCashout,
  playMinesGem,
  playMinesStart,
} from '../lib/sound'
import { cx } from '../lib/cx'
import styles from './MinesScreen.module.css'

const MINES_PRESETS: readonly number[] = [1, 3, 5, 10, 24]

interface RoundView {
  phase: 'playing' | 'lost' | 'cashed' | 'cleared'
  betMinor: Minor
  picked: number[]
  minePositions: number[] | null
  payoutMinor: Minor
  /** Клетка, на которой подорвались (для эффекта взрыва). */
  boomIndex: number | null
}

interface TileProps {
  index: number
  picked: boolean
  isMine: boolean
  isBoom: boolean
  dim: boolean
  pending: boolean
  disabled: boolean
  revealDelay: number
  showDot: boolean
  onPick: (index: number) => void
}

/** Одна клетка: перерисовывается только когда меняется она сама, а не всё поле. */
const Tile = memo(function Tile({ index, picked, isMine, isBoom, dim, pending, disabled, revealDelay, showDot, onPick }: TileProps) {
  return (
    <button
      type="button"
      className={cx(styles.tile, picked && styles.tilePicked, isMine && styles.tileMine, isBoom && styles.tileBoom, dim && styles.tileDim, pending && styles.tilePending)}
      style={isMine && !isBoom ? ({ '--d': `${revealDelay}s` } as CSSProperties) : undefined}
      aria-label={`Клетка ${index + 1}`}
      disabled={disabled}
      onClick={() => onPick(index)}
    >
      {isMine ? (
        <span data-testid="bomb-icon" className={styles.iconBox}>
          <DropBombIcon className={styles.bombIcon} style={{ width: '30px', height: '30px', color: '#e0484f' }} />
        </span>
      ) : picked ? (
        <span data-testid="gem-icon" className={styles.iconBox}>
          <TonIcon className={styles.gemIcon} style={{ width: '26px', height: '26px' }} />
        </span>
      ) : showDot ? (
        '·'
      ) : null}
      {isBoom && <span className={styles.shock} aria-hidden />}
    </button>
  )
})

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
  const [pendingTile, setPendingTile] = useState<number | null>(null) // клетка нажата, ждём ответ сервера

  const amountMinor: Minor | null = useMemo(() => {
    try {
      const value = toMinor(amountInput)
      return value > 0 ? value : null
    } catch {
      return null
    }
  }, [amountInput])
  const tooBig = amountMinor !== null && amountMinor > MAX_BET_MINOR
  const tooSmall = amountMinor !== null && amountMinor < MIN_BET_MINOR
  const insufficient = amountMinor === null || balance < amountMinor || tooBig || tooSmall
  const playing = round !== null && round.phase === 'playing'
  const finished = round !== null && round.phase !== 'playing'

  const busy = useRef(false)

  const start = async () => {
    if (amountMinor === null || insufficient || busy.current) return
    setError(null)
    busy.current = true
    let result
    try {
      result = await startMinesApi(amountMinor, minesCount, makeRequestId())
    } catch (e) {
      setError(errorText(e))
      return
    } finally {
      busy.current = false
    }
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
      boomIndex: null,
    })
    playMinesStart()
    hapticImpact('light')
  }

  const roundRef = useRef<RoundView | null>(null)
  roundRef.current = round

  const pick = useCallback(async (tileIndex: number) => {
    const round = roundRef.current
    if (round === null || round.phase !== 'playing' || round.picked.includes(tileIndex) || busy.current) return
    setError(null)
    busy.current = true
    setPendingTile(tileIndex) // мгновенная реакция на нажатие, не дожидаясь сети
    hapticImpact('light')
    let result
    try {
      result = await pickMinesApi(tileIndex, makeRequestId())
    } catch (e) {
      setError(errorText(e))
      return
    } finally {
      busy.current = false
      setPendingTile(null)
    }
    if (result.status !== 'ok') {
      setError('Ход не принят — попробуйте ещё раз')
      return
    }
    if (result.event === 'safe') {
      setRound((current) =>
        current ? { ...current, picked: [...current.picked, tileIndex] } : current,
      )
      playMinesGem(round.picked.length + 1)
      return
    }
    if (result.event === 'lost') {
      playMinesBoom()
      hapticNotify('error')
    } else {
      playMinesCashout()
      hapticNotify('success')
    }
    setRound({
      phase: result.event === 'lost' ? 'lost' : 'cleared',
      betMinor: round.betMinor,
      picked: result.event === 'cleared' ? [...round.picked, tileIndex] : round.picked,
      minePositions: result.minePositions,
      payoutMinor: result.payoutMinor,
      boomIndex: result.event === 'lost' ? tileIndex : null,
    })
  }, [])

  const take = async () => {
    if (!playing || round.picked.length === 0 || busy.current) return
    setError(null)
    busy.current = true
    let result
    try {
      result = await cashoutMinesApi(makeRequestId())
    } catch (e) {
      setError(errorText(e))
      return
    } finally {
      busy.current = false
    }
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
      boomIndex: null,
    })
    playMinesCashout()
    hapticNotify('success')
  }

  /** Случайная закрытая клетка — для быстрой игры одним пальцем. */
  const pickRandom = () => {
    if (!playing || pendingTile !== null) return
    const closed = Array.from({ length: MINES_TILES }, (_, i) => i).filter((i) => !round.picked.includes(i))
    if (closed.length === 0) return
    pick(closed[Math.floor(Math.random() * closed.length)]!)
  }

  const openedCount = round?.picked.length ?? 0
  const currentMultiplierHundredths = playing
    ? minesMultiplierHundredths(minesCount, openedCount)
    : 0
  const canCashout = playing && openedCount > 0

  // Лестница множителей: сколько платит каждый следующий шаг
  const maxSteps = MINES_TILES - minesCount
  const ladder = useMemo(
    () =>
      Array.from({ length: Math.min(maxSteps, 12) }, (_, i) => ({
        step: i + 1,
        mult: minesMultiplierHundredths(minesCount, i + 1) / 100,
      })),
    [minesCount, maxSteps],
  )
  const nextMult = openedCount < maxSteps ? minesMultiplierHundredths(minesCount, openedCount + 1) / 100 : null

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
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

        <div className={cx(styles.board, round?.phase === 'lost' && styles.boardShake)} role="group" aria-label={`Поле ${MINES_TILES} клеток`}>
          {Array.from({ length: MINES_TILES }, (_, index) => {
            const minePositions = round?.minePositions ?? null
            const isMine = minePositions?.includes(index) === true
            const picked = round?.picked.includes(index) === true
            return (
              <Tile
                key={index}
                index={index}
                picked={picked}
                isMine={isMine}
                isBoom={round?.boomIndex === index}
                dim={finished && !picked && !isMine}
                pending={pendingTile === index}
                disabled={!playing || picked || pendingTile !== null}
                revealDelay={isMine ? 0.12 + Math.min(minePositions!.indexOf(index), 12) * 0.035 : 0}
                showDot={finished}
                onPick={pick}
              />
            )
          })}
        </div>

        <div className={styles.statusRow}>
          <span>
            {playing
              ? `Открыто ${openedCount} · x${(minesMultiplier(minesCount, Math.max(1, openedCount)) || 0).toFixed(2)}`
              : finished
                ? 'Раунд завершён'
                : 'Выбери клетку'}
          </span>
          <span>Мин: {minesCount}</span>
        </div>

        <div className={styles.ladder} role="list" aria-label="Лестница множителей">
          {ladder.map(({ step, mult }) => {
            const done = step <= openedCount
            const next = playing && step === openedCount + 1
            const tier = MULT_TIER_STYLE[multTier(mult)]
            return (
              <span
                key={step}
                role="listitem"
                className={cx(styles.rung, done && styles.rungDone, next && styles.rungNext)}
                style={{ '--tier': tier.color } as CSSProperties}
              >
                <i className={styles.rungStep}>{step}</i>x{mult.toFixed(2)}
              </span>
            )
          })}
        </div>
        {playing && nextMult !== null && (
          <p className={styles.nextHint}>
            Следующая клетка: x{nextMult.toFixed(2)}
          </p>
        )}
      </div>

      <div className={styles.betPanel}>
        {!playing && (
          <>
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
              hint={
                tooBig
                  ? 'Максимальная ставка — 1000 TON'
                  : tooSmall
                    ? 'Минимальная ставка — 0.1 TON'
                    : `Баланс: ${formatMinor(balance)} TON`
              }
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
            <button type="button" className={styles.randomBtn} onClick={pickRandom}>
              Случайная клетка
            </button>
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
            <p className={cx(round.phase === 'lost' ? styles.resultLost : styles.resultWon, styles.resultPop)}>
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
    </div>
  )
}
