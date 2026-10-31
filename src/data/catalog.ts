import type { Minor } from '../lib/money'
import { caseWeights } from './caseWeights.generated'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Gift {
  id: string
  name: string
  image: string
  priceMinor: Minor
  rarity: Rarity
  priceSource: 'catalog-config' | 'demo'
  priceUpdatedAt: string
  collection: string
  serialNumber: number | null
  available: boolean
  fragmentFloorTon?: number
  model?: string
  backdrop?: string
  symbol?: string
}

export interface CaseEntry {
  itemId: string
  weight: number
}

export interface CaseDefinition {
  id: string
  name: string
  image: string
  priceMinor: Minor
  freeCooldownMs: number | null
  isNew: boolean
  glow: string
  entries: readonly CaseEntry[]
}

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
}

const PRICE_UPDATED_AT = '2026-10-30T00:00:00Z'

export function nftGift(
  id: string,
  name: string,
  priceMinor: Minor,
  rarity: Rarity,
  collection: string,
  image: string,
  fragmentFloorTon: number,
  model?: string,
  backdrop?: string,
  symbol?: string,
  serialNumber?: number | null,
): Gift {
  return {
    id,
    name,
    image,
    priceMinor,
    rarity,
    priceSource: 'catalog-config',
    priceUpdatedAt: PRICE_UPDATED_AT,
    collection,
    serialNumber: serialNumber ?? null,
    available: true,
    fragmentFloorTon,
    model,
    backdrop,
    symbol,
  }
}

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

/** Приз в TON из кейса: сразу зачисляется на баланс (в инвентарь не попадает). */
export function isTonPrize(giftOrId: Gift | string): boolean {
  const id = typeof giftOrId === 'string' ? giftOrId : giftOrId.id
  return id.startsWith('ton_')
}

function tonPrize(minor: Minor): Gift {
  const ton = minor / 1000
  return {
    id: `ton_${minor}`,
    name: `${ton} TON`,
    // единый значок TON (синий камень с белой искрой) — без подписей на картинке
    image: '/gifts/ton_gem.png',
    priceMinor: minor,
    rarity: minor >= 25000 ? 'legendary' : minor >= 5000 ? 'epic' : minor >= 2000 ? 'rare' : 'common',
    priceSource: 'catalog-config',
    priceUpdatedAt: PRICE_UPDATED_AT,
    collection: 'TON',
    serialNumber: null,
    available: true,
  }
}

/** Обычный (не NFT) подарок Telegram: прозрачный стикер, цена по курсу Stars (175 Stars = 1 TON). */
function regularGift(id: string, name: string, priceMinor: Minor, file: string): Gift {
  return {
    id,
    name,
    image: `/gifts/png/${file}.png`,
    priceMinor,
    rarity: priceMinor >= 500 ? 'rare' : 'common',
    priceSource: 'catalog-config',
    priceUpdatedAt: PRICE_UPDATED_AT,
    collection: 'Classic Gifts',
    serialNumber: null,
    available: true,
  }
}

/**
 * Каталог подарков:
 * 1. 19 базовых подарков спецификации для строгой совместимости математики и кейсов.
 * 2. 147 подлинных Telegram NFT подарков (49 подарков x 3 уникальных вида по Backdrop/Model).
 */
export const gifts: readonly Gift[] = [
  /* --- БАЗОВЫЕ ПОДАРКИ СПЕЦИФИКАЦИИ --- */
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

  /* --- ОБЫЧНЫЕ ПОДАРКИ TELEGRAM (не NFT) --- */
  regularGift('reg-heart', 'Heart', 85, 'pink_heart_box'),
  regularGift('reg-bear', 'Bear', 85, 'teddy_bear'),
  regularGift('reg-gift', 'Gift', 142, 'yellow_gift_box'),
  regularGift('reg-rose', 'Rose', 142, 'red_rose'),
  regularGift('reg-cake', 'Cake', 285, 'birthday_cake_white'),
  regularGift('reg-bouquet', 'Bouquet', 285, 'flower_bouquet'),
  regularGift('reg-rocket', 'Rocket', 285, 'space_rocket'),
  regularGift('reg-champagne', 'Champagne', 285, 'champagne_bottle'),
  regularGift('reg-trophy', 'Trophy', 571, 'golden_trophy'),
  regularGift('reg-ring', 'Ring', 571, 'solitaire_diamond_ring'),
  regularGift('reg-diamond', 'Diamond', 571, 'blue_diamond_gem'),

  /* --- ПРИЗЫ В TON --- */
  tonPrize(2),
  tonPrize(5),
  tonPrize(10),
  tonPrize(50),
  tonPrize(500),
  tonPrize(1000),
  tonPrize(2000),
  tonPrize(5000),
  tonPrize(10000),
  tonPrize(25000),
  tonPrize(50000),
  tonPrize(100000),
  tonPrize(250000),

  /* --- 147 ПОДЛИННЫХ TELEGRAM NFT С FRAGMENT (6 уникальных видов на каждый из 49 подарков) --- */
  nftGift('plush_pepe-1', 'Plush Pepe', 7070000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_1.png', 7070.0, 'Gummy Frog', 'Platinum', 'Ring', 1821),
  nftGift('plush_pepe-2', 'Plush Pepe', 7070000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_2.png', 7070.0, 'Christmas', 'Black', 'Champagne', 1056),
  nftGift('plush_pepe-3', 'Plush Pepe', 7070000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_3.png', 7070.0, 'Cozy Galaxy', 'Electric Purple', 'Doberman', 1515),
  nftGift('plush_pepe-4', 'Plush Pepe', 7070000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_4.png', 7070.0, 'Stripes', 'Jade Green', 'Cunning Fox', 2163),
  nftGift('plush_pepe-5', 'Plush Pepe', 7070000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_5.png', 7070.0, 'Spectrum', 'Cobalt Blue', 'Gold', 955),
  nftGift('plush_pepe-6', 'Plush Pepe', 7070000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_6.png', 7070.0, 'Kung Fu Pepe', 'Neon Blue', 'Oxen of Fire', 203),
  nftGift('heart_locket-1', 'Heart Locket', 1458440, 'legendary', 'Heart Locket', '/gifts/heart_locket_1.png', 1458.44, 'Turtles', 'Lemongrass', 'Like', 875),
  nftGift('heart_locket-2', 'Heart Locket', 1458440, 'legendary', 'Heart Locket', '/gifts/heart_locket_2.png', 1458.44, 'Black Hole', 'Electric Indigo', 'Anchor', 65),
  nftGift('heart_locket-3', 'Heart Locket', 1458440, 'legendary', 'Heart Locket', '/gifts/heart_locket_3.png', 1458.44, 'Spider Web', 'Neon Blue', 'Melon', 1882),
  nftGift('heart_locket-4', 'Heart Locket', 1458440, 'legendary', 'Heart Locket', '/gifts/heart_locket_4.png', 1458.44, 'Heartwood', 'Rifle Green', 'Sunflower', 416),
  nftGift('heart_locket-5', 'Heart Locket', 1458440, 'legendary', 'Heart Locket', '/gifts/heart_locket_5.png', 1458.44, 'Karaoke Bar', 'Rifle Green', 'Spring Chick', 1437),
  nftGift('heart_locket-6', 'Heart Locket', 1458440, 'legendary', 'Heart Locket', '/gifts/heart_locket_6.png', 1458.44, 'Soulkeeper', 'Khaki Green', 'Cow Skull', 1569),
  nftGift('resistance_dog-1', 'Resistance Dog', 656500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_1.png', 656.5, 'Creeper', 'Midnight Blue', 'Paper Lantern', 4156),
  nftGift('resistance_dog-2', 'Resistance Dog', 656500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_2.png', 656.5, 'Proxy Server', 'Steel Grey', 'Lion of Babylon', 11806),
  nftGift('resistance_dog-3', 'Resistance Dog', 656500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_3.png', 656.5, 'Ultras', 'Satin Gold', 'Shinto Shrine', 1440),
  nftGift('resistance_dog-4', 'Resistance Dog', 656500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_4.png', 656.5, 'Airbender', 'Azure Blue', 'White Deer', 9330),
  nftGift('resistance_dog-5', 'Resistance Dog', 656500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_5.png', 656.5, 'Arrakis', 'Steel Grey', 'Alkonost', 7963),
  nftGift('resistance_dog-6', 'Resistance Dog', 656500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_6.png', 656.5, 'Privateer', 'Sky Blue', 'Evil Dragon', 14716),
  nftGift('durovs_cap-1', 'Durov\'s Cap', 474700, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_1.png', 474.7, 'Duskwave', 'Black', 'Eagle', 1142),
  nftGift('durovs_cap-2', 'Durov\'s Cap', 474700, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_2.png', 474.7, 'Asterix', 'Electric Indigo', 'Apple', 1896),
  nftGift('durovs_cap-3', 'Durov\'s Cap', 474700, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_3.png', 474.7, 'Artwork', 'Electric Indigo', 'Cursor', 302),
  nftGift('durovs_cap-4', 'Durov\'s Cap', 474700, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_4.png', 474.7, 'Duskwave', 'Satin Gold', 'Birthday Cake', 1090),
  nftGift('durovs_cap-5', 'Durov\'s Cap', 474700, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_5.png', 474.7, 'Jade', 'Persimmon', 'Octopus', 3226),
  nftGift('durovs_cap-6', 'Durov\'s Cap', 474700, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_6.png', 474.7, 'Duskwave', 'Caramel', 'Golden Scarab', 4114),
  nftGift('scared_cat-1', 'Scared Cat', 301990, 'legendary', 'Scared Cat', '/gifts/scared_cat_1.png', 301.99, 'Obelisk', 'Onyx Black', 'Voodoo Doll', 2920),
  nftGift('scared_cat-2', 'Scared Cat', 301990, 'legendary', 'Scared Cat', '/gifts/scared_cat_2.png', 301.99, 'Cat Nukem', 'Onyx Black', 'Scarecrow', 17302),
  nftGift('scared_cat-3', 'Scared Cat', 301990, 'legendary', 'Scared Cat', '/gifts/scared_cat_3.png', 301.99, 'Celestia', 'Sapphire', 'Moon', 1813),
  nftGift('scared_cat-4', 'Scared Cat', 301990, 'legendary', 'Scared Cat', '/gifts/scared_cat_4.png', 301.99, 'El Tigre', 'Moonstone', 'Moon Eagle', 13897),
  nftGift('scared_cat-5', 'Scared Cat', 301990, 'legendary', 'Scared Cat', '/gifts/scared_cat_5.png', 301.99, 'Cathulhu', 'Caramel', 'Potion', 14322),
  nftGift('scared_cat-6', 'Scared Cat', 301990, 'legendary', 'Scared Cat', '/gifts/scared_cat_6.png', 301.99, 'Virus', 'Jade Green', 'Coffin', 2996),
  nftGift('precious_peach-1', 'Precious Peach', 297950, 'legendary', 'Precious Peach', '/gifts/precious_peach_1.png', 297.95, 'Spoiled', 'Black', 'Gold', 595),
  nftGift('precious_peach-2', 'Precious Peach', 297950, 'legendary', 'Precious Peach', '/gifts/precious_peach_2.png', 297.95, 'Cutout', 'Black', 'Stilettos', 2161),
  nftGift('precious_peach-3', 'Precious Peach', 297950, 'legendary', 'Precious Peach', '/gifts/precious_peach_3.png', 297.95, 'Twilight', 'Cyberpunk', 'Kitty Cat', 246),
  nftGift('precious_peach-4', 'Precious Peach', 297950, 'legendary', 'Precious Peach', '/gifts/precious_peach_4.png', 297.95, 'Cozy Warmth', 'Lemongrass', 'Cactus', 1685),
  nftGift('precious_peach-5', 'Precious Peach', 297950, 'legendary', 'Precious Peach', '/gifts/precious_peach_5.png', 297.95, 'Ogre Green', 'Neon Blue', 'Totem Bear', 1631),
  nftGift('precious_peach-6', 'Precious Peach', 297950, 'legendary', 'Precious Peach', '/gifts/precious_peach_6.png', 297.95, 'Jelly Bubble', 'Sapphire', 'Moon Cross', 1564),
  nftGift('heroic_helmet-1', 'Heroic Helmet', 200990, 'legendary', 'Heroic Helmet', '/gifts/heroic_helmet_1.png', 200.99, 'Mercurial', 'Onyx Black', 'Imperial Lion', 680),
  nftGift('heroic_helmet-2', 'Heroic Helmet', 200990, 'legendary', 'Heroic Helmet', '/gifts/heroic_helmet_2.png', 200.99, 'Mercurial', 'Battleship Grey', 'Double Axe', 1372),
  nftGift('heroic_helmet-3', 'Heroic Helmet', 200990, 'legendary', 'Heroic Helmet', '/gifts/heroic_helmet_3.png', 200.99, 'Ancient Gold', 'Black', 'Paw Print', 748),
  nftGift('heroic_helmet-4', 'Heroic Helmet', 200990, 'legendary', 'Heroic Helmet', '/gifts/heroic_helmet_4.png', 200.99, 'Ladybug', 'Camo Green', 'Fireman Hat', 1369),
  nftGift('heroic_helmet-5', 'Heroic Helmet', 200990, 'legendary', 'Heroic Helmet', '/gifts/heroic_helmet_5.png', 200.99, 'Aegean Sea', 'Hunter Green', 'Star', 1764),
  nftGift('heroic_helmet-6', 'Heroic Helmet', 200990, 'legendary', 'Heroic Helmet', '/gifts/heroic_helmet_6.png', 200.99, 'Skeleton', 'Mustard', 'Sumerian Bird', 1863),
  nftGift('loot_bag-1', 'Loot Bag', 151500, 'epic', 'Loot Bag', '/gifts/loot_bag_1.png', 151.5, 'Money Bag', 'Onyx Black', 'Heater Shield', 11217),
  nftGift('loot_bag-2', 'Loot Bag', 151500, 'epic', 'Loot Bag', '/gifts/loot_bag_2.png', 151.5, 'Scrooge', 'Black', 'Takoyaki', 7631),
  nftGift('loot_bag-3', 'Loot Bag', 151500, 'epic', 'Loot Bag', '/gifts/loot_bag_3.png', 151.5, 'Liberty', 'Platinum', 'Calm Wolf', 5888),
  nftGift('loot_bag-4', 'Loot Bag', 151500, 'epic', 'Loot Bag', '/gifts/loot_bag_4.png', 151.5, 'Cargo Citron', 'Indigo Dye', 'Sun Lion', 12736),
  nftGift('loot_bag-5', 'Loot Bag', 151500, 'epic', 'Loot Bag', '/gifts/loot_bag_5.png', 151.5, 'Sunrise Bands', 'Midnight Blue', 'Watermelon', 4311),
  nftGift('loot_bag-6', 'Loot Bag', 151500, 'epic', 'Loot Bag', '/gifts/loot_bag_6.png', 151.5, 'Jade Serpent', 'Emerald', 'Trickster Fox', 4693),
  nftGift('mighty_arm-1', 'Mighty Arm', 151500, 'epic', 'Mighty Arm', '/gifts/mighty_arm_1.png', 151.5, 'Colossus', 'Rifle Green', 'Fenrir', 3109),
  nftGift('mighty_arm-2', 'Mighty Arm', 151500, 'epic', 'Mighty Arm', '/gifts/mighty_arm_2.png', 151.5, 'Xeno Grip', 'Black', 'Coin Purse', 2289),
  nftGift('mighty_arm-3', 'Mighty Arm', 151500, 'epic', 'Mighty Arm', '/gifts/mighty_arm_3.png', 151.5, 'Gladiator', 'Amber', 'Greek Helmet', 2444),
  nftGift('mighty_arm-4', 'Mighty Arm', 151500, 'epic', 'Mighty Arm', '/gifts/mighty_arm_4.png', 151.5, 'Petrified', 'Mint Green', 'La Corona', 2172),
  nftGift('mighty_arm-5', 'Mighty Arm', 151500, 'epic', 'Mighty Arm', '/gifts/mighty_arm_5.png', 151.5, 'Poor Yorick', 'Cobalt Blue', 'War Tiger', 355),
  nftGift('mighty_arm-6', 'Mighty Arm', 151500, 'epic', 'Mighty Arm', '/gifts/mighty_arm_6.png', 151.5, 'Robocop', 'Pure Gold', 'Wepwawet', 365),
  nftGift('astral_shard-1', 'Astral Shard', 148470, 'epic', 'Astral Shard', '/gifts/astral_shard_1.png', 148.47, 'Barbed', 'Black', 'Mountain Lion', 5129),
  nftGift('astral_shard-2', 'Astral Shard', 148470, 'epic', 'Astral Shard', '/gifts/astral_shard_2.png', 148.47, 'Ethereal', 'Desert Sand', 'Celtic Wolf', 521),
  nftGift('astral_shard-3', 'Astral Shard', 148470, 'epic', 'Astral Shard', '/gifts/astral_shard_3.png', 148.47, 'Crystal Punk', 'Pacific Cyan', 'Anchor', 2028),
  nftGift('astral_shard-4', 'Astral Shard', 148470, 'epic', 'Astral Shard', '/gifts/astral_shard_4.png', 148.47, 'Uranium', 'Mystic Pearl', 'Gold', 4808),
  nftGift('astral_shard-5', 'Astral Shard', 148470, 'epic', 'Astral Shard', '/gifts/astral_shard_5.png', 148.47, 'Arctite', 'Amber', 'Money Bag', 3935),
  nftGift('astral_shard-6', 'Astral Shard', 148470, 'epic', 'Astral Shard', '/gifts/astral_shard_6.png', 148.47, 'Crystal Punk', 'Shamrock Green', 'Shark Knife', 1577),
  nftGift('westside_sign-1', 'Westside Sign', 129280, 'epic', 'Westside Sign', '/gifts/westside_sign_1.png', 129.28, 'Gold Ruby', 'Satin Gold', 'Mushroom', 2005),
  nftGift('westside_sign-2', 'Westside Sign', 129280, 'epic', 'Westside Sign', '/gifts/westside_sign_2.png', 129.28, 'Woofee', 'Tomato', 'Kitsune Mask', 169),
  nftGift('westside_sign-3', 'Westside Sign', 129280, 'epic', 'Westside Sign', '/gifts/westside_sign_3.png', 129.28, 'Gold Ruby', 'Pure Gold', 'Snoop Leaf', 650),
  nftGift('westside_sign-4', 'Westside Sign', 129280, 'epic', 'Westside Sign', '/gifts/westside_sign_4.png', 129.28, 'Green Slime', 'Orange', 'Mayan Moth', 4703),
  nftGift('westside_sign-5', 'Westside Sign', 129280, 'epic', 'Westside Sign', '/gifts/westside_sign_5.png', 129.28, 'Bow Wizzle', 'Midnight Blue', 'Flipper', 8223),
  nftGift('westside_sign-6', 'Westside Sign', 129280, 'epic', 'Westside Sign', '/gifts/westside_sign_6.png', 129.28, 'Sapphire', 'Turquoise', 'Crown', 8568),
  nftGift('mini_oscar-1', 'Mini Oscar', 80800, 'epic', 'Mini Oscar', '/gifts/mini_oscar_1.png', 80.8, 'Seraphim', 'Purple', 'Alarm', 138),
  nftGift('mini_oscar-2', 'Mini Oscar', 80800, 'epic', 'Mini Oscar', '/gifts/mini_oscar_2.png', 80.8, 'Pink Guard', 'Grape', 'Trickster Fox', 2890),
  nftGift('mini_oscar-3', 'Mini Oscar', 80800, 'epic', 'Mini Oscar', '/gifts/mini_oscar_3.png', 80.8, 'Dark Side', 'Platinum', 'Jörmungandr', 3333),
  nftGift('mini_oscar-4', 'Mini Oscar', 80800, 'epic', 'Mini Oscar', '/gifts/mini_oscar_4.png', 80.8, 'Jokester', 'Neon Blue', 'Unicorn', 1203),
  nftGift('mini_oscar-5', 'Mini Oscar', 80800, 'epic', 'Mini Oscar', '/gifts/mini_oscar_5.png', 80.8, 'Astronaut', 'French Blue', 'Viking Shield', 4791),
  nftGift('mini_oscar-6', 'Mini Oscar', 80800, 'epic', 'Mini Oscar', '/gifts/mini_oscar_6.png', 80.8, 'Caveman', 'Pistachio', 'Bubbles', 4000),
  nftGift('ion_gem-1', 'Ion Gem', 85850, 'epic', 'Ion Gem', '/gifts/ion_gem_1.png', 85.85, 'Barbie', 'Black', 'Love Letter', 555),
  nftGift('ion_gem-2', 'Ion Gem', 85850, 'epic', 'Ion Gem', '/gifts/ion_gem_2.png', 85.85, 'Ice Crystal', 'Black', 'Mustang', 3847),
  nftGift('ion_gem-3', 'Ion Gem', 85850, 'epic', 'Ion Gem', '/gifts/ion_gem_3.png', 85.85, 'Tiberium', 'Black', 'Shinto Shrine', 2689),
  nftGift('ion_gem-4', 'Ion Gem', 85850, 'epic', 'Ion Gem', '/gifts/ion_gem_4.png', 85.85, 'Bronzite', 'Grape', 'Anchor', 2889),
  nftGift('ion_gem-5', 'Ion Gem', 85850, 'epic', 'Ion Gem', '/gifts/ion_gem_5.png', 85.85, 'Garnet', 'Navy Blue', 'Ancient Urn', 157),
  nftGift('ion_gem-6', 'Ion Gem', 85850, 'epic', 'Ion Gem', '/gifts/ion_gem_6.png', 85.85, 'Live Wire', 'Cyberpunk', 'Genie Lamp', 1759),
  nftGift('low_rider-1', 'Low Rider', 70700, 'epic', 'Low Rider', '/gifts/low_rider_1.png', 70.7, 'Soul Plane', 'Lavender', 'Gem', 16908),
  nftGift('low_rider-2', 'Low Rider', 70700, 'epic', 'Low Rider', '/gifts/low_rider_2.png', 70.7, 'Gold Rush', 'Burgundy', 'Pumpkin Coach', 16593),
  nftGift('low_rider-3', 'Low Rider', 70700, 'epic', 'Low Rider', '/gifts/low_rider_3.png', 70.7, 'First Class', 'Neon Blue', 'Watermelon', 2011),
  nftGift('low_rider-4', 'Low Rider', 70700, 'epic', 'Low Rider', '/gifts/low_rider_4.png', 70.7, 'Toy Car', 'Grape', 'Panty', 15387),
  nftGift('low_rider-5', 'Low Rider', 70700, 'epic', 'Low Rider', '/gifts/low_rider_5.png', 70.7, 'Lovemobile', 'Old Gold', 'Coffee Bean', 10394),
  nftGift('low_rider-6', 'Low Rider', 70700, 'epic', 'Low Rider', '/gifts/low_rider_6.png', 70.7, 'Grasshopper', 'Emerald', 'Bunny', 15043),
  nftGift('magic_potion-1', 'Magic Potion', 75750, 'epic', 'Magic Potion', '/gifts/magic_potion_1.png', 75.75, 'Mummify', 'Sky Blue', 'Spooky Cat', 2),
  nftGift('magic_potion-2', 'Magic Potion', 75750, 'epic', 'Magic Potion', '/gifts/magic_potion_2.png', 75.75, 'Supernova', 'Onyx Black', 'Lollipop', 522),
  nftGift('magic_potion-3', 'Magic Potion', 75750, 'epic', 'Magic Potion', '/gifts/magic_potion_3.png', 75.75, 'Agent Orange', 'Black', 'Half Moon', 3396),
  nftGift('magic_potion-4', 'Magic Potion', 75750, 'epic', 'Magic Potion', '/gifts/magic_potion_4.png', 75.75, 'Dimensional', 'Pacific Green', 'Grim Reaper', 4607),
  nftGift('magic_potion-5', 'Magic Potion', 75750, 'epic', 'Magic Potion', '/gifts/magic_potion_5.png', 75.75, 'Pink Poultice', 'Persimmon', 'Okami Wolf', 3526),
  nftGift('magic_potion-6', 'Magic Potion', 75750, 'epic', 'Magic Potion', '/gifts/magic_potion_6.png', 75.75, 'Pink Poultice', 'English Violet', 'Polar Bear', 334),
  nftGift('swiss_watch-1', 'Swiss Watch', 65650, 'epic', 'Swiss Watch', '/gifts/swiss_watch_1.png', 65.65, 'Day Trader', 'Steel Grey', 'Sprout', 7799),
  nftGift('swiss_watch-2', 'Swiss Watch', 65650, 'epic', 'Swiss Watch', '/gifts/swiss_watch_2.png', 65.65, 'Blue Daytona', 'Black', 'Champagne', 3773),
  nftGift('swiss_watch-3', 'Swiss Watch', 65650, 'epic', 'Swiss Watch', '/gifts/swiss_watch_3.png', 65.65, 'Rockefeller', 'Black', 'Hand of God', 15777),
  nftGift('swiss_watch-4', 'Swiss Watch', 65650, 'epic', 'Swiss Watch', '/gifts/swiss_watch_4.png', 65.65, 'Gameboy', 'Grape', 'Moon Eagle', 7148),
  nftGift('swiss_watch-5', 'Swiss Watch', 65650, 'epic', 'Swiss Watch', '/gifts/swiss_watch_5.png', 65.65, 'Salvador', 'Chocolate', 'Koala', 14834),
  nftGift('swiss_watch-6', 'Swiss Watch', 65650, 'epic', 'Swiss Watch', '/gifts/swiss_watch_6.png', 65.65, 'Salvador', 'Emerald', 'Mannaz Rune', 16319),
  nftGift('kissed_frog-1', 'Kissed Frog', 62620, 'epic', 'Kissed Frog', '/gifts/kissed_frog_1.png', 62.62, 'Happy Pepe', 'Lavender', 'Gingerbread', 9666),
  nftGift('kissed_frog-2', 'Kissed Frog', 62620, 'epic', 'Kissed Frog', '/gifts/kissed_frog_2.png', 62.62, 'Lucifrog', 'Black', 'Dessert', 6355),
  nftGift('kissed_frog-3', 'Kissed Frog', 62620, 'epic', 'Kissed Frog', '/gifts/kissed_frog_3.png', 62.62, 'Happy Pepe', 'Pacific Cyan', 'Ice Pop', 7718),
  nftGift('kissed_frog-4', 'Kissed Frog', 62620, 'epic', 'Kissed Frog', '/gifts/kissed_frog_4.png', 62.62, 'Banana Pox', 'Grape', 'Flirty Message', 12598),
  nftGift('kissed_frog-5', 'Kissed Frog', 62620, 'epic', 'Kissed Frog', '/gifts/kissed_frog_5.png', 62.62, 'Tide Pod', 'Persimmon', 'Grim Reaper', 6159),
  nftGift('kissed_frog-6', 'Kissed Frog', 62620, 'epic', 'Kissed Frog', '/gifts/kissed_frog_6.png', 62.62, 'Lily Pond', 'Coral Red', 'Ring', 6235),
  nftGift('sharp_tongue-1', 'Sharp Tongue', 55550, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_1.png', 55.55, 'Golden Girl', 'Amber', 'Gamepad', 4346),
  nftGift('sharp_tongue-2', 'Sharp Tongue', 55550, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_2.png', 55.55, 'Lady Night', 'Black', 'Treats', 904),
  nftGift('sharp_tongue-3', 'Sharp Tongue', 55550, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_3.png', 55.55, 'Golden Girl', 'Cyberpunk', 'Cauldron', 2155),
  nftGift('sharp_tongue-4', 'Sharp Tongue', 55550, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_4.png', 55.55, 'Coral Reef', 'Coral Red', 'Crystal Ball', 3076),
  nftGift('sharp_tongue-5', 'Sharp Tongue', 55550, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_5.png', 55.55, 'Avatar', 'Coral Red', 'Skull', 1491),
  nftGift('sharp_tongue-6', 'Sharp Tongue', 55550, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_6.png', 55.55, 'Pink Mamba', 'Pure Gold', 'Rhino Warrior', 5819),
  nftGift('voodoo_doll-1', 'Voodoo Doll', 43430, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_1.png', 43.43, 'Scribble Stab', 'Ivory White', 'Tribal Shield', 5687),
  nftGift('voodoo_doll-2', 'Voodoo Doll', 43430, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_2.png', 43.43, 'Royal Gold', 'Cappuccino', 'Magic Wand', 5888),
  nftGift('voodoo_doll-3', 'Voodoo Doll', 43430, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_3.png', 43.43, 'Clear Water', 'Black', 'Clubs', 19442),
  nftGift('voodoo_doll-4', 'Voodoo Doll', 43430, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_4.png', 43.43, 'Pain Train', 'Rosewood', 'Magic Wand', 23603),
  nftGift('voodoo_doll-5', 'Voodoo Doll', 43430, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_5.png', 43.43, 'Pain Train', 'Cobalt Blue', 'Sumerian Bird', 23026),
  nftGift('voodoo_doll-6', 'Voodoo Doll', 43430, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_6.png', 43.43, 'Pain Train', 'Shamrock Green', 'Gold', 24140),
  nftGift('vintage_cigar-1', 'Vintage Cigar', 46460, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_1.png', 46.46, 'Oil Baron', 'Black', 'Sun Mountain', 15623),
  nftGift('vintage_cigar-2', 'Vintage Cigar', 46460, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_2.png', 46.46, 'Rainbow Road', 'Black', 'Genie Lamp', 4020),
  nftGift('vintage_cigar-3', 'Vintage Cigar', 46460, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_3.png', 46.46, 'Long Draw', 'Black', 'Mountain Lion', 25557),
  nftGift('vintage_cigar-4', 'Vintage Cigar', 46460, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_4.png', 46.46, 'Green Gas', 'Purple', 'Celtic Wolf', 8276),
  nftGift('vintage_cigar-5', 'Vintage Cigar', 46460, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_5.png', 46.46, 'Blue Hue', 'Chocolate', 'Totem Bear', 4347),
  nftGift('vintage_cigar-6', 'Vintage Cigar', 46460, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_6.png', 46.46, 'Stained Glass', 'Burgundy', 'Scorpion', 13892),
  nftGift('signet_ring-1', 'Signet Ring', 38380, 'rare', 'Signet Ring', '/gifts/signet_ring_1.png', 38.38, 'Utya', 'Pure Gold', 'Police Badge', 15921),
  nftGift('signet_ring-2', 'Signet Ring', 38380, 'rare', 'Signet Ring', '/gifts/signet_ring_2.png', 38.38, 'Black Noir', 'Black', 'Okami Wolf', 10272),
  nftGift('signet_ring-3', 'Signet Ring', 38380, 'rare', 'Signet Ring', '/gifts/signet_ring_3.png', 38.38, 'Utya', 'Grape', 'Calm Wolf', 16683),
  nftGift('signet_ring-4', 'Signet Ring', 38380, 'rare', 'Signet Ring', '/gifts/signet_ring_4.png', 38.38, 'White Gold', 'Carrot Juice', 'Cone', 10545),
  nftGift('signet_ring-5', 'Signet Ring', 38380, 'rare', 'Signet Ring', '/gifts/signet_ring_5.png', 38.38, 'Mandarin', 'Aquamarine', 'Calm Wolf', 8657),
  nftGift('signet_ring-6', 'Signet Ring', 38380, 'rare', 'Signet Ring', '/gifts/signet_ring_6.png', 38.38, 'Sapphire', 'Silver Blue', 'Inguz Rune', 1397),
  nftGift('toy_bear-1', 'Toy Bear', 37370, 'rare', 'Toy Bear', '/gifts/toy_bear_1.png', 37.37, 'Angel', 'Black', 'Baby Bottle', 40000),
  nftGift('toy_bear-2', 'Toy Bear', 37370, 'rare', 'Toy Bear', '/gifts/toy_bear_2.png', 37.37, 'Coral Reef', 'Pistachio', 'Candle', 886),
  nftGift('toy_bear-3', 'Toy Bear', 37370, 'rare', 'Toy Bear', '/gifts/toy_bear_3.png', 37.37, 'Ursa Major', 'Fandango', 'Butterfly', 18111),
  nftGift('toy_bear-4', 'Toy Bear', 37370, 'rare', 'Toy Bear', '/gifts/toy_bear_4.png', 37.37, 'Panda Cow', 'Indigo Dye', 'Kitsune', 13427),
  nftGift('toy_bear-5', 'Toy Bear', 37370, 'rare', 'Toy Bear', '/gifts/toy_bear_5.png', 37.37, 'Blue Dandy', 'Hunter Green', 'Garden Pot', 54447),
  nftGift('toy_bear-6', 'Toy Bear', 37370, 'rare', 'Toy Bear', '/gifts/toy_bear_6.png', 37.37, 'Blue Dandy', 'Mint Green', 'Lovestruck', 35767),
  nftGift('khabibs_papakha-1', 'Khabib\'s Papakha', 27270, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_1.png', 27.27, 'Long Curls', 'Black', 'Nordic Wolf', 20735),
  nftGift('khabibs_papakha-2', 'Khabib\'s Papakha', 27270, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_2.png', 27.27, 'Legendary Item', 'Persimmon', 'Dragonfly', 2749),
  nftGift('khabibs_papakha-3', 'Khabib\'s Papakha', 27270, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_3.png', 27.27, 'Papakha Swag', 'Black', 'Phoenix', 6817),
  nftGift('khabibs_papakha-4', 'Khabib\'s Papakha', 27270, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_4.png', 27.27, 'Buffalo', 'Tactical Pine', 'Flashlight', 13538),
  nftGift('khabibs_papakha-5', 'Khabib\'s Papakha', 27270, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_5.png', 27.27, 'Vineyard Crown', 'Light Olive', 'Top Hat', 16493),
  nftGift('khabibs_papakha-6', 'Khabib\'s Papakha', 27270, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_6.png', 27.27, 'Pile Of Hats', 'Gunship Green', 'Pencil', 12936),
  nftGift('mad_pumpkin-1', 'Mad Pumpkin', 21210, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_1.png', 21.21, 'Jigsaw', 'Black', 'Ghost', 4443),
  nftGift('mad_pumpkin-2', 'Mad Pumpkin', 21210, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_2.png', 21.21, 'Red Demon', 'Black', 'Nice Ghost', 12093),
  nftGift('mad_pumpkin-3', 'Mad Pumpkin', 21210, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_3.png', 21.21, 'Squashbuckler', 'Black', 'Flying Witch', 15090),
  nftGift('mad_pumpkin-4', 'Mad Pumpkin', 21210, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_4.png', 21.21, 'The Joker', 'Steel Grey', 'Jaws', 19389),
  nftGift('mad_pumpkin-5', 'Mad Pumpkin', 21210, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_5.png', 21.21, 'Solaris', 'Mint Green', 'Poison Drop', 10057),
  nftGift('mad_pumpkin-6', 'Mad Pumpkin', 21210, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_6.png', 21.21, 'Mandarin', 'Pacific Cyan', 'Autumn Leaves', 4055),
  nftGift('trapped_heart-1', 'Trapped Heart', 18180, 'rare', 'Trapped Heart', '/gifts/trapped_heart_1.png', 18.18, 'Jinx', 'Black', 'Black Widow', 16970),
  nftGift('trapped_heart-2', 'Trapped Heart', 18180, 'rare', 'Trapped Heart', '/gifts/trapped_heart_2.png', 18.18, 'Abyss Heart', 'Black', 'Ghost', 1684),
  nftGift('trapped_heart-3', 'Trapped Heart', 18180, 'rare', 'Trapped Heart', '/gifts/trapped_heart_3.png', 18.18, 'Colorful Beats', 'Black', 'Flying Witch', 4589),
  nftGift('trapped_heart-4', 'Trapped Heart', 18180, 'rare', 'Trapped Heart', '/gifts/trapped_heart_4.png', 18.18, 'Faded Relic', 'Cappuccino', 'Guitar', 6334),
  nftGift('trapped_heart-5', 'Trapped Heart', 18180, 'rare', 'Trapped Heart', '/gifts/trapped_heart_5.png', 18.18, 'Iron Pulse', 'Orange', 'Ladybug', 24954),
  nftGift('trapped_heart-6', 'Trapped Heart', 18180, 'rare', 'Trapped Heart', '/gifts/trapped_heart_6.png', 18.18, 'Faded Relic', 'Chestnut', 'Poison Drop', 4262),
  nftGift('snoop_cigar-1', 'Snoop Cigar', 19190, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_1.png', 19.19, 'Dolla Rolla', 'Indigo Dye', 'Cash', 41075),
  nftGift('snoop_cigar-2', 'Snoop Cigar', 19190, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_2.png', 19.19, 'Doggystyle', 'Black', 'Full Moon', 8744),
  nftGift('snoop_cigar-3', 'Snoop Cigar', 19190, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_3.png', 19.19, 'Happy Face', 'Caramel', 'War Tiger', 88888),
  nftGift('snoop_cigar-4', 'Snoop Cigar', 19190, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_4.png', 19.19, 'Mirage', 'Silver Blue', 'Porrige', 111359),
  nftGift('snoop_cigar-5', 'Snoop Cigar', 19190, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_5.png', 19.19, 'Bandana', 'Feldgrau', 'Toy Bucket', 19001),
  nftGift('snoop_cigar-6', 'Snoop Cigar', 19190, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_6.png', 19.19, 'Herbalist', 'Navy Blue', 'Cheese', 47480),
  nftGift('love_potion-1', 'Love Potion', 16160, 'rare', 'Love Potion', '/gifts/love_potion_1.png', 16.16, 'No Signal', 'Electric Purple', 'Love Cherry', 12363),
  nftGift('love_potion-2', 'Love Potion', 16160, 'rare', 'Love Potion', '/gifts/love_potion_2.png', 16.16, 'Spades', 'Black', 'Jewel', 19851),
  nftGift('love_potion-3', 'Love Potion', 16160, 'rare', 'Love Potion', '/gifts/love_potion_3.png', 16.16, 'No Signal', 'Fandango', 'Wine Toast', 19985),
  nftGift('love_potion-4', 'Love Potion', 16160, 'rare', 'Love Potion', '/gifts/love_potion_4.png', 16.16, 'Ruby Essence', 'Lemongrass', 'Lotus Flower', 15594),
  nftGift('love_potion-5', 'Love Potion', 16160, 'rare', 'Love Potion', '/gifts/love_potion_5.png', 16.16, 'Old Rum', 'Sky Blue', 'Mustache', 16688),
  nftGift('love_potion-6', 'Love Potion', 16160, 'rare', 'Love Potion', '/gifts/love_potion_6.png', 16.16, 'Bubble Bath', 'Light Olive', 'Origami', 9740),
  nftGift('crystal_ball-1', 'Crystal Ball', 15150, 'rare', 'Crystal Ball', '/gifts/crystal_ball_1.png', 15.15, 'Fortune', 'Amber', 'Potion', 7446),
  nftGift('crystal_ball-2', 'Crystal Ball', 15150, 'rare', 'Crystal Ball', '/gifts/crystal_ball_2.png', 15.15, 'Lady Death', 'Black', 'Mushroom', 26451),
  nftGift('crystal_ball-3', 'Crystal Ball', 15150, 'rare', 'Crystal Ball', '/gifts/crystal_ball_3.png', 15.15, 'Fatal Error', 'Black', 'Candle', 7968),
  nftGift('crystal_ball-4', 'Crystal Ball', 15150, 'rare', 'Crystal Ball', '/gifts/crystal_ball_4.png', 15.15, 'Original Sin', 'Coral Red', 'Baphomet', 21104),
  nftGift('crystal_ball-5', 'Crystal Ball', 15150, 'rare', 'Crystal Ball', '/gifts/crystal_ball_5.png', 15.15, 'Fatal Error', 'Rosewood', 'Spooky Cat', 23699),
  nftGift('crystal_ball-6', 'Crystal Ball', 15150, 'rare', 'Crystal Ball', '/gifts/crystal_ball_6.png', 15.15, 'Cartoon', 'Hunter Green', 'Grim Reaper', 3935),
  nftGift('jingle_bell-1', 'Jingle Bell', 12120, 'rare', 'Jingle Bell', '/gifts/jingle_bell_1.png', 12.12, 'Red Petals', 'Amber', 'Jingle Bell', 8888),
  nftGift('jingle_bell-2', 'Jingle Bell', 12120, 'rare', 'Jingle Bell', '/gifts/jingle_bell_2.png', 12.12, 'Hot Cherry', 'Fandango', 'Ice Skates', 10090),
  nftGift('jingle_bell-3', 'Jingle Bell', 12120, 'rare', 'Jingle Bell', '/gifts/jingle_bell_3.png', 12.12, 'Launchpad', 'Black', 'Bowtie', 4435),
  nftGift('jingle_bell-4', 'Jingle Bell', 12120, 'rare', 'Jingle Bell', '/gifts/jingle_bell_4.png', 12.12, 'Woodland', 'Chocolate', 'Sakura', 38099),
  nftGift('jingle_bell-5', 'Jingle Bell', 12120, 'rare', 'Jingle Bell', '/gifts/jingle_bell_5.png', 12.12, 'Peppermint', 'Jade Green', 'Ornament', 72589),
  nftGift('jingle_bell-6', 'Jingle Bell', 12120, 'rare', 'Jingle Bell', '/gifts/jingle_bell_6.png', 12.12, 'Bumblebell', 'Electric Indigo', 'Stocking', 73282),
  nftGift('witch_hat-1', 'Witch Hat', 10100, 'rare', 'Witch Hat', '/gifts/witch_hat_1.png', 10.1, 'Obi-Wan', 'Black', 'Illuminati', 12200),
  nftGift('witch_hat-2', 'Witch Hat', 10100, 'rare', 'Witch Hat', '/gifts/witch_hat_2.png', 10.1, 'Narnia', 'Black', 'Bloody Axe', 16876),
  nftGift('witch_hat-3', 'Witch Hat', 10100, 'rare', 'Witch Hat', '/gifts/witch_hat_3.png', 10.1, 'Bat Swarm', 'Black', 'Crow', 36852),
  nftGift('witch_hat-4', 'Witch Hat', 10100, 'rare', 'Witch Hat', '/gifts/witch_hat_4.png', 10.1, 'Beetroot', 'Battleship Grey', 'Sumerian Bird', 4880),
  nftGift('witch_hat-5', 'Witch Hat', 10100, 'rare', 'Witch Hat', '/gifts/witch_hat_5.png', 10.1, 'Aeromancy', 'Shamrock Green', 'Grenade', 51869),
  nftGift('witch_hat-6', 'Witch Hat', 10100, 'rare', 'Witch Hat', '/gifts/witch_hat_6.png', 10.1, 'Circus', 'Cobalt Blue', 'Crystal Ball', 1452),
  nftGift('fine_pen-1', 'Fine Pen', 9090, 'common', 'Fine Pen', '/gifts/fine_pen_1.png', 9.09, 'Signature Scribe', 'Black', 'Jörmungandr', 2170),
  nftGift('fine_pen-2', 'Fine Pen', 9090, 'common', 'Fine Pen', '/gifts/fine_pen_2.png', 9.09, 'Tsar Gold', 'Indigo Dye', 'Hersir', 33333),
  nftGift('fine_pen-3', 'Fine Pen', 9090, 'common', 'Fine Pen', '/gifts/fine_pen_3.png', 9.09, 'Firebird', 'Fire Engine', 'Bull of Heaven', 21079),
  nftGift('fine_pen-4', 'Fine Pen', 9090, 'common', 'Fine Pen', '/gifts/fine_pen_4.png', 9.09, 'Mesh Maker', 'Orange', 'Leaf', 20160),
  nftGift('fine_pen-5', 'Fine Pen', 9090, 'common', 'Fine Pen', '/gifts/fine_pen_5.png', 9.09, 'Elastic', 'Sky Blue', 'Silver Ibis', 9859),
  nftGift('fine_pen-6', 'Fine Pen', 9090, 'common', 'Fine Pen', '/gifts/fine_pen_6.png', 9.09, 'Master Stroke', 'Emerald', 'Wise Raven', 3539),
  nftGift('jolly_chimp-1', 'Jolly Chimp', 8080, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_1.png', 8.08, 'Genie', 'Black', 'Seahorse', 14010),
  nftGift('jolly_chimp-2', 'Jolly Chimp', 8080, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_2.png', 8.08, 'Grayscale', 'Black', 'Bottlenose', 7143),
  nftGift('jolly_chimp-3', 'Jolly Chimp', 8080, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_3.png', 8.08, 'Bank Robber', 'Deep Cyan', 'Bandana', 92465),
  nftGift('jolly_chimp-4', 'Jolly Chimp', 8080, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_4.png', 8.08, 'Farm Girl', 'Mint Green', 'Battle Axe', 29763),
  nftGift('jolly_chimp-5', 'Jolly Chimp', 8080, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_5.png', 8.08, 'Knight', 'Moonstone', 'Earflap Hat', 39056),
  nftGift('jolly_chimp-6', 'Jolly Chimp', 8080, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_6.png', 8.08, 'Farm Girl', 'Gunship Green', 'Corn', 71324),
  nftGift('surge_board-1', 'Surge Board', 8080, 'common', 'Surge Board', '/gifts/surge_board_1.png', 8.08, 'Pepe Surfer', 'Purple', 'Basketball', 12656),
  nftGift('surge_board-2', 'Surge Board', 8080, 'common', 'Surge Board', '/gifts/surge_board_2.png', 8.08, 'Oracle', 'Mystic Pearl', 'UFO', 16888),
  nftGift('surge_board-3', 'Surge Board', 8080, 'common', 'Surge Board', '/gifts/surge_board_3.png', 8.08, 'Balls of Steel', 'Silver Blue', 'Shell', 1690),
  nftGift('surge_board-4', 'Surge Board', 8080, 'common', 'Surge Board', '/gifts/surge_board_4.png', 8.08, 'Hoverboard', 'English Violet', 'Sharp Sword', 6423),
  nftGift('surge_board-5', 'Surge Board', 8080, 'common', 'Surge Board', '/gifts/surge_board_5.png', 8.08, 'Da Vinci', 'Sapphire', 'Lightning', 27443),
  nftGift('surge_board-6', 'Surge Board', 8080, 'common', 'Surge Board', '/gifts/surge_board_6.png', 8.08, 'Tiger Mask', 'Azure Blue', 'Rose', 16711),
  nftGift('input_key-1', 'Input Key', 8080, 'common', 'Input Key', '/gifts/input_key_1.png', 8.08, 'Chill Key', 'Indigo Dye', 'PC Mouse', 50549),
  nftGift('input_key-2', 'Input Key', 8080, 'common', 'Input Key', '/gifts/input_key_2.png', 8.08, 'Coffee', 'Black', 'Magic Wand', 22871),
  nftGift('input_key-3', 'Input Key', 8080, 'common', 'Input Key', '/gifts/input_key_3.png', 8.08, 'Bitcoin', 'Black', 'Sauron', 118547),
  nftGift('input_key-4', 'Input Key', 8080, 'common', 'Input Key', '/gifts/input_key_4.png', 8.08, 'Hot Grill', 'Battleship Grey', 'Cap', 132336),
  nftGift('input_key-5', 'Input Key', 8080, 'common', 'Input Key', '/gifts/input_key_5.png', 8.08, 'Helipad', 'Malachite', 'Grenade', 14350),
  nftGift('input_key-6', 'Input Key', 8080, 'common', 'Input Key', '/gifts/input_key_6.png', 8.08, 'Continue', 'Hunter Green', 'Takoyaki', 5480),
  nftGift('snoop_dogg-1', 'Snoop Dogg', 6060, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_1.png', 6.06, 'Dapper Doggo', 'Black', 'Shell', 55555),
  nftGift('snoop_dogg-2', 'Snoop Dogg', 6060, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_2.png', 6.06, 'Black Gold', 'Electric Purple', 'Doberman', 222222),
  nftGift('snoop_dogg-3', 'Snoop Dogg', 6060, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_3.png', 6.06, 'Goldizzle', 'Carmine', 'Viper', 158442),
  nftGift('snoop_dogg-4', 'Snoop Dogg', 6060, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_4.png', 6.06, 'Barks Lightyear', 'Hunter Green', '213', 304303),
  nftGift('snoop_dogg-5', 'Snoop Dogg', 6060, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_5.png', 6.06, 'Barks Lightyear', 'Cappuccino', 'Melon', 313083),
  nftGift('snoop_dogg-6', 'Snoop Dogg', 6060, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_6.png', 6.06, 'Barks Lightyear', 'Moonstone', 'Toilet', 463640),
  nftGift('spring_basket-1', 'Spring Basket', 7070, 'common', 'Spring Basket', '/gifts/spring_basket_1.png', 7.07, 'Meme God', 'Gunmetal', 'Seahorse', 166083),
  nftGift('spring_basket-2', 'Spring Basket', 7070, 'common', 'Spring Basket', '/gifts/spring_basket_2.png', 7.07, 'Meme God', 'Mint Green', 'Cap', 102695),
  nftGift('spring_basket-3', 'Spring Basket', 7070, 'common', 'Spring Basket', '/gifts/spring_basket_3.png', 7.07, 'Balloon Dog', 'Cappuccino', 'Toilet', 33333),
  nftGift('spring_basket-4', 'Spring Basket', 7070, 'common', 'Spring Basket', '/gifts/spring_basket_4.png', 7.07, 'Bear Market', 'Desert Sand', 'Conical Hat', 151508),
  nftGift('spring_basket-5', 'Spring Basket', 7070, 'common', 'Spring Basket', '/gifts/spring_basket_5.png', 7.07, 'Candy Bat', 'Rifle Green', 'Sauron', 32650),
  nftGift('spring_basket-6', 'Spring Basket', 7070, 'common', 'Spring Basket', '/gifts/spring_basket_6.png', 7.07, 'Meme Snake', 'Pure Gold', 'Mannaz Rune', 102930),
  nftGift('liberty_figure-1', 'Liberty Figure', 6060, 'common', 'Liberty Figure', '/gifts/liberty_figure_1.png', 6.06, 'Astronaut', 'Black', 'Full Moon', 99),
  nftGift('liberty_figure-2', 'Liberty Figure', 6060, 'common', 'Liberty Figure', '/gifts/liberty_figure_2.png', 6.06, 'Obsidian', 'Black', 'Kudu Totem', 36188),
  nftGift('liberty_figure-3', 'Liberty Figure', 6060, 'common', 'Liberty Figure', '/gifts/liberty_figure_3.png', 6.06, 'iFather', 'Pine Green', 'Trickster Fox', 100),
  nftGift('liberty_figure-4', 'Liberty Figure', 6060, 'common', 'Liberty Figure', '/gifts/liberty_figure_4.png', 6.06, 'Pitcher', 'Coral Red', 'Double Axe', 263557),
  nftGift('liberty_figure-5', 'Liberty Figure', 6060, 'common', 'Liberty Figure', '/gifts/liberty_figure_5.png', 6.06, 'Street Beats', 'Cappuccino', 'Morgenstern', 201921),
  nftGift('liberty_figure-6', 'Liberty Figure', 6060, 'common', 'Liberty Figure', '/gifts/liberty_figure_6.png', 6.06, 'Pitcher', 'Old Gold', 'Baseball Cap', 135881),
  nftGift('clover_pin-1', 'Clover Pin', 6060, 'common', 'Clover Pin', '/gifts/clover_pin_1.png', 6.06, 'Celtic Knot', 'Lavender', 'Fleur-de-lis', 888),
  nftGift('clover_pin-2', 'Clover Pin', 6060, 'common', 'Clover Pin', '/gifts/clover_pin_2.png', 6.06, 'Kaleidoscope', 'Onyx Black', 'Star Crown', 4902),
  nftGift('clover_pin-3', 'Clover Pin', 6060, 'common', 'Clover Pin', '/gifts/clover_pin_3.png', 6.06, 'Matrix', 'Black', 'Pegasus', 156337),
  nftGift('clover_pin-4', 'Clover Pin', 6060, 'common', 'Clover Pin', '/gifts/clover_pin_4.png', 6.06, 'Golden Ticket', 'Rifle Green', 'Magic Hat', 54942),
  nftGift('clover_pin-5', 'Clover Pin', 6060, 'common', 'Clover Pin', '/gifts/clover_pin_5.png', 6.06, 'Pinwheel', 'Celtic Blue', 'Cow Skull', 15975),
  nftGift('clover_pin-6', 'Clover Pin', 6060, 'common', 'Clover Pin', '/gifts/clover_pin_6.png', 6.06, 'Fortune Cookie', 'Ranger Green', 'Wolf Rage', 127282),
  nftGift('party_sparkler-1', 'Party Sparkler', 6060, 'common', 'Party Sparkler', '/gifts/party_sparkler_1.png', 6.06, 'Assault', 'Raspberry', 'Gingerbread', 77777),
  nftGift('party_sparkler-2', 'Party Sparkler', 6060, 'common', 'Party Sparkler', '/gifts/party_sparkler_2.png', 6.06, 'Inverted', 'Black', 'Sakura', 136683),
  nftGift('party_sparkler-3', 'Party Sparkler', 6060, 'common', 'Party Sparkler', '/gifts/party_sparkler_3.png', 6.06, 'Marksman', 'Black', 'Brain', 103761),
  nftGift('party_sparkler-4', 'Party Sparkler', 6060, 'common', 'Party Sparkler', '/gifts/party_sparkler_4.png', 6.06, 'Cyan Sizzle', 'Pure Gold', 'Love Letter', 41712),
  nftGift('party_sparkler-5', 'Party Sparkler', 6060, 'common', 'Party Sparkler', '/gifts/party_sparkler_5.png', 6.06, 'Ninja Turtle', 'English Violet', 'Stocking', 177649),
  nftGift('party_sparkler-6', 'Party Sparkler', 6060, 'common', 'Party Sparkler', '/gifts/party_sparkler_6.png', 6.06, 'Amethyst', 'Pacific Green', 'Gamepad', 75170),
  nftGift('victory_medal-1', 'Victory Medal', 6060, 'common', 'Victory Medal', '/gifts/victory_medal_1.png', 6.06, 'The Founder', 'Gunship Green', 'Tree of Life', 3554),
  nftGift('victory_medal-2', 'Victory Medal', 6060, 'common', 'Victory Medal', '/gifts/victory_medal_2.png', 6.06, 'The Founder', 'Ranger Green', 'Ribeye Steak', 7873),
  nftGift('victory_medal-3', 'Victory Medal', 6060, 'common', 'Victory Medal', '/gifts/victory_medal_3.png', 6.06, 'Noble Prize', 'Tomato', 'Arabian Horse', 75894),
  nftGift('victory_medal-4', 'Victory Medal', 6060, 'common', 'Victory Medal', '/gifts/victory_medal_4.png', 6.06, 'Finish Line', 'Desert Sand', 'Like', 15938),
  nftGift('victory_medal-5', 'Victory Medal', 6060, 'common', 'Victory Medal', '/gifts/victory_medal_5.png', 6.06, 'Top Swimmer', 'Turquoise', 'Leprechaun', 59386),
  nftGift('victory_medal-6', 'Victory Medal', 6060, 'common', 'Victory Medal', '/gifts/victory_medal_6.png', 6.06, 'Inventor', 'French Violet', 'Rooster', 51584),
  nftGift('timeless_book-1', 'Timeless Book', 5050, 'common', 'Timeless Book', '/gifts/timeless_book_1.png', 5.05, 'Death Note', 'Ivory White', 'Cicada', 35375),
  nftGift('timeless_book-2', 'Timeless Book', 5050, 'common', 'Timeless Book', '/gifts/timeless_book_2.png', 5.05, 'Death Note', 'Onyx Black', 'Fried Egg', 36568),
  nftGift('timeless_book-3', 'Timeless Book', 5050, 'common', 'Timeless Book', '/gifts/timeless_book_3.png', 5.05, 'Death Note', 'Rosewood', 'Axe', 59063),
  nftGift('timeless_book-4', 'Timeless Book', 5050, 'common', 'Timeless Book', '/gifts/timeless_book_4.png', 5.05, 'Clay Tablets', 'Light Olive', 'Twin Koi', 23787),
  nftGift('timeless_book-5', 'Timeless Book', 5050, 'common', 'Timeless Book', '/gifts/timeless_book_5.png', 5.05, 'Clay Tablets', 'Jade Green', 'Pirate Hat', 25649),
  nftGift('timeless_book-6', 'Timeless Book', 5050, 'common', 'Timeless Book', '/gifts/timeless_book_6.png', 5.05, 'Cookbook', 'Camo Green', 'Grape', 52095),
  nftGift('pet_snake-1', 'Pet Snake', 5050, 'common', 'Pet Snake', '/gifts/pet_snake_1.png', 5.05, 'Venomous', 'Battleship Grey', 'Crusader Cross', 8989),
  nftGift('pet_snake-2', 'Pet Snake', 5050, 'common', 'Pet Snake', '/gifts/pet_snake_2.png', 5.05, 'Albino', 'Onyx Black', 'Griffon', 18888),
  nftGift('pet_snake-3', 'Pet Snake', 5050, 'common', 'Pet Snake', '/gifts/pet_snake_3.png', 5.05, 'Pure Gold', 'Amber', 'Pirate Hat', 7323),
  nftGift('pet_snake-4', 'Pet Snake', 5050, 'common', 'Pet Snake', '/gifts/pet_snake_4.png', 5.05, 'Mojito', 'Mystic Pearl', 'Easter Bunny', 185197),
  nftGift('pet_snake-5', 'Pet Snake', 5050, 'common', 'Pet Snake', '/gifts/pet_snake_5.png', 5.05, 'Mojito', 'Aquamarine', 'Khinkali', 733),
  nftGift('pet_snake-6', 'Pet Snake', 5050, 'common', 'Pet Snake', '/gifts/pet_snake_6.png', 5.05, 'Lava Viper', 'Sky Blue', 'Cookie', 8490),
  nftGift('whip_cupcake-1', 'Whip Cupcake', 5050, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_1.png', 5.05, 'Blueberry Hill', 'Coral Red', 'Kite', 88),
  nftGift('whip_cupcake-2', 'Whip Cupcake', 5050, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_2.png', 5.05, 'Cherry Top', 'Navy Blue', 'Hourglass', 11),
  nftGift('whip_cupcake-3', 'Whip Cupcake', 5050, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_3.png', 5.05, 'Heaven Seven', 'Black', 'Baphomet', 10701),
  nftGift('whip_cupcake-4', 'Whip Cupcake', 5050, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_4.png', 5.05, 'Two Sweet!', 'Moonstone', 'Cactus Bloom', 62788),
  nftGift('whip_cupcake-5', 'Whip Cupcake', 5050, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_5.png', 5.05, 'Wasteland', 'Deep Cyan', 'Angelic Heart', 61407),
  nftGift('whip_cupcake-6', 'Whip Cupcake', 5050, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_6.png', 5.05, 'Arizona', 'Deep Cyan', 'Basketball', 253701),
  nftGift('ice_cream-1', 'Ice Cream', 5050, 'common', 'Ice Cream', '/gifts/ice_cream_1.png', 5.05, 'BiteCoin', 'Mustard', 'Imperial Lion', 280110),
  nftGift('ice_cream-2', 'Ice Cream', 5050, 'common', 'Ice Cream', '/gifts/ice_cream_2.png', 5.05, 'BiteCoin', 'Black', 'Piggy Bank', 307783),
  nftGift('ice_cream-3', 'Ice Cream', 5050, 'common', 'Ice Cream', '/gifts/ice_cream_3.png', 5.05, 'Stardust', 'Black', 'Grape', 266756),
  nftGift('ice_cream-4', 'Ice Cream', 5050, 'common', 'Ice Cream', '/gifts/ice_cream_4.png', 5.05, 'Trio Scoop', 'Old Gold', 'Cherry', 206768),
  nftGift('ice_cream-5', 'Ice Cream', 5050, 'common', 'Ice Cream', '/gifts/ice_cream_5.png', 5.05, 'Bite-Size', 'Feldgrau', 'Jewel', 191541),
  nftGift('ice_cream-6', 'Ice Cream', 5050, 'common', 'Ice Cream', '/gifts/ice_cream_6.png', 5.05, 'Kiwi Sorbet', 'Emerald', 'Shooting Star', 117399),
  nftGift('lol_pop-1', 'Lol Pop', 5050, 'common', 'Lol Pop', '/gifts/lol_pop_1.png', 5.05, 'Prisma', 'Chestnut', 'Wontons', 11111),
  nftGift('lol_pop-2', 'Lol Pop', 5050, 'common', 'Lol Pop', '/gifts/lol_pop_2.png', 5.05, 'Doodle Art', 'Black', 'Thief', 94355),
  nftGift('lol_pop-3', 'Lol Pop', 5050, 'common', 'Lol Pop', '/gifts/lol_pop_3.png', 5.05, 'Pineapple', 'Black', 'Rocket', 47324),
  nftGift('lol_pop-4', 'Lol Pop', 5050, 'common', 'Lol Pop', '/gifts/lol_pop_4.png', 5.05, 'Bitter Lemon', 'Sapphire', 'Sleepy Unicorn', 426653),
  nftGift('lol_pop-5', 'Lol Pop', 5050, 'common', 'Lol Pop', '/gifts/lol_pop_5.png', 5.05, 'Delusion', 'Pistachio', 'Holy Grail', 36859),
  nftGift('lol_pop-6', 'Lol Pop', 5050, 'common', 'Lol Pop', '/gifts/lol_pop_6.png', 5.05, 'Blender', 'Electric Indigo', 'Moon Cross', 75603),
  nftGift('pool_float-1', 'Pool Float', 5050, 'common', 'Pool Float', '/gifts/pool_float_1.png', 5.05, 'Pool Pepe', 'Onyx Black', 'Tribal Shield', 1409),
  nftGift('pool_float-2', 'Pool Float', 5050, 'common', 'Pool Float', '/gifts/pool_float_2.png', 5.05, 'Pool King', 'Black', 'Dagger', 215515),
  nftGift('pool_float-3', 'Pool Float', 5050, 'common', 'Pool Float', '/gifts/pool_float_3.png', 5.05, 'Pool Pepe', 'Pine Green', 'Scarab', 179551),
  nftGift('pool_float-4', 'Pool Float', 5050, 'common', 'Pool Float', '/gifts/pool_float_4.png', 5.05, 'Rescue Mission', 'Steel Grey', 'French Fries', 135209),
  nftGift('pool_float-5', 'Pool Float', 5050, 'common', 'Pool Float', '/gifts/pool_float_5.png', 5.05, 'Mojito', 'Coral Red', 'Tooth', 137524),
  nftGift('pool_float-6', 'Pool Float', 5050, 'common', 'Pool Float', '/gifts/pool_float_6.png', 5.05, 'Palm Beach', 'Desert Sand', 'Bunny', 97157),
  nftGift('big_year-1', 'Big Year', 5050, 'common', 'Big Year', '/gifts/big_year_1.png', 5.05, 'Pokeball', 'Onyx Black', 'Baby Bottle', 11599),
  nftGift('big_year-2', 'Big Year', 5050, 'common', 'Big Year', '/gifts/big_year_2.png', 5.05, 'Matrix', 'Black', 'Hazelnut', 64608),
  nftGift('big_year-3', 'Big Year', 5050, 'common', 'Big Year', '/gifts/big_year_3.png', 5.05, 'Qing Dynasty', 'Black', 'Lily', 3903),
  nftGift('big_year-4', 'Big Year', 5050, 'common', 'Big Year', '/gifts/big_year_4.png', 5.05, 'Einstein', 'Navy Blue', 'Sun Lion', 64751),
  nftGift('big_year-5', 'Big Year', 5050, 'common', 'Big Year', '/gifts/big_year_5.png', 5.05, 'Einstein', 'Steel Grey', 'Smartphone', 11103),
  nftGift('big_year-6', 'Big Year', 5050, 'common', 'Big Year', '/gifts/big_year_6.png', 5.05, 'Van Gogh', 'Roman Silver', 'Sun Lion', 22608),
  nftGift('xmas_stocking-1', 'Xmas Stocking', 5050, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_1.png', 5.05, 'Morgenstern', 'Black', 'Eggplant', 197253),
  nftGift('xmas_stocking-2', 'Xmas Stocking', 5050, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_2.png', 5.05, 'Gold Mine', 'Black', 'Sun Lion', 13117),
  nftGift('xmas_stocking-3', 'Xmas Stocking', 5050, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_3.png', 5.05, 'Morgenstern', 'Ivory White', 'Stocking', 54876),
  nftGift('xmas_stocking-4', 'Xmas Stocking', 5050, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_4.png', 5.05, 'Pink Faerie', 'Gunship Green', 'Piranha', 223707),
  nftGift('xmas_stocking-5', 'Xmas Stocking', 5050, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_5.png', 5.05, 'Pink Faerie', 'Moonstone', 'Candle', 214263),
  nftGift('xmas_stocking-6', 'Xmas Stocking', 5050, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_6.png', 5.05, 'Hot Winter', 'Burnt Sienna', 'Gold', 229438),
  nftGift('chill_flame-1', 'Chill Flame', 5050, 'common', 'Chill Flame', '/gifts/chill_flame_1.png', 5.05, 'The Match', 'Black', 'Ring', 77215),
  nftGift('chill_flame-2', 'Chill Flame', 5050, 'common', 'Chill Flame', '/gifts/chill_flame_2.png', 5.05, 'Satis-fire', 'Raspberry', 'Twin Koi', 113221),
  nftGift('chill_flame-3', 'Chill Flame', 5050, 'common', 'Chill Flame', '/gifts/chill_flame_3.png', 5.05, 'Bull Run', 'Black', 'Star', 416648),
  nftGift('chill_flame-4', 'Chill Flame', 5050, 'common', 'Chill Flame', '/gifts/chill_flame_4.png', 5.05, 'Oil Lamp', 'Pine Green', 'Rhino Warrior', 84502),
  nftGift('chill_flame-5', 'Chill Flame', 5050, 'common', 'Chill Flame', '/gifts/chill_flame_5.png', 5.05, 'Oil Lamp', 'Pure Gold', 'Watching Sun', 242120),
  nftGift('chill_flame-6', 'Chill Flame', 5050, 'common', 'Chill Flame', '/gifts/chill_flame_6.png', 5.05, 'Oil Lamp', 'Ivory White', 'Toilet', 80670),
]

export const giftById: ReadonlyMap<string, Gift> = new Map(
  gifts.map((item) => [item.id, item] as const),
)

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
    image: `/cases/${id}.png`,
    priceMinor,
    freeCooldownMs,
    isNew,
    glow,
    entries,
  }
}

const CASE_CONFIG: readonly {
  id: string
  name: string
  priceMinor: Minor
  isNew?: boolean
  glow: string
}[] = [
  { id: 'farm', name: 'Farm', priceMinor: 6000, glow: '#46d97b' },
  { id: 'autumn', name: 'Autumn', priceMinor: 8000, isNew: true, glow: '#ff9f2e' },
  { id: 'movie', name: 'Movie', priceMinor: 9000, glow: '#ff5d5d' },
  { id: 'telegram', name: 'Telegram', priceMinor: 10000, glow: '#3ba7ff' },
  { id: 'magic', name: 'Magic', priceMinor: 10000, glow: '#a855f7' },
  { id: 'kitty', name: 'Kitty', priceMinor: 10000, glow: '#ff7ad9' },
  { id: 'space', name: 'Space', priceMinor: 12000, glow: '#8b5cf6' },
  { id: 'adult18', name: '18+', priceMinor: 14000, glow: '#ff4d6d' },
  { id: 'snoop', name: 'Snoop', priceMinor: 15000, glow: '#ffc93c' },
  { id: 'money', name: 'Money', priceMinor: 16000, glow: '#2fbf6a' },
  { id: 'onyx-black', name: 'Onyx Black', priceMinor: 16000, glow: '#7c5cff' },
  { id: 'peach', name: 'Peach', priceMinor: 16000, glow: '#ffb07a' },
  { id: 'gem', name: 'Gem', priceMinor: 16000, glow: '#38e1ff' },
  { id: 'classic', name: 'Classic', priceMinor: 150, isNew: true, glow: '#ffb74d' },
  { id: 'romance', name: 'Love', priceMinor: 150, isNew: true, glow: '#ff6f91' },
  { id: 'holiday', name: 'Holiday', priceMinor: 250, isNew: true, glow: '#59c8ff' },
  { id: 'sweet', name: 'Sweet', priceMinor: 6000, isNew: true, glow: '#ff8fc7' },
  { id: 'party', name: 'Party', priceMinor: 6000, isNew: true, glow: '#ffd23c' },
  { id: 'cute', name: 'Cute', priceMinor: 6000, isNew: true, glow: '#ffb3d9' },
  { id: 'street', name: 'Street', priceMinor: 7000, isNew: true, glow: '#ff6b3d' },
  { id: 'jewel', name: 'Jewel', priceMinor: 12000, isNew: true, glow: '#5de0ff' },
  { id: 'meme', name: 'Meme', priceMinor: 7000, isNew: true, glow: '#7be35c' },
  { id: 'heroes', name: 'Heroes', priceMinor: 14000, isNew: true, glow: '#ffb02e' },
  { id: 'potion', name: 'Potion', priceMinor: 18000, isNew: true, glow: '#c05cff' },
  { id: 'pepe', name: 'Pepe', priceMinor: 30000, glow: '#6ee36e' },
  { id: 'cap', name: 'Cap', priceMinor: 30000, glow: '#a3d94c' },
  { id: 'ring', name: 'Ring', priceMinor: 30000, glow: '#ffc93c' },
  { id: 'black', name: 'Black', priceMinor: 40000, glow: '#6d28d9' },
  { id: 'epic', name: 'Epic', priceMinor: 80000, glow: '#8b5cf6' },
  { id: 'vip', name: 'VIP', priceMinor: 120000, isNew: true, glow: '#ffc93c' },
  { id: 'elite', name: 'Elite', priceMinor: 300000, isNew: true, glow: '#ff9d0b' },
]

export const cases: readonly CaseDefinition[] = [
  ...CASE_CONFIG.map((config) =>
    caseDefinition(config.id, config.name, config.priceMinor, config.isNew ?? false, null, config.glow),
  ),
  caseDefinition('free24', 'FREE 24', 0, false, FREE_COOLDOWNS.free24, '#ffc93c'),
  caseDefinition('free', 'FREE', 0, false, FREE_COOLDOWNS.free, '#b7a4f9'),
]

export const paidCases: readonly CaseDefinition[] = [...cases.filter((c) => c.freeCooldownMs === null)].sort((a, b) => a.priceMinor - b.priceMinor)

export const freeCases: readonly CaseDefinition[] = cases.filter((c) => c.freeCooldownMs !== null)

export const caseById: ReadonlyMap<string, CaseDefinition> = new Map(
  cases.map((item) => [item.id, item] as const),
)

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

export const findClosestGift = getGiftForValue

