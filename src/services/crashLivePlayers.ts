export interface SimulatedPlayer {
  id: string
  name: string
  avatar: string
  stakeMinor: number
  targetMultiplier: number
  cashedOut: boolean
  wonGiftId?: string
}

const PLAYER_PROFILES = [
  { name: 'cryptowhale', avatar: '/avatars/user_1.png', defaultStake: 200 },
  { name: 'V5B', avatar: '/avatars/user_2.png', defaultStake: 520 },
  { name: 'Saullmurder', avatar: '/avatars/user_3.png', defaultStake: 300 },
  { name: 'Module_II', avatar: '/avatars/user_4.png', defaultStake: 2600 },
  { name: 'Al_Sheikh', avatar: '/avatars/user_5.png', defaultStake: 100 },
  { name: 'Pavel_D', avatar: '/avatars/user_6.png', defaultStake: 200 },
  { name: 'Shazy', avatar: '/avatars/user_7.png', defaultStake: 150 },
  { name: 'Artem_TON', avatar: '/avatars/user_8.png', defaultStake: 100 },
  { name: 'kamronbek', avatar: '/avatars/user_9.png', defaultStake: 1260 },
  { name: 'abdoo', avatar: '/avatars/user_10.png', defaultStake: 1000 },
  { name: 'DIYORBEK', avatar: '/avatars/user_11.png', defaultStake: 520 },
  { name: 'EGO_TRADER', avatar: '/avatars/user_12.png', defaultStake: 100 },
]

const BONUS_GIFTS = [
  'diamond-ring',
  'heart-locket',
  'scared-cat',
  'magic-potion',
  'chill-flame',
  'astral-shard',
  'durovs-cap',
  'holiday-gift',
]

/**
 * Генерирует реалистичный пул игроков для раунда на основе сида roundId.
 */
export function generateRoundPlayers(roundId: number): SimulatedPlayer[] {
  // Детерминированный псевдо-ГСЧ от roundId для согласованности тиков
  let seed = (roundId * 9301 + 49297) % 233280
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  // Выбираем 6-9 активных игроков на раунд
  const count = 7 + Math.floor(rnd() * 4)
  const shuffled = [...PLAYER_PROFILES].sort(() => rnd() - 0.5).slice(0, count)

  return shuffled.map((profile, idx) => {
    // Распределение целевого множителя кешаута
    const r = rnd()
    let target = 1.1 + rnd() * 0.8 // 1.1x - 1.9x (ранний вывод)
    if (r > 0.45 && r <= 0.8) {
      target = 2.0 + rnd() * 2.5 // 2.0x - 4.5x (средний)
    } else if (r > 0.8) {
      target = 4.5 + rnd() * 8.0 // 4.5x - 12.5x (высокий/рисковый)
    }
    target = Math.floor(target * 100) / 100

    // Если игрок выводит на высоком множителе (>= 2.5x), выдаём бонусный Telegram NFT подарок
    let wonGiftId: string | undefined
    if (target >= 2.5 && rnd() > 0.3) {
      const giftIdx = Math.floor(rnd() * BONUS_GIFTS.length)
      wonGiftId = BONUS_GIFTS[giftIdx]
    }

    return {
      id: `player-${roundId}-${idx}`,
      name: profile.name,
      avatar: profile.avatar,
      stakeMinor: profile.defaultStake,
      targetMultiplier: target,
      cashedOut: false,
      wonGiftId,
    }
  })
}
