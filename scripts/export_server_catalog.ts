// Экспорт каталога для сервера: цены подарков и состав кейсов. Запуск: npm run export:catalog
import { writeFileSync } from 'node:fs'
import { cases, gifts } from '../src/data/catalog'
import { caseWeights } from '../src/data/caseWeights.generated'
import { fixedCaseWeights } from '../src/data/caseOddsFixed'

const out = {
  gifts: Object.fromEntries(gifts.map((g) => [g.id, { price: g.priceMinor, name: g.name, available: g.available }])),
  cases: Object.fromEntries(
    cases.map((c) => [
      c.id,
      {
        name: c.name,
        price: c.priceMinor,
        cooldown_ms: c.freeCooldownMs,
        entries: c.entries.map((e) => [e.itemId, e.weight]),
        // все возможные призы кейса (для админских переопределений шансов)
        all_items: [
          ...new Set([
            ...(caseWeights[c.id] ?? []).map((e) => e[0]),
            ...(fixedCaseWeights[c.id] ?? []).map((e) => e[0]),
            ...c.entries.map((e) => e.itemId),
          ]),
        ],
      },
    ]),
  ),
}
writeFileSync(process.argv[2] ?? 'backend/app/assets/catalog.json', JSON.stringify(out))
console.log('gifts', Object.keys(out.gifts).length, 'cases', Object.keys(out.cases).length)
