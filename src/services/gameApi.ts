/**
 * Игровые действия одним интерфейсом: в серверном режиме (production) их исполняет сервер, а
 * приложение лишь показывает ответ; в демо-режиме (тесты, локальная разработка) работают прежние
 * локальные сервисы. Баланс, подарки и звёзды в серверном режиме меняются только по ответу сервера.
 */
import { giftById } from '../data/catalog'
import type { FreeCaseId } from '../data/catalog'
import { ApiError, apiGet, apiPost } from '../lib/api'
import { SERVER_MODE } from '../lib/serverMode'
import { addServerItem, hydrateFromServer, removeServerItem, setServerBalance } from '../lib/serverSync'
import { formatMinor } from '../lib/money'
import { upgradeChancePercent, placeUpgrade, type UpgradeResult } from './demoUpgradeService'
import { claimFreeCase, openCase, type ClaimFreeResult, type OpenCaseResult } from './demoCaseService'
import { sellItem, type SellResult } from './demoInventoryService'
import {
  cashoutMines,
  pickMines,
  startMines,
  type MinesCashoutResult,
  type MinesPickResult,
  type MinesStartResult,
} from './demoMinesService'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { useRefBankStore } from '../store/refBank'
import { useStarsBalanceStore } from '../store/starsBalance'
import { useQuestsStore } from '../store/quests'
import { useInventoryStore } from '../store/inventory'

interface WithBalance {
  balance_minor?: number
}

function applyBalance(res: WithBalance): void {
  if (typeof res.balance_minor === 'number') setServerBalance(res.balance_minor)
}

/** Сообщение об ошибке для показа игроку. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Не удалось выполнить действие'
}

/* ------------------------------------------------------------------ кейсы */

export async function openCaseApi(caseId: string, requestId: string): Promise<OpenCaseResult> {
  if (!SERVER_MODE) return openCase(caseId, requestId)
  try {
    const res = await apiPost<{ gift_id: string; uid: string } & WithBalance>(`/api/play/cases/${caseId}/open`, {
      client_request_id: requestId,
    })
    applyBalance(res)
    addServerItem(res.uid, res.gift_id, 'case-open')
    void hydrateFromServer()
    return { status: 'ok', giftId: res.gift_id, uid: res.uid }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'insufficient_funds') return { status: 'insufficient_funds' }
    throw error
  }
}

export async function claimFreeCaseApi(caseId: FreeCaseId, requestId: string): Promise<ClaimFreeResult> {
  if (!SERVER_MODE) return claimFreeCase(caseId, requestId, Date.now())
  let res
  try {
    res = await apiPost<
      {
        status: 'ok' | 'cooldown' | 'used'
        gift_id?: string
        uid?: string
        next_available_at?: number
        deposit_required?: boolean
      } & WithBalance
    >(`/api/play/free/${caseId}/claim`, { client_request_id: requestId })
  } catch (error) {
    if (error instanceof ApiError && error.code === 'deposit_required') {
      await hydrateFromServer()
      return { status: 'deposit_required' }
    }
    throw error
  }
  applyBalance(res)
  if (res.status === 'used') {
    await hydrateFromServer()
    return { status: 'used' }
  }
  if (res.status === 'cooldown') return { status: 'cooldown', nextAvailableAt: res.next_available_at ?? Date.now() }
  const uid = res.uid ?? ''
  if (caseId === 'free') {
    // подарок из обычного FREE ждёт задания «5 друзей» и в инвентарь пока не попадает
    await hydrateFromServer()
  } else {
    addServerItem(uid, res.gift_id ?? '', 'free-case')
    void hydrateFromServer()
  }
  return { status: 'ok', giftId: res.gift_id ?? '', uid, depositRequired: res.deposit_required === true }
}

/* ------------------------------------------------------------------ инвентарь */

export async function sellItemApi(uid: string, requestId: string): Promise<SellResult> {
  if (!SERVER_MODE) return sellItem(uid, requestId)
  try {
    const res = await apiPost<{ credited_minor: number; gift_id: string } & WithBalance>('/api/me/inventory/sell', {
      item_id: uid,
    })
    applyBalance(res)
    removeServerItem(uid)
    return { status: 'ok', creditedMinor: res.credited_minor, giftId: res.gift_id }
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
      removeServerItem(uid)
      return { status: 'not_found' }
    }
    throw error
  }
}

/** Заявка на вывод подарка: подарок блокируется до выдачи владельцем. */
export async function withdrawItemApi(uid: string): Promise<void> {
  const res = await apiPost<{ status: string }>('/api/me/inventory/withdraw', { item_id: uid })
  if (res.status === 'ok') removeServerItem(uid)
}

/* ------------------------------------------------------------------ апгрейд */

export async function placeUpgradeApi(uid: string, targetGiftId: string, requestId: string): Promise<UpgradeResult> {
  if (!SERVER_MODE) return placeUpgrade(uid, targetGiftId, requestId)
  try {
    const res = await apiPost<
      {
        won: boolean
        chance: number
        source_price_minor: number
        target_price_minor: number
        gift_id: string | null
        uid: string
      } & WithBalance
    >('/api/play/upgrade', { item_id: uid, target_gift_id: targetGiftId, client_request_id: requestId })
    applyBalance(res)
    const sourceItem = useInventoryStore.getState().items.find((i) => i.uid === uid)
    removeServerItem(uid)
    if (res.won && res.gift_id) addServerItem(res.uid, res.gift_id, 'upgrade')
    const percent = upgradeChancePercent(res.source_price_minor, res.target_price_minor)
    useGamesHistoryStore.getState().push({
      game: 'Апгрейд',
      stakeLabel: giftById.get(sourceItem?.giftId ?? '')?.name ?? 'Подарок',
      outcome: res.won ? 'won' : 'lost',
      deltaMinor: res.won ? res.target_price_minor - res.source_price_minor : -res.source_price_minor,
      detail: res.won
        ? `выпал: ${giftById.get(targetGiftId)?.name ?? ''}`
        : `шанс ${percent.toFixed(2).replace(/\.?0+$/, '')}%`,
    })
    void hydrateFromServer()
    return {
      status: 'ok',
      won: res.won,
      chance: res.chance,
      sourcePriceMinor: res.source_price_minor,
      targetPriceMinor: res.target_price_minor,
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: 'rejected', reason: error.code === 'unknown_target' ? 'unknown_target' : 'unknown_item' }
    }
    if (error instanceof ApiError && error.status === 409) return { status: 'rejected', reason: 'duplicate' }
    throw error
  }
}

/* ------------------------------------------------------------------ мины */

let minesRoundId: string | null = null
let minesBet = 0
let minesCount = 0

function minesHistory(outcome: 'won' | 'lost', delta: number, detail: string): void {
  useGamesHistoryStore.getState().push({
    game: 'Мины',
    stakeLabel: `${formatMinor(minesBet)} TON`,
    stakeMinor: minesBet,
    outcome,
    deltaMinor: delta,
    detail,
  })
}

export async function startMinesApi(betMinor: number, mines: number, requestId: string): Promise<MinesStartResult> {
  if (!SERVER_MODE) return startMines(betMinor, mines, requestId)
  try {
    const res = await apiPost<{ round_id: string } & WithBalance>('/api/play/mines/start', {
      bet_minor: betMinor,
      mines_count: mines,
      client_request_id: requestId,
    })
    applyBalance(res)
    minesRoundId = res.round_id
    minesBet = betMinor
    minesCount = mines
    return { status: 'ok', minesCount: mines, betMinor }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'insufficient_funds') return { status: 'rejected', reason: 'insufficient_funds' }
    if (error instanceof ApiError && error.code === 'invalid_amount') return { status: 'rejected', reason: 'invalid_amount' }
    if (error instanceof ApiError && error.code === 'invalid_mines') return { status: 'rejected', reason: 'invalid_mines' }
    throw error
  }
}

interface MinesServerReply extends WithBalance {
  event: 'safe' | 'lost' | 'cleared' | 'cashed'
  picked_count: number
  multiplier_hundredths: number
  payout_minor: number
  mine_positions: number[] | null
}

export async function pickMinesApi(tile: number, requestId: string): Promise<MinesPickResult> {
  if (!SERVER_MODE) return pickMines(tile, requestId)
  if (!minesRoundId) return { status: 'rejected', reason: 'no_round' }
  try {
    const res = await apiPost<MinesServerReply>(`/api/play/mines/${minesRoundId}/pick`, { tile })
    applyBalance(res)
    if (res.event === 'lost') {
      minesHistory('lost', -minesBet, `${minesCount} мин · мина на ходу ${res.picked_count + 1}`)
      minesRoundId = null
    } else if (res.event === 'cleared') {
      minesHistory(
        'won',
        res.payout_minor - minesBet,
        `${minesCount} мин · полный сбор x${(res.multiplier_hundredths / 100).toFixed(2)}`,
      )
      minesRoundId = null
    }
    if (res.event !== 'safe') void hydrateFromServer()
    return {
      status: 'ok',
      event: res.event === 'cashed' ? 'cleared' : res.event,
      pickedCount: res.picked_count,
      multiplierHundredths: res.multiplier_hundredths,
      payoutMinor: res.payout_minor,
      minePositions: res.mine_positions,
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { status: 'rejected', reason: error.code === 'tile_picked' ? 'tile_picked' : 'round_finished' }
    }
    if (error instanceof ApiError && error.status === 404) return { status: 'rejected', reason: 'no_round' }
    throw error
  }
}

export async function cashoutMinesApi(requestId: string): Promise<MinesCashoutResult> {
  if (!SERVER_MODE) return cashoutMines(requestId)
  if (!minesRoundId) return { status: 'rejected', reason: 'no_round' }
  try {
    const res = await apiPost<MinesServerReply>(`/api/play/mines/${minesRoundId}/cashout`, {})
    applyBalance(res)
    minesHistory(
      'won',
      res.payout_minor - minesBet,
      `${minesCount} мин · забрал ${res.picked_count} · x${(res.multiplier_hundredths / 100).toFixed(2)}`,
    )
    minesRoundId = null
    void hydrateFromServer()
    return {
      status: 'ok',
      event: 'cashed',
      pickedCount: res.picked_count,
      multiplierHundredths: res.multiplier_hundredths,
      payoutMinor: res.payout_minor,
      minePositions: res.mine_positions ?? [],
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return { status: 'rejected', reason: 'nothing_picked' }
    if (error instanceof ApiError && error.status === 404) return { status: 'rejected', reason: 'no_round' }
    throw error
  }
}

/* ------------------------------------------------------------------ звёзды и задания */

export async function claimQuestApi(id: string): Promise<'ok' | 'already_claimed' | 'not_enough'> {
  if (!SERVER_MODE) return useQuestsStore.getState().claim(id)
  try {
    await apiPost(`/api/me/quests/${id}/claim`, {})
    await hydrateFromServer()
    return 'ok'
  } catch (error) {
    if (error instanceof ApiError && error.code === 'already_claimed') return 'already_claimed'
    return 'not_enough'
  }
}

export async function exchangeStarsApi(stars: number): Promise<'ok' | 'too_small' | 'insufficient'> {
  if (!SERVER_MODE) return useStarsBalanceStore.getState().exchange(stars)
  try {
    const res = await apiPost<WithBalance>('/api/me/stars/exchange', { stars })
    applyBalance(res)
    await hydrateFromServer()
    return 'ok'
  } catch (error) {
    if (error instanceof ApiError && error.code === 'too_small') return 'too_small'
    if (error instanceof ApiError && error.code === 'insufficient_stars') return 'insufficient'
    throw error
  }
}

/** Забрать звёзды за друзей из банка на баланс звёзд (от 15 ★). */
export async function claimBankApi(): Promise<'ok' | 'too_small'> {
  if (!SERVER_MODE) return useRefBankStore.getState().claimLocal()
  try {
    await apiPost('/api/me/bank/claim', {})
    await hydrateFromServer()
    return 'ok'
  } catch (error) {
    if (error instanceof ApiError && error.code === 'bank_too_small') return 'too_small'
    throw error
  }
}

/** Обновляет задание FREE с сервера (подарок выдаётся, когда 5 друзей с Premium открыли бесплатный кейс). */
export async function refreshFreeQuest(): Promise<void> {
  if (!SERVER_MODE) return
  await apiGet('/api/play/free/quest')
  await hydrateFromServer()
}
