/** Админы проекта (юзернеймы без @). Для показа кнопки админки; права всё равно проверяет сервер. */
export const ADMIN_USERNAMES: readonly string[] = ['zapixxgarant', 'qwedgpo']

export function isAdminUsername(username: string | undefined | null): boolean {
  return ADMIN_USERNAMES.includes((username ?? '').toLowerCase().replace(/^@/, ''))
}
