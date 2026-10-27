#!/usr/bin/env node
/**
 * Привязывает Mini App к кнопке меню бота.
 * Использование: npm run tg:attach -- https://<публичный-url>
 * Токен читается из .env (BOT_TOKEN) и наружу не передаётся.
 */
import { readFileSync } from 'node:fs'

const url = process.argv[2]
if (!url || !url.startsWith('https://')) {
  console.error('Usage: npm run tg:attach -- https://<public-url>')
  process.exit(1)
}

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const token = env.match(/^BOT_TOKEN=(.+)$/m)?.[1]?.trim()
if (!token) {
  console.error('BOT_TOKEN not found in .env')
  process.exit(1)
}

const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    menu_button: { type: 'web_app', text: 'Открыть SEXY DROP', web_app: { url } },
  }),
})
const json = await res.json()
if (!json.ok) {
  console.error('Telegram API error:', JSON.stringify(json))
  process.exit(1)
}
console.log('Mini App attached to bot menu button:', url)
