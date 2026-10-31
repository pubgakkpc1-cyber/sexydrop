import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { getStartParam, getTelegramUser, initTelegram, isTelegramEnv } from './lib/telegram'
import { parseReferrerId } from './lib/referral'
import { useReferralsStore } from './store/referrals'
import { track } from './lib/telemetry'
import { normalizeStartRoute } from './lib/startRoute'
import { startCrashEngine } from './services/demoCrashService'
import './styles/global.css'

// Прогрев шрифтов: текст на канвасе ракеты рисуется до первого DOM-использования
void document.fonts?.load('800 12px Unbounded')
void document.fonts?.load('600 14px "Golos Text"')
initTelegram()
// Реферальная ссылка: запоминаем, кто пригласил (один раз, не себя)
const referrer = parseReferrerId(getStartParam())
if (referrer) useReferralsStore.getState().setReferrer(referrer, getTelegramUser()?.id?.toString())
// Открытие приложения — всегда главная, кнопка «Главная» активна
normalizeStartRoute(isTelegramEnv())
// Ракетка всегда активна (глобальный непрерывный цикл раундов 24/7)
startCrashEngine()
// Заход игрока — для статистики «онлайн за 24 часа» в админ-панели
track({ type: 'open' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
