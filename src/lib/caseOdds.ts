import { cases, type CaseEntry } from '../data/catalog'
import { getWebApp } from './telegram'

/** Дефолтные шансы из каталога — снимок до применения переопределений админа. */
const DEFAULT_ENTRIES = new Map<string, readonly CaseEntry[]>(cases.map((c) => [c.id, c.entries]))

export function defaultEntries(caseId: string): readonly CaseEntry[] {
  return DEFAULT_ENTRIES.get(caseId) ?? []
}

/** Подменяет веса призов кейса. Призы с нулевым весом из кейса убираются; `null` возвращает дефолт. */
export function setCaseWeights(caseId: string, weights: Readonly<Record<string, number>> | null): void {
  const def = cases.find((c) => c.id === caseId)
  if (!def) return
  const base = defaultEntries(caseId)
  const next = weights
    ? base.map((e) => ({ itemId: e.itemId, weight: weights[e.itemId] ?? 0 })).filter((e) => e.weight > 0)
    : base
  if (next.length === 0) return
  ;(def as { entries: readonly CaseEntry[] }).entries = next
}

function initData(): string | undefined {
  return (getWebApp() as unknown as { initData?: string } | undefined)?.initData || undefined
}

/** Забирает с сервера шансы, выставленные админом, и применяет их. Без ответа остаются дефолтные. */
export async function loadCaseOdds(): Promise<void> {
  try {
    const res = await fetch('/api/odds', { cache: 'no-store' })
    if (!res.ok) return
    const all = (await res.json()) as Record<string, Record<string, number>>
    for (const [id, w] of Object.entries(all)) setCaseWeights(id, w)
  } catch {
    /* нет сети — играем с дефолтными шансами */
  }
}

/** Админ: сохраняет шансы кейса на сервере (`null` — сбросить к дефолтным). Возвращает текст ошибки. */
export async function saveCaseOdds(
  caseId: string,
  weights: Readonly<Record<string, number>> | null,
): Promise<string | null> {
  const data = initData()
  if (!data) return 'Откройте админку из Telegram'
  try {
    const res = await fetch(`/api/admin/odds/${caseId}`, {
      method: weights ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': data },
      body: weights ? JSON.stringify({ weights }) : undefined,
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { detail?: string } | null
      return body?.detail ?? `Ошибка ${res.status}`
    }
    setCaseWeights(caseId, weights)
    return null
  } catch {
    return 'Нет связи с сервером'
  }
}
