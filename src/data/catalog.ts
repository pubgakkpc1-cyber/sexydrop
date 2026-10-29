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
  /* --- 120 ПОДЛИННЫХ TELEGRAM NFT С FRAGMENT (Официальные аватары, модели, фоны и флор-цены) --- */
  nftGift('preciouspeach-595', 'Precious Peach #595', 2627000, 'legendary', 'Precious Peach', 'https://nft.fragment.com/gift/preciouspeach-595.large.jpg', 2627.0, 'Spoiled', 'Black', 'Gold', 595),
  nftGift('preciouspeach-2161', 'Precious Peach #2161', 1500000, 'epic', 'Precious Peach', 'https://nft.fragment.com/gift/preciouspeach-2161.large.jpg', 1500.0, 'Cutout', 'Black', 'Stilettos', 2161),
  nftGift('preciouspeach-246', 'Precious Peach #246', 999000, 'epic', 'Precious Peach', 'https://nft.fragment.com/gift/preciouspeach-246.large.jpg', 999.0, 'Twilight', 'Cyberpunk', 'Kitty Cat', 246),
  nftGift('scaredcat-2920', 'Scared Cat #2920', 12500000, 'legendary', 'Scared Cat', 'https://nft.fragment.com/gift/scaredcat-2920.large.jpg', 12500.0, 'Obelisk', 'Onyx Black', 'Voodoo Doll', 2920),
  nftGift('scaredcat-17302', 'Scared Cat #17302', 7777000, 'legendary', 'Scared Cat', 'https://nft.fragment.com/gift/scaredcat-17302.large.jpg', 7777.0, 'Cat Nukem', 'Onyx Black', 'Scarecrow', 17302),
  nftGift('scaredcat-1813', 'Scared Cat #1813', 7777000, 'legendary', 'Scared Cat', 'https://nft.fragment.com/gift/scaredcat-1813.large.jpg', 7777.0, 'Celestia', 'Sapphire', 'Moon', 1813),
  nftGift('plushpepe-1821', 'Plush Pepe #1821', 88888000, 'legendary', 'Plush Pepe', 'https://nft.fragment.com/gift/plushpepe-1821.large.jpg', 88888.0, 'Gummy Frog', 'Platinum', 'Ring', 1821),
  nftGift('plushpepe-1056', 'Plush Pepe #1056', 50000000, 'legendary', 'Plush Pepe', 'https://nft.fragment.com/gift/plushpepe-1056.large.jpg', 50000.0, 'Christmas', 'Black', 'Champagne', 1056),
  nftGift('plushpepe-1515', 'Plush Pepe #1515', 48000000, 'legendary', 'Plush Pepe', 'https://nft.fragment.com/gift/plushpepe-1515.large.jpg', 48000.0, 'Cozy Galaxy', 'Electric Purple', 'Doberman', 1515),
  nftGift('durovscap-1142', 'Durov’s Cap #1142', 6555000, 'legendary', 'Durov\'s Cap', 'https://nft.fragment.com/gift/durovscap-1142.large.jpg', 6555.0, 'Duskwave', 'Black', 'Eagle', 1142),
  nftGift('durovscap-1896', 'Durov’s Cap #1896', 5999000, 'legendary', 'Durov\'s Cap', 'https://nft.fragment.com/gift/durovscap-1896.large.jpg', 5999.0, 'Asterix', 'Electric Indigo', 'Apple', 1896),
  nftGift('durovscap-302', 'Durov’s Cap #302', 3688000, 'legendary', 'Durov\'s Cap', 'https://nft.fragment.com/gift/durovscap-302.large.jpg', 3688.0, 'Artwork', 'Electric Indigo', 'Cursor', 302),
  nftGift('durovsglasses-1305', 'Durov’s Glasses #1305', 555000, 'epic', 'Durov\'s Glasses', 'https://nft.fragment.com/gift/durovsglasses-1305.large.jpg', 555.0, 'Stardust', 'Black', 'Doberman', 1305),
  nftGift('durovsglasses-3677', 'Durov’s Glasses #3677', 555000, 'epic', 'Durov\'s Glasses', 'https://nft.fragment.com/gift/durovsglasses-3677.large.jpg', 555.0, 'Butterfly', 'Black', 'Egg Basket', 3677),
  nftGift('durovsglasses-1924', 'Durov’s Glasses #1924', 449000, 'rare', 'Durov\'s Glasses', 'https://nft.fragment.com/gift/durovsglasses-1924.large.jpg', 449.0, 'TON Vision', 'Fandango', 'Ramen', 1924),
  nftGift('resistancedog-4156', 'Resistance Dog #4156', 1500000, 'epic', 'Resistance Dog', 'https://nft.fragment.com/gift/resistancedog-4156.large.jpg', 1500.0, 'Creeper', 'Midnight Blue', 'Paper Lantern', 4156),
  nftGift('resistancedog-11806', 'Resistance Dog #11806', 1337000, 'epic', 'Resistance Dog', 'https://nft.fragment.com/gift/resistancedog-11806.large.jpg', 1337.0, 'Proxy Server', 'Steel Grey', 'Lion of Babylon', 11806),
  nftGift('resistancedog-1440', 'Resistance Dog #1440', 1000000, 'epic', 'Resistance Dog', 'https://nft.fragment.com/gift/resistancedog-1440.large.jpg', 1000.0, 'Ultras', 'Satin Gold', 'Shinto Shrine', 1440),
  nftGift('magicpotion-2', 'Magic Potion #2', 700000, 'epic', 'Magic Potion', 'https://nft.fragment.com/gift/magicpotion-2.large.jpg', 700.0, 'Mummify', 'Sky Blue', 'Spooky Cat', 2),
  nftGift('magicpotion-522', 'Magic Potion #522', 225000, 'rare', 'Magic Potion', 'https://nft.fragment.com/gift/magicpotion-522.large.jpg', 225.0, 'Supernova', 'Onyx Black', 'Lollipop', 522),
  nftGift('magicpotion-3396', 'Magic Potion #3396', 200000, 'rare', 'Magic Potion', 'https://nft.fragment.com/gift/magicpotion-3396.large.jpg', 200.0, 'Agent Orange', 'Black', 'Half Moon', 3396),
  nftGift('crystalball-7446', 'Crystal Ball #7446', 230000, 'rare', 'Crystal Ball', 'https://nft.fragment.com/gift/crystalball-7446.large.jpg', 230.0, 'Fortune', 'Amber', 'Potion', 7446),
  nftGift('crystalball-26451', 'Crystal Ball #26451', 222000, 'rare', 'Crystal Ball', 'https://nft.fragment.com/gift/crystalball-26451.large.jpg', 222.0, 'Lady Death', 'Black', 'Mushroom', 26451),
  nftGift('crystalball-7968', 'Crystal Ball #7968', 145000, 'common', 'Crystal Ball', 'https://nft.fragment.com/gift/crystalball-7968.large.jpg', 145.0, 'Fatal Error', 'Black', 'Candle', 7968),
  nftGift('hexpot-14463', 'Hex Pot #14463', 190000, 'rare', 'Hex Pot', 'https://nft.fragment.com/gift/hexpot-14463.large.jpg', 190.0, 'Backstroke', 'Black', 'Witch’s Hat', 14463),
  nftGift('hexpot-11', 'Hex Pot #11', 80000, 'common', 'Hex Pot', 'https://nft.fragment.com/gift/hexpot-11.large.jpg', 80.0, 'Amethyst', 'Desert Sand', 'Bloody Axe', 11),
  nftGift('hexpot-8848', 'Hex Pot #8848', 80000, 'common', 'Hex Pot', 'https://nft.fragment.com/gift/hexpot-8848.large.jpg', 80.0, 'Burnt Roses', 'Black', 'Blood Drop', 8848),
  nftGift('voodoodoll-5687', 'Voodoo Doll #5687', 3333000, 'legendary', 'Voodoo Doll', 'https://nft.fragment.com/gift/voodoodoll-5687.large.jpg', 3333.0, 'Scribble Stab', 'Ivory White', 'Tribal Shield', 5687),
  nftGift('voodoodoll-5888', 'Voodoo Doll #5888', 1234000, 'epic', 'Voodoo Doll', 'https://nft.fragment.com/gift/voodoodoll-5888.large.jpg', 1234.0, 'Royal Gold', 'Cappuccino', 'Magic Wand', 5888),
  nftGift('voodoodoll-19442', 'Voodoo Doll #19442', 888000, 'epic', 'Voodoo Doll', 'https://nft.fragment.com/gift/voodoodoll-19442.large.jpg', 888.0, 'Clear Water', 'Black', 'Clubs', 19442),
  nftGift('stellarrocket-1674', 'Stellar Rocket #1674', 1200000, 'epic', 'Stellar Rocket', 'https://nft.fragment.com/gift/stellarrocket-1674.large.jpg', 1200.0, 'Telegram', 'Black', 'Evil Dragon', 1674),
  nftGift('stellarrocket-86757', 'Stellar Rocket #86757', 757000, 'epic', 'Stellar Rocket', 'https://nft.fragment.com/gift/stellarrocket-86757.large.jpg', 757.0, 'Mission Uranus', 'Seal Brown', 'Telescope', 86757),
  nftGift('stellarrocket-25985', 'Stellar Rocket #25985', 299000, 'rare', 'Stellar Rocket', 'https://nft.fragment.com/gift/stellarrocket-25985.large.jpg', 299.0, 'Bitcoin', 'Grape', 'Academic Cap', 25985),
  nftGift('astralshard-5129', 'Astral Shard #5129', 3222000, 'legendary', 'Astral Shard', 'https://nft.fragment.com/gift/astralshard-5129.large.jpg', 3222.0, 'Barbed', 'Black', 'Mountain Lion', 5129),
  nftGift('astralshard-521', 'Astral Shard #521', 521000, 'epic', 'Astral Shard', 'https://nft.fragment.com/gift/astralshard-521.large.jpg', 521.0, 'Ethereal', 'Desert Sand', 'Celtic Wolf', 521),
  nftGift('astralshard-2028', 'Astral Shard #2028', 500000, 'epic', 'Astral Shard', 'https://nft.fragment.com/gift/astralshard-2028.large.jpg', 500.0, 'Crystal Punk', 'Pacific Cyan', 'Anchor', 2028),
  nftGift('hangingstar-9369', 'Hanging Star #9369', 1000000, 'epic', 'Hanging Star', 'https://nft.fragment.com/gift/hangingstar-9369.large.jpg', 1000.0, 'Shamrock', 'Black', 'Coin Purse', 9369),
  nftGift('hangingstar-34567', 'Hanging Star #34567', 345000, 'rare', 'Hanging Star', 'https://nft.fragment.com/gift/hangingstar-34567.large.jpg', 345.0, 'Poached Egg', 'Onyx Black', 'Stocking', 34567),
  nftGift('hangingstar-1340', 'Hanging Star #1340', 289000, 'rare', 'Hanging Star', 'https://nft.fragment.com/gift/hangingstar-1340.large.jpg', 289.0, 'Magma', 'Black', 'Bread', 1340),
  nftGift('swisswatch-7799', 'Swiss Watch #7799', 13588000, 'legendary', 'Swiss Watch', 'https://nft.fragment.com/gift/swisswatch-7799.large.jpg', 13588.0, 'Day Trader', 'Steel Grey', 'Sprout', 7799),
  nftGift('swisswatch-3773', 'Swiss Watch #3773', 3555000, 'legendary', 'Swiss Watch', 'https://nft.fragment.com/gift/swisswatch-3773.large.jpg', 3555.0, 'Blue Daytona', 'Black', 'Champagne', 3773),
  nftGift('swisswatch-15777', 'Swiss Watch #15777', 2777000, 'legendary', 'Swiss Watch', 'https://nft.fragment.com/gift/swisswatch-15777.large.jpg', 2777.0, 'Rockefeller', 'Black', 'Hand of God', 15777),
  nftGift('lootbag-11217', 'Loot Bag #11217', 11111000, 'legendary', 'Loot Bag', 'https://nft.fragment.com/gift/lootbag-11217.large.jpg', 11111.0, 'Money Bag', 'Onyx Black', 'Heater Shield', 11217),
  nftGift('lootbag-7631', 'Loot Bag #7631', 11111000, 'legendary', 'Loot Bag', 'https://nft.fragment.com/gift/lootbag-7631.large.jpg', 11111.0, 'Scrooge', 'Black', 'Takoyaki', 7631),
  nftGift('lootbag-5888', 'Loot Bag #5888', 5888000, 'legendary', 'Loot Bag', 'https://nft.fragment.com/gift/lootbag-5888.large.jpg', 5888.0, 'Liberty', 'Platinum', 'Calm Wolf', 5888),
  nftGift('vintagecigar-15623', 'Vintage Cigar #15623', 5050000, 'legendary', 'Vintage Cigar', 'https://nft.fragment.com/gift/vintagecigar-15623.large.jpg', 5050.0, 'Oil Baron', 'Black', 'Sun Mountain', 15623),
  nftGift('vintagecigar-4020', 'Vintage Cigar #4020', 777000, 'epic', 'Vintage Cigar', 'https://nft.fragment.com/gift/vintagecigar-4020.large.jpg', 777.0, 'Rainbow Road', 'Black', 'Genie Lamp', 4020),
  nftGift('vintagecigar-25557', 'Vintage Cigar #25557', 755000, 'epic', 'Vintage Cigar', 'https://nft.fragment.com/gift/vintagecigar-25557.large.jpg', 755.0, 'Long Draw', 'Black', 'Mountain Lion', 25557),
  nftGift('perfumebottle-32', 'Perfume Bottle #32', 889000, 'epic', 'Perfume Bottle', 'https://nft.fragment.com/gift/perfumebottle-32.large.jpg', 889.0, 'Venom Mist', 'Black', 'Coin Purse', 32),
  nftGift('perfumebottle-672', 'Perfume Bottle #672', 495000, 'rare', 'Perfume Bottle', 'https://nft.fragment.com/gift/perfumebottle-672.large.jpg', 495.0, 'Solar Eclipse', 'Black', 'Lips', 672),
  nftGift('perfumebottle-3618', 'Perfume Bottle #3618', 444000, 'rare', 'Perfume Bottle', 'https://nft.fragment.com/gift/perfumebottle-3618.large.jpg', 444.0, 'Sketch Shade', 'Steel Grey', 'Lovely Key', 3618),
  nftGift('freshsocks-141858', 'Fresh Socks #141858', 500000, 'epic', 'Fresh Socks', 'https://nft.fragment.com/gift/freshsocks-141858.large.jpg', 500.0, 'Foundation', 'Onyx Black', 'Fluffy Wolf', 141858),
  nftGift('freshsocks-84442', 'Fresh Socks #84442', 166000, 'rare', 'Fresh Socks', 'https://nft.fragment.com/gift/freshsocks-84442.large.jpg', 166.0, 'Trader', 'Black', 'Scarab', 84442),
  nftGift('freshsocks-158307', 'Fresh Socks #158307', 80000, 'common', 'Fresh Socks', 'https://nft.fragment.com/gift/freshsocks-158307.large.jpg', 80.0, 'Gunk Fight', 'Black', 'Wise Raven', 158307),
  nftGift('instantramen-342665', 'Instant Ramen #342665', 239000, 'rare', 'Instant Ramen', 'https://nft.fragment.com/gift/instantramen-342665.large.jpg', 239.0, 'Bitcoins', 'Black', 'Pyramid', 342665),
  nftGift('instantramen-119368', 'Instant Ramen #119368', 220000, 'rare', 'Instant Ramen', 'https://nft.fragment.com/gift/instantramen-119368.large.jpg', 220.0, 'Diamonds', 'Black', 'Corn', 119368),
  nftGift('instantramen-7238', 'Instant Ramen #7238', 180000, 'rare', 'Instant Ramen', 'https://nft.fragment.com/gift/instantramen-7238.large.jpg', 180.0, 'Jade Dragon', 'Neon Blue', 'Candy', 7238),
  nftGift('heartlocket-875', 'Heart Locket #875', 12733880, 'legendary', 'Heart Locket', 'https://nft.fragment.com/gift/heartlocket-875.large.jpg', 12733.88, 'Turtles', 'Lemongrass', 'Like', 875),
  nftGift('heartlocket-65', 'Heart Locket #65', 2950000, 'legendary', 'Heart Locket', 'https://nft.fragment.com/gift/heartlocket-65.large.jpg', 2950.0, 'Black Hole', 'Electric Indigo', 'Anchor', 65),
  nftGift('heartlocket-1882', 'Heart Locket #1882', 2700000, 'legendary', 'Heart Locket', 'https://nft.fragment.com/gift/heartlocket-1882.large.jpg', 2700.0, 'Spider Web', 'Neon Blue', 'Melon', 1882),
  nftGift('diamondring-27070', 'Diamond Ring #27070', 1050000, 'epic', 'Diamond Ring', 'https://nft.fragment.com/gift/diamondring-27070.large.jpg', 1050.0, 'Black Hole', 'Black', 'Rabbit Mask', 27070),
  nftGift('diamondring-6789', 'Diamond Ring #6789', 777000, 'epic', 'Diamond Ring', 'https://nft.fragment.com/gift/diamondring-6789.large.jpg', 777.0, 'Orion', 'Khaki Green', 'Takoyaki', 6789),
  nftGift('diamondring-31174', 'Diamond Ring #31174', 499000, 'rare', 'Diamond Ring', 'https://nft.fragment.com/gift/diamondring-31174.large.jpg', 499.0, 'Royal Purple', 'Black', 'Broken Heart', 31174),
  nftGift('snoopdogg-55555', 'Snoop Dogg #55555', 1000000, 'epic', 'Snoop Dogg', 'https://nft.fragment.com/gift/snoopdogg-55555.large.jpg', 1000.0, 'Dapper Doggo', 'Black', 'Shell', 55555),
  nftGift('snoopdogg-222222', 'Snoop Dogg #222222', 666000, 'epic', 'Snoop Dogg', 'https://nft.fragment.com/gift/snoopdogg-222222.large.jpg', 666.0, 'Black Gold', 'Electric Purple', 'Doberman', 222222),
  nftGift('snoopdogg-158442', 'Snoop Dogg #158442', 654000, 'epic', 'Snoop Dogg', 'https://nft.fragment.com/gift/snoopdogg-158442.large.jpg', 654.0, 'Goldizzle', 'Carmine', 'Viper', 158442),
  nftGift('snoopcigar-41075', 'Snoop Cigar #41075', 4200000, 'legendary', 'Snoop Cigar', 'https://nft.fragment.com/gift/snoopcigar-41075.large.jpg', 4200.0, 'Dolla Rolla', 'Indigo Dye', 'Cash', 41075),
  nftGift('snoopcigar-8744', 'Snoop Cigar #8744', 999000, 'epic', 'Snoop Cigar', 'https://nft.fragment.com/gift/snoopcigar-8744.large.jpg', 999.0, 'Doggystyle', 'Black', 'Full Moon', 8744),
  nftGift('snoopcigar-18666', 'Snoop Cigar #18666', 888000, 'epic', 'Snoop Cigar', 'https://nft.fragment.com/gift/snoopcigar-18666.large.jpg', 888.0, 'Doggystyle', 'Black', 'Deerstalker', 18666),
  nftGift('sakuraflower-49643', 'Sakura Flower #49643', 6753000, 'legendary', 'Sakura Flower', 'https://nft.fragment.com/gift/sakuraflower-49643.large.jpg', 6753.0, 'Flowey', 'Black', 'Paper Crane', 49643),
  nftGift('sakuraflower-22114', 'Sakura Flower #22114', 888000, 'epic', 'Sakura Flower', 'https://nft.fragment.com/gift/sakuraflower-22114.large.jpg', 888.0, 'Bubblia', 'Fandango', 'Heart', 22114),
  nftGift('sakuraflower-60650', 'Sakura Flower #60650', 777000, 'epic', 'Sakura Flower', 'https://nft.fragment.com/gift/sakuraflower-60650.large.jpg', 777.0, 'Peony', 'Fandango', 'Heart', 60650),
  nftGift('spyagaric-68695', 'Spy Agaric #68695', 2345000, 'legendary', 'Spy Agaric', 'https://nft.fragment.com/gift/spyagaric-68695.large.jpg', 2345.0, 'Monoshroom', 'Black', 'Human Scull', 68695),
  nftGift('spyagaric-45464', 'Spy Agaric #45464', 199000, 'rare', 'Spy Agaric', 'https://nft.fragment.com/gift/spyagaric-45464.large.jpg', 199.0, 'Monoshroom', 'Black', 'Lion King', 45464),
  nftGift('spyagaric-38214', 'Spy Agaric #38214', 170000, 'rare', 'Spy Agaric', 'https://nft.fragment.com/gift/spyagaric-38214.large.jpg', 170.0, 'Miner’s Bloom', 'Black', 'Candy', 38214),
  nftGift('candycane-49040', 'Candy Cane #49040', 200000, 'rare', 'Candy Cane', 'https://nft.fragment.com/gift/candycane-49040.large.jpg', 200.0, 'Grinch', 'Black', 'Sparks', 49040),
  nftGift('candycane-99999', 'Candy Cane #99999', 200000, 'rare', 'Candy Cane', 'https://nft.fragment.com/gift/candycane-99999.large.jpg', 200.0, 'Sweet Deal', 'Celtic Blue', 'Guitar', 99999),
  nftGift('candycane-22', 'Candy Cane #22', 100000, 'common', 'Candy Cane', 'https://nft.fragment.com/gift/candycane-22.large.jpg', 100.0, 'Sugar Crush', 'Pure Gold', 'Eikthyrnir', 22),
  nftGift('lushbouquet-32747', 'Lush Bouquet #32747', 777000, 'epic', 'Lush Bouquet', 'https://nft.fragment.com/gift/lushbouquet-32747.large.jpg', 777.0, 'Million Roses', 'Ivory White', 'Pawn', 32747),
  nftGift('lushbouquet-3888', 'Lush Bouquet #3888', 555000, 'epic', 'Lush Bouquet', 'https://nft.fragment.com/gift/lushbouquet-3888.large.jpg', 555.0, 'Million Roses', 'Rosewood', 'Cyclamen', 3888),
  nftGift('lushbouquet-25647', 'Lush Bouquet #25647', 400000, 'rare', 'Lush Bouquet', 'https://nft.fragment.com/gift/lushbouquet-25647.large.jpg', 400.0, 'Million Roses', 'Platinum', 'Gift Box', 25647),
  nftGift('jesterhat-103837', 'Jester Hat #103837', 250000, 'rare', 'Jester Hat', 'https://nft.fragment.com/gift/jesterhat-103837.large.jpg', 250.0, 'Sketchy', 'Black', 'Gift Box', 103837),
  nftGift('jesterhat-141899', 'Jester Hat #141899', 225000, 'rare', 'Jester Hat', 'https://nft.fragment.com/gift/jesterhat-141899.large.jpg', 225.0, 'Neon White', 'Black', 'Moon', 141899),
  nftGift('jesterhat-120006', 'Jester Hat #120006', 215000, 'rare', 'Jester Hat', 'https://nft.fragment.com/gift/jesterhat-120006.large.jpg', 215.0, 'Neon White', 'Black', 'Pencil', 120006),
  nftGift('lolpop-11111', 'Lol Pop #11111', 400000, 'rare', 'Lol Pop', 'https://nft.fragment.com/gift/lolpop-11111.large.jpg', 400.0, 'Prisma', 'Chestnut', 'Wontons', 11111),
  nftGift('lolpop-94355', 'Lol Pop #94355', 333000, 'rare', 'Lol Pop', 'https://nft.fragment.com/gift/lolpop-94355.large.jpg', 333.0, 'Doodle Art', 'Black', 'Thief', 94355),
  nftGift('lolpop-47324', 'Lol Pop #47324', 215000, 'rare', 'Lol Pop', 'https://nft.fragment.com/gift/lolpop-47324.large.jpg', 215.0, 'Pineapple', 'Black', 'Rocket', 47324),
  nftGift('bdaycandle-223838', 'B-Day Candle #223838', 100000, 'common', 'Birthday Candle', 'https://nft.fragment.com/gift/bdaycandle-223838.large.jpg', 100.0, 'Old Cartoon', 'Black', 'Cheese', 223838),
  nftGift('bdaycandle-220304', 'B-Day Candle #220304', 99000, 'common', 'Birthday Candle', 'https://nft.fragment.com/gift/bdaycandle-220304.large.jpg', 99.0, 'Payday', 'Turquoise', 'Cash', 220304),
  nftGift('bdaycandle-360', 'B-Day Candle #360', 65000, 'common', 'Birthday Candle', 'https://nft.fragment.com/gift/bdaycandle-360.large.jpg', 65.0, 'Superstar', 'Platinum', 'Cone', 360),
  nftGift('homemadecake-66', 'Homemade Cake #66', 130000, 'common', 'Homemade Cake', 'https://nft.fragment.com/gift/homemadecake-66.large.jpg', 130.0, 'French Yogurt', 'Ivory White', 'Cheese', 66),
  nftGift('homemadecake-99999', 'Homemade Cake #99999', 99000, 'common', 'Homemade Cake', 'https://nft.fragment.com/gift/homemadecake-99999.large.jpg', 99.0, 'Angel Cake', 'Onyx Black', 'Croissant', 99999),
  nftGift('homemadecake-56789', 'Homemade Cake #56789', 78000, 'common', 'Homemade Cake', 'https://nft.fragment.com/gift/homemadecake-56789.large.jpg', 78.0, 'Sweet  Lilac', 'Emerald', 'Moon Eagle', 56789),
  nftGift('jellybunny-11111', 'Jelly Bunny #11111', 300000, 'rare', 'Jelly Bunny', 'https://nft.fragment.com/gift/jellybunny-11111.large.jpg', 300.0, 'Melted Ice', 'Ivory White', 'Mountain Goat', 11111),
  nftGift('jellybunny-94830', 'Jelly Bunny #94830', 300000, 'rare', 'Jelly Bunny', 'https://nft.fragment.com/gift/jellybunny-94830.large.jpg', 300.0, 'Jevil', 'Onyx Black', 'Unicorn Head', 94830),
  nftGift('jellybunny-12698', 'Jelly Bunny #12698', 190000, 'rare', 'Jelly Bunny', 'https://nft.fragment.com/gift/jellybunny-12698.large.jpg', 190.0, 'Corporate', 'Black', 'Star', 12698),
  nftGift('minioscar-138', 'Mini Oscar #138', 10000000, 'legendary', 'Mini Oscar', 'https://nft.fragment.com/gift/minioscar-138.large.jpg', 10000.0, 'Seraphim', 'Purple', 'Alarm', 138),
  nftGift('minioscar-2890', 'Mini Oscar #2890', 800000, 'epic', 'Mini Oscar', 'https://nft.fragment.com/gift/minioscar-2890.large.jpg', 800.0, 'Pink Guard', 'Grape', 'Trickster Fox', 2890),
  nftGift('minioscar-3333', 'Mini Oscar #3333', 480000, 'rare', 'Mini Oscar', 'https://nft.fragment.com/gift/minioscar-3333.large.jpg', 480.0, 'Dark Side', 'Platinum', 'Jörmungandr', 3333),
  nftGift('trappedheart-16970', 'Trapped Heart #16970', 400000, 'rare', 'Trapped Heart', 'https://nft.fragment.com/gift/trappedheart-16970.large.jpg', 400.0, 'Jinx', 'Black', 'Black Widow', 16970),
  nftGift('trappedheart-1684', 'Trapped Heart #1684', 333000, 'rare', 'Trapped Heart', 'https://nft.fragment.com/gift/trappedheart-1684.large.jpg', 333.0, 'Abyss Heart', 'Black', 'Ghost', 1684),
  nftGift('trappedheart-4589', 'Trapped Heart #4589', 222000, 'rare', 'Trapped Heart', 'https://nft.fragment.com/gift/trappedheart-4589.large.jpg', 222.0, 'Colorful Beats', 'Black', 'Flying Witch', 4589),
  nftGift('nekohelmet-1244', 'Neko Helmet #1244', 888000, 'epic', 'Neko Helmet', 'https://nft.fragment.com/gift/nekohelmet-1244.large.jpg', 888.0, 'Astronaut', 'Black', 'Sushi Rolls', 1244),
  nftGift('nekohelmet-10426', 'Neko Helmet #10426', 700000, 'epic', 'Neko Helmet', 'https://nft.fragment.com/gift/nekohelmet-10426.large.jpg', 700.0, 'Turbo Frog', 'Amber', 'Hazelnut', 10426),
  nftGift('nekohelmet-2222', 'Neko Helmet #2222', 660000, 'epic', 'Neko Helmet', 'https://nft.fragment.com/gift/nekohelmet-2222.large.jpg', 660.0, 'Princess', 'Shamrock Green', 'Diamond', 2222),
  nftGift('tophat-88', 'Top Hat #88', 550000, 'epic', 'Top Hat', 'https://nft.fragment.com/gift/tophat-88.large.jpg', 550.0, 'Golden Ratio', 'Turquoise', 'Scorpion', 88),
  nftGift('tophat-9068', 'Top Hat #9068', 350000, 'rare', 'Top Hat', 'https://nft.fragment.com/gift/tophat-9068.large.jpg', 350.0, 'Pixel Perfect', 'Platinum', 'Cicada', 9068),
  nftGift('tophat-2121', 'Top Hat #2121', 300000, 'rare', 'Top Hat', 'https://nft.fragment.com/gift/tophat-2121.large.jpg', 300.0, 'Victorian Era', 'Black', 'Kitsune Mask', 2121),
  nftGift('toybear-40000', 'Toy Bear #40000', 2000000, 'legendary', 'Toy Bear', 'https://nft.fragment.com/gift/toybear-40000.large.jpg', 2000.0, 'Angel', 'Black', 'Baby Bottle', 40000),
  nftGift('toybear-886', 'Toy Bear #886', 885999, 'epic', 'Toy Bear', 'https://nft.fragment.com/gift/toybear-886.large.jpg', 885.999, 'Coral Reef', 'Pistachio', 'Candle', 886),
  nftGift('toybear-18111', 'Toy Bear #18111', 666000, 'epic', 'Toy Bear', 'https://nft.fragment.com/gift/toybear-18111.large.jpg', 666.0, 'Ursa Major', 'Fandango', 'Butterfly', 18111),
  nftGift('electricskull-8193', 'Electric Skull #8193', 479000, 'rare', 'Electric Skull', 'https://nft.fragment.com/gift/electricskull-8193.large.jpg', 479.0, 'Hellfire', 'Black', 'Trinity Knot', 8193),
  nftGift('electricskull-7480', 'Electric Skull #7480', 400000, 'rare', 'Electric Skull', 'https://nft.fragment.com/gift/electricskull-7480.large.jpg', 400.0, 'Bad Fortune', 'Amber', 'Fish', 7480),
  nftGift('electricskull-5965', 'Electric Skull #5965', 399000, 'rare', 'Electric Skull', 'https://nft.fragment.com/gift/electricskull-5965.large.jpg', 399.0, 'Nightmare', 'Mexican Pink', 'Inca Sun', 5965),
  nftGift('lunarsnake-111111', 'Lunar Snake #111111', 150000, 'rare', 'Lunar Snake', 'https://nft.fragment.com/gift/lunarsnake-111111.large.jpg', 150.0, 'Vibrant Venom', 'Desert Sand', 'Star', 111111),
  nftGift('lunarsnake-56789', 'Lunar Snake #56789', 120000, 'common', 'Lunar Snake', 'https://nft.fragment.com/gift/lunarsnake-56789.large.jpg', 120.0, 'Redstone', 'Cobalt Blue', 'Eggplant', 56789),
  nftGift('lunarsnake-22', 'Lunar Snake #22', 99000, 'common', 'Lunar Snake', 'https://nft.fragment.com/gift/lunarsnake-22.large.jpg', 99.0, 'Straciatella', 'Carrot Juice', 'UFO', 22),
  nftGift('lightsword-37990', 'Light Sword #37990', 333000, 'rare', 'Light Sword', 'https://nft.fragment.com/gift/lightsword-37990.large.jpg', 333.0, 'Polygon', 'Pacific Cyan', 'Apple', 37990),
  nftGift('lightsword-94064', 'Light Sword #94064', 333000, 'rare', 'Light Sword', 'https://nft.fragment.com/gift/lightsword-94064.large.jpg', 333.0, 'Wrath of Vader', 'Fandango', 'Beret', 94064),
  nftGift('lightsword-88888', 'Light Sword #88888', 285000, 'rare', 'Light Sword', 'https://nft.fragment.com/gift/lightsword-88888.large.jpg', 285.0, 'Double Time', 'Grape', 'The Eye', 88888),



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

  { id: 'magic', name: 'Magic', priceMinor: 5000, glow: '#a855f7' },

  { id: 'kitty', name: 'Kitty', priceMinor: 5000, glow: '#ff7ad9' },

  { id: 'space', name: 'Space', priceMinor: 6000, glow: '#8b5cf6' },

  { id: 'adult18', name: '18+', priceMinor: 7000, glow: '#ff4d6d' },

  { id: 'snoop', name: 'Snoop', priceMinor: 7770, glow: '#ffc93c' },

  { id: 'money', name: 'Money', priceMinor: 8000, glow: '#2fbf6a' },

  { id: 'onyx-black', name: 'Onyx Black', priceMinor: 8000, glow: '#7c5cff' },

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

  // Слева: FREE 24 (ежедневный без заданий, сброс в 23:00 МСК)

  caseDefinition('free24', 'FREE 24', 0, false, FREE_COOLDOWNS.free24, '#ffc93c'),

  // Справа: FREE (с заданием на 5 TG Premium друзей, сброс в 23:00 МСК)

  caseDefinition('free', 'FREE', 0, false, FREE_COOLDOWNS.free, '#b7a4f9'),

]



export const paidCases: readonly CaseDefinition[] = [...cases.filter((c) => c.freeCooldownMs === null)].sort((a, b) => a.priceMinor - b.priceMinor)







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

