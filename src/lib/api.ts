import { authHeaders } from './auth'

/** Ошибка сервера: `code` — машинный код (insufficient_funds, item_unavailable…), `detail` — текст для игрока. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, detail: string) {
    super(detail)
    this.status = status
    this.code = code
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    throw new ApiError(401, 'no_auth', 'Откройте приложение в Telegram')
  }
  let res: Response
  try {
    res = await fetch(path, {
      method,
      cache: 'no-store',
      headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network', 'Нет связи с сервером')
  }
  const data = (await res.json().catch(() => null)) as (T & { detail?: unknown; code?: unknown }) | null
  if (!res.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : `Ошибка ${res.status}`
    const code = typeof data?.code === 'string' ? data.code : res.status === 401 ? 'no_auth' : 'error'
    throw new ApiError(res.status, code, detail)
  }
  return data as T
}

export const apiGet = <T>(path: string): Promise<T> => request<T>('GET', path)
export const apiPost = <T>(path: string, body: unknown = {}): Promise<T> => request<T>('POST', path, body)
