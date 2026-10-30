import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMinor, toMinor, type Minor } from '../lib/money'
import {
  STARS_MAX,
  STARS_MIN,
  STARS_PER_TON,
  TON_PER_STAR_LABEL,
  isValidStars,
  parseStars,
  starsToMinor,
} from '../lib/stars'
import { useWalletStore } from '../store/wallet'
import { cx } from '../lib/cx'
import {
  BotIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ConvertIcon,
  GiftIcon,
  StarIcon,
  TonIcon,
  WalletIcon,
} from '../components/shell/icons'
import styles from './DepositScreen.module.css'

type TabId = 'ton' | 'crypto' | 'stars' | 'gifts' | 'convert'

const TABS: ReadonlyArray<{ id: TabId; label: string; Icon: typeof WalletIcon }> = [
  { id: 'ton', label: 'TON', Icon: WalletIcon },
  { id: 'crypto', label: 'Крипто Бот', Icon: BotIcon },
  { id: 'stars', label: 'Stars', Icon: StarIcon },
  { id: 'gifts', label: 'Подарки', Icon: GiftIcon },
  { id: 'convert', label: 'Конвертер', Icon: ConvertIcon },
]

const MIN_TON_MINOR: Minor = 100 // 0.1 TON
const TON_PRESETS: readonly Minor[] = [1_000, 10_000, 100_000]
const STARS_PRESETS: ReadonlyArray<{ label: string; value: number }> = [
  { label: '+50', value: 50 },
  { label: '+100', value: 100 },
  { label: '+500', value: 500 },
  { label: '+1k', value: 1_000 },
  { label: '+5k', value: 5_000 },
]

function parseTon(input: string): Minor | null {
  try {
    return toMinor(input)
  } catch {
    return null
  }
}

/** Панель «TON» и «Крипто Бот»: сумма + быстрые добавки. */
function TonPanel({ via, onDone }: { via: 'wallet' | 'bot'; onDone: (minor: Minor) => void }) {
  const [input, setInput] = useState('')
  const minor = useMemo(() => parseTon(input), [input])
  const valid = minor !== null && minor >= MIN_TON_MINOR
  const add = (preset: Minor) => setInput(formatMinor((minor ?? 0) + preset))

  return (
    <div className={styles.panel}>
      <p className={styles.demo}>
        Демо-режим: баланс пополняется виртуально. Реальная оплата
        {via === 'bot' ? ' через @CryptoBot' : ' с кошелька'} появится после подключения сервера.
      </p>
      <label className={styles.label} htmlFor="dep-ton">
        Сумма (минимум 0.1 TON)
      </label>
      <div className={styles.inputRow}>
        <input
          id="dep-ton"
          className={styles.input}
          inputMode="decimal"
          placeholder="Введите сумму…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <TonIcon className={styles.inputIcon} aria-hidden />
      </div>
      <div className={styles.presets}>
        {TON_PRESETS.map((p) => (
          <button key={p} type="button" className={styles.preset} onClick={() => add(p)}>
            +{formatMinor(p)} TON
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.primary}
        disabled={!valid}
        onClick={() => {
          if (valid) {
            onDone(minor)
            setInput('')
          }
        }}
      >
        Пополнить
      </button>
    </div>
  )
}

/** Панель «Stars»: оплата Stars → зачисление TON по курсу. */
function StarsPanel({ onDone }: { onDone: (minor: Minor) => void }) {
  const [input, setInput] = useState('')
  const stars = parseStars(input)
  const valid = isValidStars(stars)
  const payout = valid ? starsToMinor(stars) : 0
  const add = (n: number) => setInput(String(Math.min(STARS_MAX, (stars ?? 0) + n)))

  return (
    <div className={styles.panel}>
      <p className={styles.demo}>
        Демо-режим: Stars не списываются, баланс TON пополняется виртуально. Оплата Stars появится
        после подключения сервера.
      </p>
      <label className={styles.label} htmlFor="dep-stars">
        Количество Stars ({STARS_MIN} – 10 000)
      </label>
      <div className={styles.inputRow}>
        <input
          id="dep-stars"
          className={styles.input}
          inputMode="numeric"
          placeholder="0"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, ''))}
        />
        <StarIcon className={styles.inputIcon} aria-hidden />
      </div>
      <div className={styles.presetsRow}>
        {STARS_PRESETS.map((p) => (
          <button key={p.label} type="button" className={styles.preset} onClick={() => add(p.value)}>
            {p.label}
          </button>
        ))}
      </div>
      {valid && (
        <p className={styles.rate}>
          Вы получите <strong>{formatMinor(payout)} TON</strong> · курс {STARS_PER_TON} Stars = 1 TON
        </p>
      )}
      <p className={styles.rate}>
        1 Star = <strong>{TON_PER_STAR_LABEL} TON</strong>
      </p>
      <button
        type="button"
        className={styles.primary}
        disabled={!valid || payout <= 0}
        onClick={() => {
          if (valid && payout > 0) {
            onDone(payout)
            setInput('')
          }
        }}
      >
        Пополнить
      </button>
    </div>
  )
}

/** Панель «Подарки»: как это работает (приём подарков — серверная часть). */
function GiftsPanel() {
  const [open, setOpen] = useState(true)
  return (
    <div className={styles.panel}>
      <div className={styles.giftHero}>
        <span className={styles.giftIcon}>
          <GiftIcon className={styles.giftIconSvg} aria-hidden />
        </span>
        <div>
          <h2 className={styles.giftTitle}>Пополнить подарками</h2>
          <p className={styles.giftSub}>
            Отправьте подарки нашему боту, и они появятся в вашем инвентаре
          </p>
        </div>
      </div>

      <button
        type="button"
        className={styles.accordion}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Как это работает</span>
        <span className={styles.accordionHint}>
          {open ? 'Скрыть шаги' : 'Показать шаги'}
          <ChevronUpIcon className={cx(styles.chev, !open && styles.chevDown)} aria-hidden />
        </span>
      </button>

      {open && (
        <div className={styles.steps}>
          <ol className={styles.stepList}>
            <li>
              <span className={styles.stepNum}>1</span>
              <div>
                <strong>Откройте бота</strong>
                <p>Нажмите кнопку ниже, чтобы открыть нашего бота @sexydropbot.</p>
              </div>
            </li>
            <li>
              <span className={styles.stepNum}>2</span>
              <div>
                <strong>Отправьте подарок</strong>
                <p>Отправьте подарок напрямую боту.</p>
              </div>
            </li>
            <li>
              <span className={styles.stepNum}>3</span>
              <div>
                <strong>Подарок добавлен в инвентарь</strong>
                <p>
                  Подарок появится в инвентаре в течение нескольких секунд. Затем вы сможете быстро
                  продать его за баланс TON.
                </p>
              </div>
            </li>
          </ol>
          <ul className={styles.perks}>
            <li>
              <CheckIcon className={styles.perkIcon} aria-hidden />
              <span>
                <b>Мгновенная обработка:</b> подарки появляются в инвентаре сразу после отправки
              </span>
            </li>
            <li>
              <CheckIcon className={styles.perkIcon} aria-hidden />
              <span>
                <b>Быстрая продажа:</b> продавайте подарки из инвентаря за мгновенный баланс TON
              </span>
            </li>
          </ul>
        </div>
      )}

      <button type="button" className={styles.primary} disabled>
        Приём подарков скоро
      </button>
      <p className={styles.note}>
        Приём подарков включится после подключения сервера — сейчас кнопка недоступна, чтобы не
        вводить в заблуждение.
      </p>
    </div>
  )
}

/** Панель «Конвертировать»: Stars → TON с живым пересчётом. */
function ConvertPanel({ onDone }: { onDone: (minor: Minor) => void }) {
  const [input, setInput] = useState('')
  const stars = parseStars(input)
  const valid = isValidStars(stars)
  const payout = valid ? starsToMinor(stars) : stars !== null ? starsToMinor(stars) : 0

  return (
    <div className={styles.panel}>
      <p className={styles.demo}>
        Демо-режим: Stars не списываются, конвертация виртуальная. Реальная конвертация появится
        после подключения сервера.
      </p>

      <div className={styles.convertCard}>
        <span className={styles.label}>Отдаёте</span>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            aria-label="Количество Stars"
            inputMode="numeric"
            placeholder="0"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, ''))}
          />
          <span className={styles.unit}>
            <StarIcon className={styles.unitIcon} aria-hidden /> Stars
          </span>
        </div>

        <span className={styles.swap} aria-hidden>
          <ConvertIcon className={styles.swapIcon} />
        </span>

        <span className={styles.label}>Получаете</span>
        <div className={styles.inputRow}>
          <output className={cx(styles.input, styles.output)} aria-label="Получите TON">
            {payout > 0 ? formatMinor(payout) : '0'}
          </output>
          <span className={styles.unit}>
            <TonIcon className={styles.unitIcon} aria-hidden /> TON
          </span>
        </div>
      </div>

      <p className={styles.rate}>
        Курс: <strong>{STARS_PER_TON} Stars = 1 TON</strong> · 1 Star = <strong>{TON_PER_STAR_LABEL} TON</strong>
      </p>
      <p className={styles.rate}>
        От {STARS_MIN} до {STARS_MAX.toLocaleString('ru-RU')} Stars за раз
      </p>
      <div className={styles.presetsRow}>
        {STARS_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={styles.preset}
            onClick={() => setInput(String(Math.min(STARS_MAX, (stars ?? 0) + p.value)))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.primary}
        disabled={!valid || payout <= 0}
        onClick={() => {
          if (valid && payout > 0) {
            onDone(payout)
            setInput('')
          }
        }}
      >
        Конвертировать
      </button>
    </div>
  )
}

/**
 * Экран «Пополнение баланса»: TON, Крипто Бот, Stars, Подарки, Конвертировать.
 * Пока нет серверной оплаты, все способы честно помечены как демо и зачисляют
 * виртуальный баланс (правило проекта: никаких «настоящих» платежей без сервера).
 */
export function DepositScreen() {
  const navigate = useNavigate()
  const credit = useWalletStore((s) => s.credit)
  const [tab, setTab] = useState<TabId>('ton')
  const [done, setDone] = useState<string | null>(null)

  const finish = (minor: Minor) => {
    credit(minor)
    setDone(`Баланс пополнен на ${formatMinor(minor)} TON`)
    window.setTimeout(() => setDone(null), 2500)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.titleRow}>
        <button type="button" className={styles.back} aria-label="Назад" onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden />
        </button>
        <h1 className={styles.title}>Пополнение баланса</h1>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Способ пополнения">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cx(styles.tab, tab === id && styles.tabActive)}
            onClick={() => setTab(id)}
          >
            <Icon className={styles.tabIcon} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {done && (
        <p className={styles.toast} role="status">
          {done}
        </p>
      )}

      {tab === 'ton' && <TonPanel via="wallet" onDone={finish} />}
      {tab === 'crypto' && <TonPanel via="bot" onDone={finish} />}
      {tab === 'stars' && <StarsPanel onDone={finish} />}
      {tab === 'gifts' && <GiftsPanel />}
      {tab === 'convert' && <ConvertPanel onDone={finish} />}
    </div>
  )
}
