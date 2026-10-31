import type { Gift } from '../data/catalog'
import { formatMinor } from './money'
import { getTelegramUser } from './telegram'

/**
 * Готовый текст для менеджера (@SexyDropOwner): открывается в личном чате уже написанным,
 * пользователю остаётся нажать «Отправить». По uid менеджер находит подарок в выдаче.
 */
export function buildWithdrawMessage(gift: Gift, uid: string): string {
  const user = getTelegramUser()
  const who = user ? (user.username ? `@${user.username} (ID ${user.id})` : `ID ${user.id}`) : 'не определён'
  return [
    'Привет! Я выиграл подарок в SEXY DROP и хочу его вывести.',
    '',
    `🎁 Подарок: ${gift.name}`,
    `💎 Стоимость: ${formatMinor(gift.priceMinor)} TON`,
    `🆔 Номер выдачи: ${uid}`,
    `👤 Мой аккаунт: ${who}`,
    '',
    'Отправьте, пожалуйста, подарок на мой аккаунт.',
  ].join('\n')
}
