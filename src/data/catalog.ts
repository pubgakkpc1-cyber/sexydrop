import type { Minor } from '../lib/money'

import { caseWeights } from './caseWeights.generated'



export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'



export interface Gift {

  id: string

  name: string

  image: string

  priceMinor: Minor

  rarity: Rarity

  /** Источник цены: конфигурация продукта или явно помеченный demo-объект. */

  priceSource: 'catalog-config' | 'demo'

  /** Время последнего обновления цены (ISO). */

  priceUpdatedAt: string

  /** Метаданные коллекции. */

  collection: string

  /** Номер экземпляра — только если реально известен. Для demo всегда null. */

  serialNumber: number | null

  available: boolean

  /** Актуальная рыночная котировка на Fragment / Getgems (в TON). */

  fragmentFloorTon?: number

}



export interface CaseEntry {

  itemId: string

  weight: number

}



export interface CaseDefinition {

  id: string

  name: string

  image: string

  /** Фиксированная цена из конфигурации продукта. Для бесплатных кейсов 0. */

  priceMinor: Minor

  /** Бесплатный кейс: длительность кулдауна; для платных — null. */

  freeCooldownMs: number | null

  /** Бейдж NEW на карточке (конфигурация продукта). */

  isNew: boolean

  /** Акцент свечения плитки на главной (оформление, конфиг продукта). */

  glow: string

  entries: readonly CaseEntry[]

}



export const RARITY_LABELS: Record<Rarity, string> = {

  common: 'Обычный',

  rare: 'Редкий',

  epic: 'Эпический',

  legendary: 'Легендарный',

}



const PRICE_UPDATED_AT = '2026-10-26T00:00:00Z'



function gift(

  id: string,

  name: string,

  priceMinor: Minor,

  rarity: Rarity,

  collection: string,

  source: Gift['priceSource'],

  fragmentFloorTon?: number,

): Gift {

  return {

    id,

    name,

    image: `/gifts/${id}.svg`,

    priceMinor,

    rarity,

    priceSource: source,

    priceUpdatedAt: PRICE_UPDATED_AT,

    collection,

    serialNumber: null,

    available: true,

    fragmentFloorTon,

  }

}



/**

 * Каталог подарков. Двенадцать позиций из спецификации (раздел 8); позиции с

 * priceSource 'demo' — явно обозначенные демонстрационные объекты, добавленные

 * для покрытия диапазона цен кейсов. Номера экземпляров неизвестны — null.

 */

export const gifts: readonly Gift[] = [

  gift('fresh-socks', 'Fresh Socks', 50, 'common', 'Starter Basics', 'catalog-config', 3.5),

  gift('scared-cat', 'Scared Cat', 150, 'common', 'Starter Basics', 'catalog-config', 15.0),

  gift('instant-ramen', 'Instant Ramen', 200, 'common', 'Street Food', 'catalog-config', 2.5),

  gift('chill-flame', 'Chill Flame', 300, 'common', 'Elements', 'catalog-config', 4.0),

  gift('xmas-stocking', 'Xmas Stocking', 500, 'common', 'Winter Collection', 'catalog-config', 6.0),

  gift('holiday-gift', 'Holiday Gift', 600, 'common', 'Winter Collection', 'demo', 10.0),

  gift('heart-locket', 'Heart Locket', 1000, 'rare', 'Jewelry', 'catalog-config', 1380.0),

  gift('magic-potion', 'Magic Potion', 1500, 'rare', 'Arcane Items', 'demo', 18.0),

  gift('resistance-dog', 'Resistance Dog', 2000, 'rare', 'Heroes', 'catalog-config', 595.0),

  gift('cyber-helmet', 'Cyber Helmet', 3500, 'rare', 'Cyberpunk', 'catalog-config', 55.0),

  gift('astral-shard', 'Astral Shard', 5000, 'epic', 'Astral Series', 'catalog-config', 110.0),

  gift('durovs-cap', "Durov's Cap", 8000, 'epic', 'Icons', 'catalog-config', 430.0),

  gift('diamond-ring', 'Diamond Ring', 12000, 'epic', 'Jewelry', 'catalog-config', 35.0),

  gift('neon-dream', 'Neon Dream', 18000, 'legendary', 'Neon Series', 'demo', 120.0),

  gift('plush-pepe', 'Plush Pepe', 25000, 'legendary', 'Memes', 'catalog-config', 4500.0),

  gift('crystal-ball', 'Crystal Ball', 40000, 'legendary', 'Arcane Items', 'demo', 250.0),

  gift('golden-trophy', 'Golden Trophy', 60000, 'legendary', 'Champions', 'demo', 1200.0),

  gift('astral-crown', 'Astral Crown', 100000, 'legendary', 'Astral Series', 'demo', 3500.0),

  gift('golden-pepe', 'Golden Plush Pepe', 200000, 'legendary', 'Memes', 'demo', 15000.0),

]



export const giftById: ReadonlyMap<string, Gift> = new Map(

  gifts.map((item) => [item.id, item] as const),

)



/** Кулдауны бесплатных кейсов (конфигурация продукта; серверная проверка — TIER 7). */

export const FREE_COOLDOWNS = {

  free: 60 * 60 * 1000, // 1 час

  free24: 24 * 60 * 60 * 1000, // 24 часа

} as const



export type FreeCaseId = keyof typeof FREE_COOLDOWNS



function caseDefinition(

  id: string,

  name: string,

  priceMinor: Minor,

  isNew: boolean,

  freeCooldownMs: number | null,

  glow: string,

): CaseDefinition {

  const weights = caseWeights[id]

  if (!weights || weights.length === 0) {

    throw new Error(`No solver weights for case: ${id}`)

  }

  const entries: CaseEntry[] = weights.map(([itemId, weight]) => ({ itemId, weight }))

  return {

    id,

    name,

    image: `/cases/${id}.svg`,

    priceMinor,

    freeCooldownMs,

    isNew,

    glow,

    entries,

  }

}



/** Цены кейсов — начальная конфигурация продукта (раздел 7.4), не котировки. 1 GRAM = 1000 minor. */

const CASE_CONFIG: readonly {

  id: string

  name: string

  priceMinor: Minor

  isNew?: boolean

  /** Цвет свечения плитки (оформление из референса). */

  glow: string

}[] = [

  { id: 'farm', name: 'Farm', priceMinor: 100, glow: '#46d97b' },

  { id: 'autumn', name: 'Autumn', priceMinor: 3500, isNew: true, glow: '#ff9f2e' },

  { id: 'movie', name: 'Movie', priceMinor: 4000, glow: '#ff5d5d' },

  { id: 'telegram', name: 'Telegram', priceMinor: 5000, glow: '#3ba7ff' },

  { id: 'space', name: 'Space', priceMinor: 6000, glow: '#8b5cf6' },

  { id: 'magic', name: 'Magic', priceMinor: 5000, glow: '#a855f7' },

  { id: 'kitty', name: 'Kitty', priceMinor: 5000, glow: '#ff7ad9' },

  { id: 'adult18', name: '18+', priceMinor: 7000, glow: '#ff4d6d' },

  { id: 'money', name: 'Money', priceMinor: 8000, glow: '#2fbf6a' },

  { id: 'onyx-black', name: 'Onyx Black', priceMinor: 8000, glow: '#7c5cff' },

  { id: 'snoop', name: 'Snoop', priceMinor: 7770, glow: '#ffc93c' },

  { id: 'peach', name: 'Peach', priceMinor: 8000, glow: '#ffb07a' },

  { id: 'gem', name: 'Gem', priceMinor: 8000, glow: '#38e1ff' },

  { id: 'pepe', name: 'Pepe', priceMinor: 15000, glow: '#6ee36e' },

  { id: 'cap', name: 'Cap', priceMinor: 15000, glow: '#a3d94c' },

  { id: 'ring', name: 'Ring', priceMinor: 15000, glow: '#ffc93c' },

  { id: 'black', name: 'Black', priceMinor: 20000, glow: '#6d28d9' },

  { id: 'epic', name: 'Epic', priceMinor: 40000, glow: '#8b5cf6' },

  { id: 'vip', name: 'VIP', priceMinor: 50000, isNew: true, glow: '#ffc93c' },

  { id: 'elite', name: 'Elite', priceMinor: 125000, isNew: true, glow: '#ff9d0b' },

]



export const cases: readonly CaseDefinition[] = [

  ...CASE_CONFIG.map((config) =>

    caseDefinition(config.id, config.name, config.priceMinor, config.isNew ?? false, null, config.glow),

  ),

  caseDefinition('free', 'FREE', 0, false, FREE_COOLDOWNS.free, '#b7a4f9'),

  caseDefinition('free24', 'FREE 24', 0, false, FREE_COOLDOWNS.free24, '#ffc93c'),

]



export const paidCases: readonly CaseDefinition[] = cases.filter((c) => c.freeCooldownMs === null)



export const freeCases: readonly CaseDefinition[] = cases.filter((c) => c.freeCooldownMs !== null)



export const caseById: ReadonlyMap<string, CaseDefinition> = new Map(

  cases.map((item) => [item.id, item] as const),

)


/**
 * Находит NFT подарок из каталога, наиболее близкий по стоимости к указанной сумме Minor.
 */
export function getGiftForValue(minor: number): Gift {
  const first = gifts[0]
  if (!first) {
    throw new Error('Catalog gifts empty')
  }
  let best: Gift = first
  let minDiff = Math.abs(best.priceMinor - minor)
  for (const g of gifts) {
    const diff = Math.abs(g.priceMinor - minor)
    if (diff < minDiff) {
      minDiff = diff
      best = g
    }
  }
  return best
}
