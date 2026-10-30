import json
import os

with open('public/gifts/nft_manifest.json', 'r', encoding='utf-8') as f:
    manifest = json.load(f)

with open('scripts/case_weights.json', 'r', encoding='utf-8') as f:
    case_weights = json.load(f)

# 1. Generate src/data/caseWeights.generated.ts
weights_ts = """/**
 * СГЕНЕРИРОВАНО скриптом `scripts/generate_catalog_and_weights.py` — не редактировать вручную.
 * Строгое соответствие RTP 98% (EV-solver).
 */
export const caseWeights: Readonly<Record<string, ReadonlyArray<readonly [string, number]>>> = {\n"""

for case_id, entries in case_weights.items():
    formatted_entries = ", ".join(f"['{item}', {w}]" for item, w in entries)
    weights_ts += f"  '{case_id}': [{formatted_entries}],\n"

weights_ts += "}\n"

with open('src/data/caseWeights.generated.ts', 'w', encoding='utf-8') as f:
    f.write(weights_ts)
print("Updated src/data/caseWeights.generated.ts")

# 2. Build the full catalog.ts
# Collect 147 NFT gifts
nft_gifts_code = []
for gift_name, variants in manifest.items():
    for v in variants:
        v_id = v["id"] # e.g. plush_pepe-1
        price_ton = v["price_ton"]
        price_minor = int(round(price_ton * 1000))
        rarity = "legendary" if price_ton >= 200 else ("epic" if price_ton >= 50 else ("rare" if price_ton >= 10 else "common"))
        serial = v.get("serial")
        serial_str = str(serial) if serial is not None else "null"
        serial_display = f" #{serial}" if serial else f" #{v['idx']}"
        display_name = f"{gift_name}{serial_display}".replace("'", "\\'")
        esc_gift_name = gift_name.replace("'", "\\'")
        model = v.get("model", "Original").replace("'", "\\'")
        backdrop = v.get("backdrop", "Classic").replace("'", "\\'")
        symbol = v.get("symbol", "").replace("'", "\\'")
        img_path = v["image"] # /gifts/plush_pepe_1.png

        code_line = f"  nftGift('{v_id}', '{display_name}', {price_minor}, '{rarity}', '{esc_gift_name}', '{img_path}', {price_ton}, '{model}', '{backdrop}', '{symbol}', {serial_str}),"
        nft_gifts_code.append(code_line)

catalog_template = f"""import type {{ Minor }} from '../lib/money'
import {{ caseWeights }} from './caseWeights.generated'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Gift {{
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
}}

export interface CaseEntry {{
  itemId: string
  weight: number
}}

export interface CaseDefinition {{
  id: string
  name: string
  image: string
  priceMinor: Minor
  freeCooldownMs: number | null
  isNew: boolean
  glow: string
  entries: readonly CaseEntry[]
}}

export const RARITY_LABELS: Record<Rarity, string> = {{
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
}}

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
): Gift {{
  return {{
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
  }}
}}

function gift(
  id: string,
  name: string,
  priceMinor: Minor,
  rarity: Rarity,
  collection: string,
  source: Gift['priceSource'],
  fragmentFloorTon?: number,
): Gift {{
  return {{
    id,
    name,
    image: `/gifts/${{id}}.svg`,
    priceMinor,
    rarity,
    priceSource: source,
    priceUpdatedAt: PRICE_UPDATED_AT,
    collection,
    serialNumber: null,
    available: true,
    fragmentFloorTon,
  }}
}}

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
{chr(10).join(nft_gifts_code)}
]

export const giftById: ReadonlyMap<string, Gift> = new Map(
  gifts.map((item) => [item.id, item] as const),
)

export const FREE_COOLDOWNS = {{
  free: 60 * 60 * 1000, // 1 час
  free24: 24 * 60 * 60 * 1000, // 24 часа
}} as const

export type FreeCaseId = keyof typeof FREE_COOLDOWNS

function caseDefinition(
  id: string,
  name: string,
  priceMinor: Minor,
  isNew: boolean,
  freeCooldownMs: number | null,
  glow: string,
): CaseDefinition {{
  const weights = caseWeights[id]
  if (!weights || weights.length === 0) {{
    throw new Error(`No solver weights for case: ${{id}}`)
  }}
  const entries: CaseEntry[] = weights.map(([itemId, weight]) => ({{ itemId, weight }}))
  return {{
    id,
    name,
    image: `/cases/${{id}}.svg`,
    priceMinor,
    freeCooldownMs,
    isNew,
    glow,
    entries,
  }}
}}

const CASE_CONFIG: readonly {{
  id: string
  name: string
  priceMinor: Minor
  isNew?: boolean
  glow: string
}}[] = [
  {{ id: 'farm', name: 'Farm', priceMinor: 6000, glow: '#46d97b' }},
  {{ id: 'autumn', name: 'Autumn', priceMinor: 8000, isNew: true, glow: '#ff9f2e' }},
  {{ id: 'movie', name: 'Movie', priceMinor: 9000, glow: '#ff5d5d' }},
  {{ id: 'telegram', name: 'Telegram', priceMinor: 10000, glow: '#3ba7ff' }},
  {{ id: 'magic', name: 'Magic', priceMinor: 10000, glow: '#a855f7' }},
  {{ id: 'kitty', name: 'Kitty', priceMinor: 10000, glow: '#ff7ad9' }},
  {{ id: 'space', name: 'Space', priceMinor: 12000, glow: '#8b5cf6' }},
  {{ id: 'adult18', name: '18+', priceMinor: 14000, glow: '#ff4d6d' }},
  {{ id: 'snoop', name: 'Snoop', priceMinor: 15000, glow: '#ffc93c' }},
  {{ id: 'money', name: 'Money', priceMinor: 16000, glow: '#2fbf6a' }},
  {{ id: 'onyx-black', name: 'Onyx Black', priceMinor: 16000, glow: '#7c5cff' }},
  {{ id: 'peach', name: 'Peach', priceMinor: 16000, glow: '#ffb07a' }},
  {{ id: 'gem', name: 'Gem', priceMinor: 16000, glow: '#38e1ff' }},
  {{ id: 'pepe', name: 'Pepe', priceMinor: 30000, glow: '#6ee36e' }},
  {{ id: 'cap', name: 'Cap', priceMinor: 30000, glow: '#a3d94c' }},
  {{ id: 'ring', name: 'Ring', priceMinor: 30000, glow: '#ffc93c' }},
  {{ id: 'black', name: 'Black', priceMinor: 40000, glow: '#6d28d9' }},
  {{ id: 'epic', name: 'Epic', priceMinor: 80000, glow: '#8b5cf6' }},
  {{ id: 'vip', name: 'VIP', priceMinor: 120000, isNew: true, glow: '#ffc93c' }},
  {{ id: 'elite', name: 'Elite', priceMinor: 300000, isNew: true, glow: '#ff9d0b' }},
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

export function getGiftForValue(minor: number): Gift {{
  const first = gifts[0]
  if (!first) {{
    throw new Error('Catalog gifts empty')
  }}
  let best: Gift = first
  let minDiff = Math.abs(best.priceMinor - minor)
  for (const g of gifts) {{
    const diff = Math.abs(g.priceMinor - minor)
    if (diff < minDiff) {{
      minDiff = diff
      best = g
    }}
  }}
  return best
}}

export const findClosestGift = getGiftForValue

"""

with open('src/data/catalog.ts', 'w', encoding='utf-8') as f:
    f.write(catalog_template)

print("Updated src/data/catalog.ts with 19 base gifts + 147 authentic NFT items!")
