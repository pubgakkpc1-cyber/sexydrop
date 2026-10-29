import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTelegram } from './lib/telegram'
import { startCrashEngine } from './services/demoCrashService'
import './styles/global.css'

initTelegram()
// Ракетка всегда активна (глобальный непрерывный цикл раундов 24/7)
startCrashEngine()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
