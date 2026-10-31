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

  /* --- 147 ПОДЛИННЫХ TELEGRAM NFT С FRAGMENT (3 уникальных вида на каждый из 49 подарков) --- */
  nftGift('plush_pepe-1', 'Plush Pepe', 6720000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_1.png', 6720.0, 'Gummy Frog', 'Platinum', 'Ring', 1821),
  nftGift('plush_pepe-2', 'Plush Pepe', 6720000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_2.png', 6720.0, 'Christmas', 'Black', 'Champagne', 1056),
  nftGift('plush_pepe-3', 'Plush Pepe', 6720000, 'legendary', 'Plush Pepe', '/gifts/plush_pepe_3.png', 6720.0, 'Cozy Galaxy', 'Electric Purple', 'Doberman', 1515),
  nftGift('heart_locket-1', 'Heart Locket', 1365000, 'legendary', 'Heart Locket', '/gifts/heart_locket_1.png', 1365.0, 'Turtles', 'Lemongrass', 'Like', 875),
  nftGift('heart_locket-2', 'Heart Locket', 1365000, 'legendary', 'Heart Locket', '/gifts/heart_locket_2.png', 1365.0, 'Black Hole', 'Electric Indigo', 'Anchor', 65),
  nftGift('heart_locket-3', 'Heart Locket', 1365000, 'legendary', 'Heart Locket', '/gifts/heart_locket_3.png', 1365.0, 'Spider Web', 'Neon Blue', 'Melon', 1882),
  nftGift('resistance_dog-1', 'Resistance Dog', 493500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_1.png', 493.5, 'Creeper', 'Midnight Blue', 'Paper Lantern', 4156),
  nftGift('resistance_dog-2', 'Resistance Dog', 493500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_2.png', 493.5, 'Proxy Server', 'Steel Grey', 'Lion of Babylon', 11806),
  nftGift('resistance_dog-3', 'Resistance Dog', 493500, 'legendary', 'Resistance Dog', '/gifts/resistance_dog_3.png', 493.5, 'Ultras', 'Satin Gold', 'Shinto Shrine', 1440),
  nftGift('durovs_cap-1', 'Durov\'s Cap', 446300, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_1.png', 446.3, 'Duskwave', 'Black', 'Eagle', 1142),
  nftGift('durovs_cap-2', 'Durov\'s Cap', 446300, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_2.png', 446.3, 'Asterix', 'Electric Indigo', 'Apple', 1896),
  nftGift('durovs_cap-3', 'Durov\'s Cap', 446300, 'legendary', 'Durov\'s Cap', '/gifts/durovs_cap_3.png', 446.3, 'Artwork', 'Electric Indigo', 'Cursor', 302),
  nftGift('scared_cat-1', 'Scared Cat', 294000, 'legendary', 'Scared Cat', '/gifts/scared_cat_1.png', 294.0, 'Obelisk', 'Onyx Black', 'Voodoo Doll', 2920),
  nftGift('scared_cat-2', 'Scared Cat', 294000, 'legendary', 'Scared Cat', '/gifts/scared_cat_2.png', 294.0, 'Cat Nukem', 'Onyx Black', 'Scarecrow', 17302),
  nftGift('scared_cat-3', 'Scared Cat', 294000, 'legendary', 'Scared Cat', '/gifts/scared_cat_3.png', 294.0, 'Celestia', 'Sapphire', 'Moon', 1813),
  nftGift('precious_peach-1', 'Precious Peach', 273000, 'legendary', 'Precious Peach', '/gifts/precious_peach_1.png', 273.0, 'Spoiled', 'Black', 'Gold', 595),
  nftGift('precious_peach-2', 'Precious Peach', 273000, 'legendary', 'Precious Peach', '/gifts/precious_peach_2.png', 273.0, 'Cutout', 'Black', 'Stilettos', 2161),
  nftGift('precious_peach-3', 'Precious Peach', 273000, 'legendary', 'Precious Peach', '/gifts/precious_peach_3.png', 273.0, 'Twilight', 'Cyberpunk', 'Kitty Cat', 246),
  nftGift('heroic_helmet-1', 'Heroic Helmet', 194300, 'epic', 'Heroic Helmet', '/gifts/heroic_helmet_1.png', 194.3, 'Mercurial', 'Onyx Black', 'Imperial Lion', 680),
  nftGift('heroic_helmet-2', 'Heroic Helmet', 194300, 'epic', 'Heroic Helmet', '/gifts/heroic_helmet_2.png', 194.3, 'Mercurial', 'Battleship Grey', 'Double Axe', 1372),
  nftGift('heroic_helmet-3', 'Heroic Helmet', 194300, 'epic', 'Heroic Helmet', '/gifts/heroic_helmet_3.png', 194.3, 'Ancient Gold', 'Black', 'Paw Print', 748),
  nftGift('loot_bag-1', 'Loot Bag', 138600, 'epic', 'Loot Bag', '/gifts/loot_bag_1.png', 138.6, 'Money Bag', 'Onyx Black', 'Heater Shield', 11217),
  nftGift('loot_bag-2', 'Loot Bag', 138600, 'epic', 'Loot Bag', '/gifts/loot_bag_2.png', 138.6, 'Scrooge', 'Black', 'Takoyaki', 7631),
  nftGift('loot_bag-3', 'Loot Bag', 138600, 'epic', 'Loot Bag', '/gifts/loot_bag_3.png', 138.6, 'Liberty', 'Platinum', 'Calm Wolf', 5888),
  nftGift('mighty_arm-1', 'Mighty Arm', 130200, 'epic', 'Mighty Arm', '/gifts/mighty_arm_1.png', 130.2, 'Colossus', 'Rifle Green', 'Fenrir', 3109),
  nftGift('mighty_arm-2', 'Mighty Arm', 130200, 'epic', 'Mighty Arm', '/gifts/mighty_arm_2.png', 130.2, 'Xeno Grip', 'Black', 'Coin Purse', 2289),
  nftGift('mighty_arm-3', 'Mighty Arm', 130200, 'epic', 'Mighty Arm', '/gifts/mighty_arm_3.png', 130.2, 'Gladiator', 'Amber', 'Greek Helmet', 2444),
  nftGift('astral_shard-1', 'Astral Shard', 128100, 'epic', 'Astral Shard', '/gifts/astral_shard_1.png', 128.1, 'Barbed', 'Black', 'Mountain Lion', 5129),
  nftGift('astral_shard-2', 'Astral Shard', 128100, 'epic', 'Astral Shard', '/gifts/astral_shard_2.png', 128.1, 'Ethereal', 'Desert Sand', 'Celtic Wolf', 521),
  nftGift('astral_shard-3', 'Astral Shard', 128100, 'epic', 'Astral Shard', '/gifts/astral_shard_3.png', 128.1, 'Crystal Punk', 'Pacific Cyan', 'Anchor', 2028),
  nftGift('westside_sign-1', 'Westside Sign', 119700, 'epic', 'Westside Sign', '/gifts/westside_sign_1.png', 119.7, 'Gold Ruby', 'Satin Gold', 'Mushroom', 2005),
  nftGift('westside_sign-2', 'Westside Sign', 119700, 'epic', 'Westside Sign', '/gifts/westside_sign_2.png', 119.7, 'Woofee', 'Tomato', 'Kitsune Mask', 169),
  nftGift('westside_sign-3', 'Westside Sign', 119700, 'epic', 'Westside Sign', '/gifts/westside_sign_3.png', 119.7, 'Gold Ruby', 'Pure Gold', 'Snoop Leaf', 650),
  nftGift('mini_oscar-1', 'Mini Oscar', 76700, 'epic', 'Mini Oscar', '/gifts/mini_oscar_1.png', 76.7, 'Seraphim', 'Purple', 'Alarm', 138),
  nftGift('mini_oscar-2', 'Mini Oscar', 76700, 'epic', 'Mini Oscar', '/gifts/mini_oscar_2.png', 76.7, 'Pink Guard', 'Grape', 'Trickster Fox', 2890),
  nftGift('mini_oscar-3', 'Mini Oscar', 76700, 'epic', 'Mini Oscar', '/gifts/mini_oscar_3.png', 76.7, 'Dark Side', 'Platinum', 'Jörmungandr', 3333),
  nftGift('ion_gem-1', 'Ion Gem', 72500, 'epic', 'Ion Gem', '/gifts/ion_gem_1.png', 72.5, 'Barbie', 'Black', 'Love Letter', 555),
  nftGift('ion_gem-2', 'Ion Gem', 72500, 'epic', 'Ion Gem', '/gifts/ion_gem_2.png', 72.5, 'Ice Crystal', 'Black', 'Mustang', 3847),
  nftGift('ion_gem-3', 'Ion Gem', 72500, 'epic', 'Ion Gem', '/gifts/ion_gem_3.png', 72.5, 'Tiberium', 'Black', 'Shinto Shrine', 2689),
  nftGift('low_rider-1', 'Low Rider', 66200, 'epic', 'Low Rider', '/gifts/low_rider_1.png', 66.2, 'Soul Plane', 'Lavender', 'Gem', 16908),
  nftGift('low_rider-2', 'Low Rider', 66200, 'epic', 'Low Rider', '/gifts/low_rider_2.png', 66.2, 'Gold Rush', 'Burgundy', 'Pumpkin Coach', 16593),
  nftGift('low_rider-3', 'Low Rider', 66200, 'epic', 'Low Rider', '/gifts/low_rider_3.png', 66.2, 'First Class', 'Neon Blue', 'Watermelon', 2011),
  nftGift('magic_potion-1', 'Magic Potion', 63000, 'epic', 'Magic Potion', '/gifts/magic_potion_1.png', 63.0, 'Mummify', 'Sky Blue', 'Spooky Cat', 2),
  nftGift('magic_potion-2', 'Magic Potion', 63000, 'epic', 'Magic Potion', '/gifts/magic_potion_2.png', 63.0, 'Supernova', 'Onyx Black', 'Lollipop', 522),
  nftGift('magic_potion-3', 'Magic Potion', 63000, 'epic', 'Magic Potion', '/gifts/magic_potion_3.png', 63.0, 'Agent Orange', 'Black', 'Half Moon', 3396),
  nftGift('swiss_watch-1', 'Swiss Watch', 60900, 'epic', 'Swiss Watch', '/gifts/swiss_watch_1.png', 60.9, 'Day Trader', 'Steel Grey', 'Sprout', 7799),
  nftGift('swiss_watch-2', 'Swiss Watch', 60900, 'epic', 'Swiss Watch', '/gifts/swiss_watch_2.png', 60.9, 'Blue Daytona', 'Black', 'Champagne', 3773),
  nftGift('swiss_watch-3', 'Swiss Watch', 60900, 'epic', 'Swiss Watch', '/gifts/swiss_watch_3.png', 60.9, 'Rockefeller', 'Black', 'Hand of God', 15777),
  nftGift('kissed_frog-1', 'Kissed Frog', 57800, 'epic', 'Kissed Frog', '/gifts/kissed_frog_1.png', 57.8, 'Happy Pepe', 'Lavender', 'Gingerbread', 9666),
  nftGift('kissed_frog-2', 'Kissed Frog', 57800, 'epic', 'Kissed Frog', '/gifts/kissed_frog_2.png', 57.8, 'Lucifrog', 'Black', 'Dessert', 6355),
  nftGift('kissed_frog-3', 'Kissed Frog', 57800, 'epic', 'Kissed Frog', '/gifts/kissed_frog_3.png', 57.8, 'Happy Pepe', 'Pacific Cyan', 'Ice Pop', 7718),
  nftGift('sharp_tongue-1', 'Sharp Tongue', 52500, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_1.png', 52.5, 'Golden Girl', 'Amber', 'Gamepad', 4346),
  nftGift('sharp_tongue-2', 'Sharp Tongue', 52500, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_2.png', 52.5, 'Lady Night', 'Black', 'Treats', 904),
  nftGift('sharp_tongue-3', 'Sharp Tongue', 52500, 'epic', 'Sharp Tongue', '/gifts/sharp_tongue_3.png', 52.5, 'Golden Girl', 'Cyberpunk', 'Cauldron', 2155),
  nftGift('voodoo_doll-1', 'Voodoo Doll', 43100, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_1.png', 43.1, 'Scribble Stab', 'Ivory White', 'Tribal Shield', 5687),
  nftGift('voodoo_doll-2', 'Voodoo Doll', 43100, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_2.png', 43.1, 'Royal Gold', 'Cappuccino', 'Magic Wand', 5888),
  nftGift('voodoo_doll-3', 'Voodoo Doll', 43100, 'rare', 'Voodoo Doll', '/gifts/voodoo_doll_3.png', 43.1, 'Clear Water', 'Black', 'Clubs', 19442),
  nftGift('vintage_cigar-1', 'Vintage Cigar', 41000, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_1.png', 41.0, 'Oil Baron', 'Black', 'Sun Mountain', 15623),
  nftGift('vintage_cigar-2', 'Vintage Cigar', 41000, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_2.png', 41.0, 'Rainbow Road', 'Black', 'Genie Lamp', 4020),
  nftGift('vintage_cigar-3', 'Vintage Cigar', 41000, 'rare', 'Vintage Cigar', '/gifts/vintage_cigar_3.png', 41.0, 'Long Draw', 'Black', 'Mountain Lion', 25557),
  nftGift('signet_ring-1', 'Signet Ring', 37800, 'rare', 'Signet Ring', '/gifts/signet_ring_1.png', 37.8, 'Utya', 'Pure Gold', 'Police Badge', 15921),
  nftGift('signet_ring-2', 'Signet Ring', 37800, 'rare', 'Signet Ring', '/gifts/signet_ring_2.png', 37.8, 'Black Noir', 'Black', 'Okami Wolf', 10272),
  nftGift('signet_ring-3', 'Signet Ring', 37800, 'rare', 'Signet Ring', '/gifts/signet_ring_3.png', 37.8, 'Utya', 'Grape', 'Calm Wolf', 16683),
  nftGift('toy_bear-1', 'Toy Bear', 36800, 'rare', 'Toy Bear', '/gifts/toy_bear_1.png', 36.8, 'Angel', 'Black', 'Baby Bottle', 40000),
  nftGift('toy_bear-2', 'Toy Bear', 36800, 'rare', 'Toy Bear', '/gifts/toy_bear_2.png', 36.8, 'Coral Reef', 'Pistachio', 'Candle', 886),
  nftGift('toy_bear-3', 'Toy Bear', 36800, 'rare', 'Toy Bear', '/gifts/toy_bear_3.png', 36.8, 'Ursa Major', 'Fandango', 'Butterfly', 18111),
  nftGift('khabibs_papakha-1', 'Khabib\'s Papakha', 26300, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_1.png', 26.3, 'Long Curls', 'Black', 'Nordic Wolf', 20735),
  nftGift('khabibs_papakha-2', 'Khabib\'s Papakha', 26300, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_2.png', 26.3, 'Legendary Item', 'Persimmon', 'Dragonfly', 2749),
  nftGift('khabibs_papakha-3', 'Khabib\'s Papakha', 26300, 'rare', 'Khabib\'s Papakha', '/gifts/khabibs_papakha_3.png', 26.3, 'Papakha Swag', 'Black', 'Phoenix', 6817),
  nftGift('mad_pumpkin-1', 'Mad Pumpkin', 18900, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_1.png', 18.9, 'Jigsaw', 'Black', 'Ghost', 4443),
  nftGift('mad_pumpkin-2', 'Mad Pumpkin', 18900, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_2.png', 18.9, 'Red Demon', 'Black', 'Nice Ghost', 12093),
  nftGift('mad_pumpkin-3', 'Mad Pumpkin', 18900, 'rare', 'Mad Pumpkin', '/gifts/mad_pumpkin_3.png', 18.9, 'Squashbuckler', 'Black', 'Flying Witch', 15090),
  nftGift('trapped_heart-1', 'Trapped Heart', 18900, 'rare', 'Trapped Heart', '/gifts/trapped_heart_1.png', 18.9, 'Jinx', 'Black', 'Black Widow', 16970),
  nftGift('trapped_heart-2', 'Trapped Heart', 18900, 'rare', 'Trapped Heart', '/gifts/trapped_heart_2.png', 18.9, 'Abyss Heart', 'Black', 'Ghost', 1684),
  nftGift('trapped_heart-3', 'Trapped Heart', 18900, 'rare', 'Trapped Heart', '/gifts/trapped_heart_3.png', 18.9, 'Colorful Beats', 'Black', 'Flying Witch', 4589),
  nftGift('snoop_cigar-1', 'Snoop Cigar', 16800, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_1.png', 16.8, 'Dolla Rolla', 'Indigo Dye', 'Cash', 41075),
  nftGift('snoop_cigar-2', 'Snoop Cigar', 16800, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_2.png', 16.8, 'Doggystyle', 'Black', 'Full Moon', 8744),
  nftGift('snoop_cigar-3', 'Snoop Cigar', 16800, 'rare', 'Snoop Cigar', '/gifts/snoop_cigar_3.png', 16.8, 'Happy Face', 'Caramel', 'War Tiger', 88888),
  nftGift('love_potion-1', 'Love Potion', 16800, 'rare', 'Love Potion', '/gifts/love_potion_1.png', 16.8, 'No Signal', 'Electric Purple', 'Love Cherry', 12363),
  nftGift('love_potion-2', 'Love Potion', 16800, 'rare', 'Love Potion', '/gifts/love_potion_2.png', 16.8, 'Spades', 'Black', 'Jewel', 19851),
  nftGift('love_potion-3', 'Love Potion', 16800, 'rare', 'Love Potion', '/gifts/love_potion_3.png', 16.8, 'No Signal', 'Fandango', 'Wine Toast', 19985),
  nftGift('crystal_ball-1', 'Crystal Ball', 14700, 'rare', 'Crystal Ball', '/gifts/crystal_ball_1.png', 14.7, 'Fortune', 'Amber', 'Potion', 7446),
  nftGift('crystal_ball-2', 'Crystal Ball', 14700, 'rare', 'Crystal Ball', '/gifts/crystal_ball_2.png', 14.7, 'Lady Death', 'Black', 'Mushroom', 26451),
  nftGift('crystal_ball-3', 'Crystal Ball', 14700, 'rare', 'Crystal Ball', '/gifts/crystal_ball_3.png', 14.7, 'Fatal Error', 'Black', 'Candle', 7968),
  nftGift('jingle_bell-1', 'Jingle Bell', 12600, 'rare', 'Jingle Bell', '/gifts/jingle_bell_1.png', 12.6, 'Red Petals', 'Amber', 'Jingle Bell', 8888),
  nftGift('jingle_bell-2', 'Jingle Bell', 12600, 'rare', 'Jingle Bell', '/gifts/jingle_bell_2.png', 12.6, 'Hot Cherry', 'Fandango', 'Ice Skates', 10090),
  nftGift('jingle_bell-3', 'Jingle Bell', 12600, 'rare', 'Jingle Bell', '/gifts/jingle_bell_3.png', 12.6, 'Launchpad', 'Black', 'Bowtie', 4435),
  nftGift('witch_hat-1', 'Witch Hat', 10600, 'rare', 'Witch Hat', '/gifts/witch_hat_1.png', 10.6, 'Obi-Wan', 'Black', 'Illuminati', 12200),
  nftGift('witch_hat-2', 'Witch Hat', 10600, 'rare', 'Witch Hat', '/gifts/witch_hat_2.png', 10.6, 'Narnia', 'Black', 'Bloody Axe', 16876),
  nftGift('witch_hat-3', 'Witch Hat', 10600, 'rare', 'Witch Hat', '/gifts/witch_hat_3.png', 10.6, 'Bat Swarm', 'Black', 'Crow', 36852),
  nftGift('fine_pen-1', 'Fine Pen', 9800, 'common', 'Fine Pen', '/gifts/fine_pen_1.png', 9.8, 'Signature Scribe', 'Black', 'Jörmungandr', 2170),
  nftGift('fine_pen-2', 'Fine Pen', 9800, 'common', 'Fine Pen', '/gifts/fine_pen_2.png', 9.8, 'Tsar Gold', 'Indigo Dye', 'Hersir', 33333),
  nftGift('fine_pen-3', 'Fine Pen', 9800, 'common', 'Fine Pen', '/gifts/fine_pen_3.png', 9.8, 'Firebird', 'Fire Engine', 'Bull of Heaven', 21079),
  nftGift('jolly_chimp-1', 'Jolly Chimp', 8900, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_1.png', 8.9, 'Genie', 'Black', 'Seahorse', 14010),
  nftGift('jolly_chimp-2', 'Jolly Chimp', 8900, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_2.png', 8.9, 'Grayscale', 'Black', 'Bottlenose', 7143),
  nftGift('jolly_chimp-3', 'Jolly Chimp', 8900, 'common', 'Jolly Chimp', '/gifts/jolly_chimp_3.png', 8.9, 'Bank Robber', 'Deep Cyan', 'Bandana', 92465),
  nftGift('surge_board-1', 'Surge Board', 8200, 'common', 'Surge Board', '/gifts/surge_board_1.png', 8.2, 'Pepe Surfer', 'Purple', 'Basketball', 12656),
  nftGift('surge_board-2', 'Surge Board', 8200, 'common', 'Surge Board', '/gifts/surge_board_2.png', 8.2, 'Oracle', 'Mystic Pearl', 'UFO', 16888),
  nftGift('surge_board-3', 'Surge Board', 8200, 'common', 'Surge Board', '/gifts/surge_board_3.png', 8.2, 'Balls of Steel', 'Silver Blue', 'Shell', 1690),
  nftGift('input_key-1', 'Input Key', 7900, 'common', 'Input Key', '/gifts/input_key_1.png', 7.9, 'Chill Key', 'Indigo Dye', 'PC Mouse', 50549),
  nftGift('input_key-2', 'Input Key', 7900, 'common', 'Input Key', '/gifts/input_key_2.png', 7.9, 'Coffee', 'Black', 'Magic Wand', 22871),
  nftGift('input_key-3', 'Input Key', 7900, 'common', 'Input Key', '/gifts/input_key_3.png', 7.9, 'Bitcoin', 'Black', 'Sauron', 118547),
  nftGift('snoop_dogg-1', 'Snoop Dogg', 7000, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_1.png', 7.0, 'Dapper Doggo', 'Black', 'Shell', 55555),
  nftGift('snoop_dogg-2', 'Snoop Dogg', 7000, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_2.png', 7.0, 'Black Gold', 'Electric Purple', 'Doberman', 222222),
  nftGift('snoop_dogg-3', 'Snoop Dogg', 7000, 'common', 'Snoop Dogg', '/gifts/snoop_dogg_3.png', 7.0, 'Goldizzle', 'Carmine', 'Viper', 158442),
  nftGift('spring_basket-1', 'Spring Basket', 6900, 'common', 'Spring Basket', '/gifts/spring_basket_1.png', 6.9, 'Meme God', 'Gunmetal', 'Seahorse', 166083),
  nftGift('spring_basket-2', 'Spring Basket', 6900, 'common', 'Spring Basket', '/gifts/spring_basket_2.png', 6.9, 'Meme God', 'Mint Green', 'Cap', 102695),
  nftGift('spring_basket-3', 'Spring Basket', 6900, 'common', 'Spring Basket', '/gifts/spring_basket_3.png', 6.9, 'Balloon Dog', 'Cappuccino', 'Toilet', 33333),
  nftGift('liberty_figure-1', 'Liberty Figure', 6600, 'common', 'Liberty Figure', '/gifts/liberty_figure_1.png', 6.6, 'Astronaut', 'Black', 'Full Moon', 99),
  nftGift('liberty_figure-2', 'Liberty Figure', 6600, 'common', 'Liberty Figure', '/gifts/liberty_figure_2.png', 6.6, 'Obsidian', 'Black', 'Kudu Totem', 36188),
  nftGift('liberty_figure-3', 'Liberty Figure', 6600, 'common', 'Liberty Figure', '/gifts/liberty_figure_3.png', 6.6, 'iFather', 'Pine Green', 'Trickster Fox', 100),
  nftGift('clover_pin-1', 'Clover Pin', 6600, 'common', 'Clover Pin', '/gifts/clover_pin_1.png', 6.6, 'Celtic Knot', 'Lavender', 'Fleur-de-lis', 888),
  nftGift('clover_pin-2', 'Clover Pin', 6600, 'common', 'Clover Pin', '/gifts/clover_pin_2.png', 6.6, 'Kaleidoscope', 'Onyx Black', 'Star Crown', 4902),
  nftGift('clover_pin-3', 'Clover Pin', 6600, 'common', 'Clover Pin', '/gifts/clover_pin_3.png', 6.6, 'Matrix', 'Black', 'Pegasus', 156337),
  nftGift('party_sparkler-1', 'Party Sparkler', 6100, 'common', 'Party Sparkler', '/gifts/party_sparkler_1.png', 6.1, 'Assault', 'Raspberry', 'Gingerbread', 77777),
  nftGift('party_sparkler-2', 'Party Sparkler', 6100, 'common', 'Party Sparkler', '/gifts/party_sparkler_2.png', 6.1, 'Inverted', 'Black', 'Sakura', 136683),
  nftGift('party_sparkler-3', 'Party Sparkler', 6100, 'common', 'Party Sparkler', '/gifts/party_sparkler_3.png', 6.1, 'Marksman', 'Black', 'Brain', 103761),
  nftGift('victory_medal-1', 'Victory Medal', 5900, 'common', 'Victory Medal', '/gifts/victory_medal_1.png', 5.9, 'The Founder', 'Gunship Green', 'Tree of Life', 3554),
  nftGift('victory_medal-2', 'Victory Medal', 5900, 'common', 'Victory Medal', '/gifts/victory_medal_2.png', 5.9, 'The Founder', 'Ranger Green', 'Ribeye Steak', 7873),
  nftGift('victory_medal-3', 'Victory Medal', 5900, 'common', 'Victory Medal', '/gifts/victory_medal_3.png', 5.9, 'Noble Prize', 'Tomato', 'Arabian Horse', 75894),
  nftGift('timeless_book-1', 'Timeless Book', 5700, 'common', 'Timeless Book', '/gifts/timeless_book_1.png', 5.7, 'Death Note', 'Ivory White', 'Cicada', 35375),
  nftGift('timeless_book-2', 'Timeless Book', 5700, 'common', 'Timeless Book', '/gifts/timeless_book_2.png', 5.7, 'Death Note', 'Onyx Black', 'Fried Egg', 36568),
  nftGift('timeless_book-3', 'Timeless Book', 5700, 'common', 'Timeless Book', '/gifts/timeless_book_3.png', 5.7, 'Death Note', 'Rosewood', 'Axe', 59063),
  nftGift('pet_snake-1', 'Pet Snake', 5300, 'common', 'Pet Snake', '/gifts/pet_snake_1.png', 5.3, 'Venomous', 'Battleship Grey', 'Crusader Cross', 8989),
  nftGift('pet_snake-2', 'Pet Snake', 5300, 'common', 'Pet Snake', '/gifts/pet_snake_2.png', 5.3, 'Albino', 'Onyx Black', 'Griffon', 18888),
  nftGift('pet_snake-3', 'Pet Snake', 5300, 'common', 'Pet Snake', '/gifts/pet_snake_3.png', 5.3, 'Pure Gold', 'Amber', 'Pirate Hat', 7323),
  nftGift('whip_cupcake-1', 'Whip Cupcake', 5300, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_1.png', 5.3, 'Blueberry Hill', 'Coral Red', 'Kite', 88),
  nftGift('whip_cupcake-2', 'Whip Cupcake', 5300, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_2.png', 5.3, 'Cherry Top', 'Navy Blue', 'Hourglass', 11),
  nftGift('whip_cupcake-3', 'Whip Cupcake', 5300, 'common', 'Whip Cupcake', '/gifts/whip_cupcake_3.png', 5.3, 'Heaven Seven', 'Black', 'Baphomet', 10701),
  nftGift('ice_cream-1', 'Ice Cream', 5200, 'common', 'Ice Cream', '/gifts/ice_cream_1.png', 5.2, 'BiteCoin', 'Mustard', 'Imperial Lion', 280110),
  nftGift('ice_cream-2', 'Ice Cream', 5200, 'common', 'Ice Cream', '/gifts/ice_cream_2.png', 5.2, 'BiteCoin', 'Black', 'Piggy Bank', 307783),
  nftGift('ice_cream-3', 'Ice Cream', 5200, 'common', 'Ice Cream', '/gifts/ice_cream_3.png', 5.2, 'Stardust', 'Black', 'Grape', 266756),
  nftGift('lol_pop-1', 'Lol Pop', 5200, 'common', 'Lol Pop', '/gifts/lol_pop_1.png', 5.2, 'Prisma', 'Chestnut', 'Wontons', 11111),
  nftGift('lol_pop-2', 'Lol Pop', 5200, 'common', 'Lol Pop', '/gifts/lol_pop_2.png', 5.2, 'Doodle Art', 'Black', 'Thief', 94355),
  nftGift('lol_pop-3', 'Lol Pop', 5200, 'common', 'Lol Pop', '/gifts/lol_pop_3.png', 5.2, 'Pineapple', 'Black', 'Rocket', 47324),
  nftGift('pool_float-1', 'Pool Float', 5200, 'common', 'Pool Float', '/gifts/pool_float_1.png', 5.2, 'Pool Pepe', 'Onyx Black', 'Tribal Shield', 1409),
  nftGift('pool_float-2', 'Pool Float', 5200, 'common', 'Pool Float', '/gifts/pool_float_2.png', 5.2, 'Pool King', 'Black', 'Dagger', 215515),
  nftGift('pool_float-3', 'Pool Float', 5200, 'common', 'Pool Float', '/gifts/pool_float_3.png', 5.2, 'Pool Pepe', 'Pine Green', 'Scarab', 179551),
  nftGift('big_year-1', 'Big Year', 5200, 'common', 'Big Year', '/gifts/big_year_1.png', 5.2, 'Pokeball', 'Onyx Black', 'Baby Bottle', 11599),
  nftGift('big_year-2', 'Big Year', 5200, 'common', 'Big Year', '/gifts/big_year_2.png', 5.2, 'Matrix', 'Black', 'Hazelnut', 64608),
  nftGift('big_year-3', 'Big Year', 5200, 'common', 'Big Year', '/gifts/big_year_3.png', 5.2, 'Qing Dynasty', 'Black', 'Lily', 3903),
  nftGift('xmas_stocking-1', 'Xmas Stocking', 5200, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_1.png', 5.2, 'Morgenstern', 'Black', 'Eggplant', 197253),
  nftGift('xmas_stocking-2', 'Xmas Stocking', 5200, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_2.png', 5.2, 'Gold Mine', 'Black', 'Sun Lion', 13117),
  nftGift('xmas_stocking-3', 'Xmas Stocking', 5200, 'common', 'Xmas Stocking', '/gifts/xmas_stocking_3.png', 5.2, 'Morgenstern', 'Ivory White', 'Stocking', 54876),
  nftGift('chill_flame-1', 'Chill Flame', 5000, 'common', 'Chill Flame', '/gifts/chill_flame_1.png', 5.0, 'The Match', 'Black', 'Ring', 77215),
  nftGift('chill_flame-2', 'Chill Flame', 5000, 'common', 'Chill Flame', '/gifts/chill_flame_2.png', 5.0, 'Satis-fire', 'Raspberry', 'Twin Koi', 113221),
  nftGift('chill_flame-3', 'Chill Flame', 5000, 'common', 'Chill Flame', '/gifts/chill_flame_3.png', 5.0, 'Bull Run', 'Black', 'Star', 416648),
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
  { id: 'sweet', name: 'Sweet', priceMinor: 6000, isNew: true, glow: '#ff8fc7' },
  { id: 'party', name: 'Party', priceMinor: 7000, isNew: true, glow: '#ffd23c' },
  { id: 'cute', name: 'Cute', priceMinor: 8000, isNew: true, glow: '#ffb3d9' },
  { id: 'street', name: 'Street', priceMinor: 10000, isNew: true, glow: '#ff6b3d' },
  { id: 'jewel', name: 'Jewel', priceMinor: 12000, isNew: true, glow: '#5de0ff' },
  { id: 'meme', name: 'Meme', priceMinor: 14000, isNew: true, glow: '#7be35c' },
  { id: 'heroes', name: 'Heroes', priceMinor: 20000, isNew: true, glow: '#ffb02e' },
  { id: 'potion', name: 'Potion', priceMinor: 24000, isNew: true, glow: '#c05cff' },
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

