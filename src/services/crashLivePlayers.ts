import { gifts, type Gift } from '../data/catalog'

export interface SimulatedPlayer {
  id: string
  name: string
  avatar: string
  /** Ставка в minor. Для ставки NFT равна каталожной цене NFT (1 TON = 1000 minor). */
  stakeMinor: number
  /** Только если игрок поставил NFT; ставка TON — без подарка. */
  stakeGiftId?: string
  targetMultiplier: number
  cashedOut: boolean
}

const AVATAR_COUNT = 48

const NAME_POOL = [
  'cryptowhale', 'Module_II', 'kamronbek', 'abdoo', 'V5B', 'DIYORBEK', 'abood_vip', 'Saullmurder',
  'Pavel_D', 'Shazy', 'Al_Sheikh', 'Artem_TON', 'EGO_TRADER', 'ton_hunter', 'NightOwl', 'Max_Drop',
  'luckyfox', 'Rustam77', 'sky_walker', 'DimaGift', 'tonmaster', 'BekzodTG', 'alina_ton', 'Vlad_X',
  'gifter_pro', 'KoLyA', 'moon_rider', 'Sasha_NFT', 'pepe_king', 'Timur_94', 'crash_lord', 'Egor_TON',
  'Nodir', 'rocketman', 'Anya_Drop', 'Ilya_007', 'whale_Ton', 'Jasur', 'lowkey', 'Misha_G',
  'diamond_hand', 'Kirill', 'ton_enjoyer', 'Sardor_7', 'Zhenya', 'sniper_X', 'Oleg_NFT', 'Farhod',
  'cosmo', 'Lena_TON', 'Ruslan_Q', 'blackjack', 'Igor_Drop', 'Aziz_TON', 'Nikita_P', 'goldfish',
  'Bahrom', 'Vanya', 'tg_whale', 'Anvar_X',
]

/** Допустимые ставки TON (не более одного знака после точки). */
const TON_STAKES = [0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.5, 2, 3, 5, 8, 10, 15, 20, 30]

/** NFT-виды (PNG с реальным фоном и ценой из каталога), доступные ботам для ставки. */
const NFT_POOL: readonly Gift[] = gifts
  .filter((g) => /-\d$/.test(g.id) && g.image.endsWith('.png') && g.priceMinor <= 300_000)
  .sort((a, b) => a.priceMinor - b.priceMinor)

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, rnd: () => number): T {
  const weights = items.map(weight)
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rnd() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!
    if (r <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

/**
 * Пул игроков раунда. Ники и аватарки меняются от раунда к раунду: часть слотов
 * держится 4 раунда (знакомые лица), остальные — новые каждый раунд.
 * Ставка — либо TON (0.1–30), либо NFT, и тогда сумма равна реальной цене NFT.
 */
export function generateRoundPlayers(roundId: number): SimulatedPlayer[] {
  const rnd = mulberry32(roundId * 7919 + 13)
  const sticky = mulberry32(Math.floor(roundId / 4) * 104729 + 7)

  const count = 7 + Math.floor(rnd() * 4)
  const usedNames = new Set<string>()
  const usedAvatars = new Set<number>()
  const players: SimulatedPlayer[] = []

  for (let idx = 0; idx < count; idx++) {
    const src = idx < Math.ceil(count * 0.6) ? sticky : rnd
    let name = NAME_POOL[Math.floor(src() * NAME_POOL.length)]!
    while (usedNames.has(name)) name = NAME_POOL[Math.floor(rnd() * NAME_POOL.length)]!
    usedNames.add(name)
    let av = Math.floor(src() * AVATAR_COUNT) + 1
    while (usedAvatars.has(av)) av = Math.floor(rnd() * AVATAR_COUNT) + 1
    usedAvatars.add(av)

    let stakeMinor: number
    let stakeGiftId: string | undefined
    if (rnd() < 0.45 && NFT_POOL.length > 0) {
      const gift = pickWeighted(NFT_POOL, (g) => 1 / Math.pow(g.priceMinor / 1000, 0.8), rnd)
      stakeGiftId = gift.id
      stakeMinor = gift.priceMinor
    } else {
      const ton = pickWeighted(TON_STAKES, (v) => 1 / Math.pow(v, 0.6), rnd)
      stakeMinor = Math.round(ton * 1000)
    }

    const r = rnd()
    let target = 1.15 + rnd() * 0.75
    if (r > 0.45 && r <= 0.8) target = 2.0 + rnd() * 2.5
    else if (r > 0.8) target = 4.5 + rnd() * 8.0
    target = Math.floor(target * 100) / 100

    players.push({
      id: `player-${roundId}-${idx}`,
      name,
      avatar: `/avatars/bot_${String(av).padStart(2, '0')}.svg`,
      stakeMinor,
      stakeGiftId,
      targetMultiplier: target,
      cashedOut: false,
    })
  }

  return players.sort((a, b) => b.stakeMinor - a.stakeMinor)
}
