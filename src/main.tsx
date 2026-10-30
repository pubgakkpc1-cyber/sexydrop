import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTelegram, isTelegramEnv } from './lib/telegram'
import { normalizeStartRoute } from './lib/startRoute'
import { startCrashEngine } from './services/demoCrashService'
import './styles/global.css'

initTelegram()
// Открытие приложения — всегда главная, кнопка «Главная» активна
normalizeStartRoute(isTelegramEnv())
// Ракетка всегда активна (глобальный непрерывный цикл раундов 24/7)
startCrashEngine()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
