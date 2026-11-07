import type { CaseDefinition } from '../data/catalog'

/**
 * Лента рулетки кейса — только оформление: что выпало, решает сервер (шансы не меняются).
 * Чтобы лента была живой, в ней по очереди показываются ВСЕ подарки, которые реально лежат в
 * этом кейсе (и редкие NFT тоже), а не одни и те же дешёвые призы; один и тот же подарок
 * никогда не стоит два раза подряд. Подарков, которых в кейсе нет, в ленте не бывает.
 */
export function buildCaseStrip(
  caseDefinition: CaseDefinition,
  length: number,
  target?: { index: number; giftId: string },
  rng: () => number = Math.random,
): string[] {
  const pool = [...new Set(caseDefinition.entries.map((e) => e.itemId))]
  if (pool.length === 0) return target ? Array.from({ length }, () => target.giftId) : []

  // «колода»: все подарки кейса в случайном порядке, когда кончилась — новая
  let deck: string[] = []
  const draw = (avoid: ReadonlySet<string>): string => {
    for (let attempt = 0; attempt < pool.length * 2; attempt += 1) {
      if (deck.length === 0) deck = shuffle(pool, rng)
      const next = deck.pop()!
      if (!avoid.has(next) || pool.length <= avoid.size) return next
      deck.unshift(next) // этот подходит позже — в конец очереди
    }
    return pool.find((g) => !avoid.has(g)) ?? pool[0]!
  }

  const strip: string[] = []
  for (let i = 0; i < length; i += 1) {
    if (target && i === target.index) {
      strip.push(target.giftId)
      continue
    }
    const avoid = new Set<string>()
    if (i > 0) avoid.add(strip[i - 1]!)
    if (target && i + 1 === target.index) avoid.add(target.giftId) // и не рядом с выигрышем такой же
    strip.push(draw(avoid))
  }
  return strip
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
