import { getGiftForValue } from '../data/catalog'

export interface SimulatedPlayer {
  id: string
  name: string
  avatar: string
  stakeMinor: number
  stakeGiftId: string
  targetMultiplier: number
  cashedOut: boolean
  wonGiftId?: string
}

const PLAYER_PROFILES = [
  { name: 'cryptowhale', avatar: '/avatars/user_1.png', defaultStake: 20000 },
  { name: 'Module_II', avatar: '/avatars/user_4.png', defaultStake: 12000 },
  { name: 'kamronbek', avatar: '/avatars/user_9.png', defaultStake: 5000 },
  { name: 'abdoo', avatar: '/avatars/user_10.png', defaultStake: 3500 },
  { name: 'V5B', avatar: '/avatars/user_2.png', defaultStake: 2000 },
  { name: 'DIYORBEK', avatar: '/avatars/user_11.png', defaultStake: 1500 },
  { name: 'abood_vip', avatar: '/avatars/user_6.png', defaultStake: 1000 },
  { name: 'Saullmurder', avatar: '/avatars/user_3.png', defaultStake: 600 },
  { name: 'Pavel_D', avatar: '/avatars/user_5.png', defaultStake: 500 },
  { name: 'Shazy', avatar: '/avatars/user_7.png', defaultStake: 300 },
  { name: 'Al_Sheikh', avatar: '/avatars/user_8.png', defaultStake: 200 },
  { name: 'Artem_TON', avatar: '/avatars/user_12.png', defaultStake: 150 },
  { name: 'EGO_TRADER', avatar: '/avatars/user_1.png', defaultStake: 100 },
]

/**
 * Генерирует реалистичный пул игроков для раунда на основе сида roundId,
 * отсортированный от большего к меньшему по ставке (от большого к маленькому),
 * с NFT подарками, строго соответствующими стоимости ставки и выигрыша.
 */
export function generateRoundPlayers(roundId: number): SimulatedPlayer[] {
  // Детерминированный псевдо-ГСЧ от roundId для согласованности тиков
  let seed = (roundId * 9301 + 49297) % 233280
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  // Выбираем 7-10 активных игроков на раунд
  const count = 7 + Math.floor(rnd() * 4)
  const shuffled = [...PLAYER_PROFILES].sort(() => rnd() - 0.5).slice(0, count)

  const players: SimulatedPlayer[] = shuffled.map((profile, idx) => {
    // Распределение целевого множителя кешаута
    const r = rnd()
    let target = 1.15 + rnd() * 0.75 // 1.15x - 1.9x (ранний вывод)
    if (r > 0.45 && r <= 0.8) {
      target = 2.0 + rnd() * 2.5 // 2.0x - 4.5x (средний)
    } else if (r > 0.8) {
      target = 4.5 + rnd() * 8.0 // 4.5x - 12.5x (высокий/рисковый)
    }
    target = Math.floor(target * 100) / 100

    // NFT подарок, строго соответствующий сумме ставки по стоимости
    const stakeGift = getGiftForValue(profile.defaultStake)

    // При кешауте — NFT подарок, соответствующий итоговой стоимости выигрыша
    const profitMinor = Math.round(profile.defaultStake * target)
    const wonGift = getGiftForValue(profitMinor)

    return {
      id: `player-${roundId}-${idx}`,
      name: profile.name,
      avatar: profile.avatar,
      stakeMinor: profile.defaultStake,
      stakeGiftId: stakeGift.id,
      targetMultiplier: target,
      cashedOut: false,
      wonGiftId: wonGift.id,
    }
  })

  // Сортировка ставок от большого к маленькому (descending)
  return players.sort((a, b) => b.stakeMinor - a.stakeMinor)
}
