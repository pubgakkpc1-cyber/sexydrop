/**
 * Серверный режим: баланс, подарки и исходы игр решает сервер (в production и при VITE_SERVER_MODE=1).
 * В тестах и локальной разработке остаётся демо-режим на устройстве.
 */
export const SERVER_MODE: boolean =
  import.meta.env.PROD === true || import.meta.env.VITE_SERVER_MODE === '1'
