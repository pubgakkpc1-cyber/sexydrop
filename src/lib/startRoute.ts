/**
 * Старт приложения всегда на главной. Telegram передаёт в hash служебные параметры
 * (`#tgWebAppData=…`), из-за них роутер видит чужой путь и кнопка «Главная» не загорается;
 * к тому же при открытии из меню бота нужна именно главная, а не последний экран.
 * Параметры SDK Telegram уже прочитал при загрузке скрипта, поэтому hash можно заменить.
 */
export function normalizeStartRoute(inTelegram: boolean, loc: Location = window.location): void {
  const hasRoute = loc.hash.startsWith('#/')
  if (hasRoute && !inTelegram) return
  window.history.replaceState(null, '', `${loc.pathname}${loc.search}#/`)
}
