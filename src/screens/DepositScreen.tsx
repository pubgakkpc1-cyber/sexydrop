import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStarsBalanceStore } from '../store/starsBalance'
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
  commentPayload,
  createCryptoInvoice,
  createStarsInvoice,
  cryptoInvoiceStatus,
  loadDepositConfig,
  minorToNano,
  newSecret,
  starsPaymentStatus,
  tonComment,
  tonPaymentStatus,
  type DepositConfig,
} from '../lib/deposits'
import { getTonConnect } from '../lib/tonconnect'
import { getWebApp, openOwnerChat } from '../lib/telegram'
import { PENDING_TTL_MS, useDepositsStore } from '../store/deposits'
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
function TonPanel({ via, onDone, locked = false }: { via: 'wallet' | 'bot'; onDone: (minor: Minor) => void; locked?: boolean }) {
  const [input, setInput] = useState('')
  const minor = useMemo(() => parseTon(input), [input])
  const valid = minor !== null && minor >= MIN_TON_MINOR && !locked
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

/** Общая часть реальных панелей: поле суммы и быстрые добавки. */
function AmountField({
  input,
  setInput,
  minor,
  config,
}: {
  input: string
  setInput: (v: string) => void
  minor: Minor | null
  config: DepositConfig
}) {
  const add = (preset: Minor) => setInput(formatMinor(Math.min(config.max_minor, (minor ?? 0) + preset)))
  return (
    <>
      <label className={styles.label} htmlFor="dep-ton">
        Сумма (минимум {formatMinor(config.min_minor)} TON)
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
    </>
  )
}

/** «TON»: перевод с любого кошелька через TON Connect (Tonkeeper, Tonhub, MyTonWallet, Wallet…). */
function WalletPanel({ config }: { config: DepositConfig }) {
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const minor = useMemo(() => parseTon(input), [input])
  const valid = minor !== null && minor >= config.min_minor && minor <= config.max_minor
  const address = config.ton_address

  useEffect(() => {
    let off: (() => void) | undefined
    let dead = false
    getTonConnect()
      .then((tc) => {
        if (dead) return
        setConnected(tc.connected)
        off = tc.onStatusChange((w) => setConnected(Boolean(w)))
      })
      .catch(() => setError('Не удалось загрузить TON Connect'))
    return () => {
      dead = true
      off?.()
    }
  }, [])

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const tc = await getTonConnect()
      if (!tc.connected) {
        await tc.openModal()
        return
      }
      if (!valid || !address) return
      const secret = newSecret()
      const comment = await tonComment(secret)
      await tc.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address, amount: minorToNano(minor), payload: commentPayload(comment) }],
      })
      useDepositsStore.getState().add({ secret, kind: 'ton', amount: minor, createdAt: Date.now() })
      setInput('')
      setSent(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(/reject|declin|cancel|User/i.test(msg) ? 'Перевод отменён в кошельке' : msg || 'Не удалось отправить перевод')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    try {
      await (await getTonConnect()).disconnect()
    } catch {
      /* кошелёк уже отключён */
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.note}>
        Переведите TON со своего кошелька: Tonkeeper, Tonhub, MyTonWallet, Wallet в Telegram и
        другие. Баланс пополнится автоматически, когда перевод попадёт в блокчейн.
      </p>
      <AmountField input={input} setInput={setInput} minor={minor} config={config} />
      <button
        type="button"
        className={styles.primary}
        disabled={busy || (connected && !valid)}
        onClick={() => void submit()}
      >
        {connected ? 'Пополнить' : 'Подключить кошелёк'}
      </button>
      {connected && (
        <button type="button" className={styles.preset} onClick={() => void disconnect()}>
          Сменить кошелёк
        </button>
      )}
      {sent && <p className={styles.rate}>Перевод отправлен — ждём подтверждения в сети (до минуты).</p>}
      {error && (
        <p className={styles.note} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** «Крипто Бот»: счёт в @CryptoBot на выбранную сумму. */
function CryptoBotPanel({ config }: { config: DepositConfig }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const minor = useMemo(() => parseTon(input), [input])
  const valid = minor !== null && minor >= config.min_minor && minor <= config.max_minor

  const submit = async () => {
    if (!valid) return
    setError(null)
    setBusy(true)
    try {
      const secret = newSecret()
      const inv = await createCryptoInvoice(minor, secret)
      useDepositsStore.getState().add({
        secret,
        kind: 'crypto',
        invoiceId: inv.invoice_id,
        amount: minor,
        createdAt: Date.now(),
      })
      const webApp = getWebApp()
      if (webApp?.openTelegramLink) webApp.openTelegramLink(inv.pay_url)
      else window.open(inv.pay_url, '_blank', 'noopener')
      setInput('')
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать счёт')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.note}>
        Оплата через @CryptoBot: создадим счёт, вы оплатите его в боте любой криптовалютой —
        баланс пополнится в TON автоматически.
      </p>
      <AmountField input={input} setInput={setInput} minor={minor} config={config} />
      <button type="button" className={styles.primary} disabled={!valid || busy} onClick={() => void submit()}>
        Оплатить в @CryptoBot
      </button>
      {sent && <p className={styles.rate}>Счёт открыт в боте. После оплаты вернитесь сюда — баланс обновится сам.</p>}
      {error && (
        <p className={styles.note} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** «Stars»: настоящая оплата Telegram Stars через счёт бота, зачисление в TON по курсу. */
function StarsRealPanel() {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const stars = parseStars(input)
  const valid = isValidStars(stars)
  const payout = valid ? starsToMinor(stars) : 0
  const add = (n: number) => setInput(String(Math.min(STARS_MAX, (stars ?? 0) + n)))

  const submit = async () => {
    if (!valid) return
    setError(null)
    setBusy(true)
    try {
      const secret = newSecret()
      const { invoice_url } = await createStarsInvoice(stars, secret)
      useDepositsStore.getState().add({ secret, kind: 'stars', amount: payout, createdAt: Date.now() })
      getWebApp()?.openInvoice?.(invoice_url, (status) => {
        if (status === 'paid') setSent(true)
        else if (status === 'cancelled' || status === 'failed') useDepositsStore.getState().remove(secret)
      })
      setInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать счёт')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.note}>
        Оплата настоящими Telegram Stars. После оплаты баланс TON пополнится по курсу автоматически.
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
      <button type="button" className={styles.primary} disabled={!valid || busy || payout <= 0} onClick={() => void submit()}>
        Оплатить Stars
      </button>
      {sent && <p className={styles.rate}>Оплата получена — зачисляем на баланс…</p>}
      {error && (
        <p className={styles.note} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Следит за неподтверждёнными платежами (TON и CryptoBot) и зачисляет оплаченные.
 * Пока открыт экран, опрашивает сервер каждые 4 секунды; незавершённые платежи
 * переживают перезапуск приложения и проверяются при следующем открытии.
 */
function usePendingDeposits(onPaid: (minor: Minor) => void) {
  useEffect(() => {
    let stopped = false
    const tick = async () => {
      const { pending, remove, markCredited } = useDepositsStore.getState()
      for (const p of pending) {
        if (stopped) return
        if (Date.now() - p.createdAt > PENDING_TTL_MS) {
          remove(p.secret)
          continue
        }
        try {
          const res =
            p.kind === 'stars'
              ? await starsPaymentStatus(p.secret)
              : p.kind === 'ton' || p.invoiceId === undefined
                ? await tonPaymentStatus(p.secret)
                : await cryptoInvoiceStatus(p.invoiceId, p.secret)
          if (res.status === 'paid') {
            if (markCredited(p.secret)) onPaid(res.amount_minor)
          } else if (res.status === 'expired') {
            remove(p.secret)
          }
        } catch {
          /* сеть или сервер недоступны — повторим на следующем такте */
        }
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 4000)
    return () => {
      stopped = true
      window.clearInterval(id)
    }
    // onPaid зачисляет через store, повторный запуск эффекта не нужен
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
            // заработанные звёзды расходуются первыми
            useStarsBalanceStore.getState().spend(stars)
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
                <strong>Откройте аккаунт менеджера</strong>
                <p>Нажмите кнопку ниже, чтобы открыть @SexyDropOwner.</p>
              </div>
            </li>
            <li>
              <span className={styles.stepNum}>2</span>
              <div>
                <strong>Отправьте подарок</strong>
                <p>Отправьте подарок в личные сообщения @SexyDropOwner.</p>
              </div>
            </li>
            <li>
              <span className={styles.stepNum}>3</span>
              <div>
                <strong>Менеджер зачислит подарок</strong>
                <p>
                  Менеджер проверит подарок и добавит его в ваш инвентарь. Затем вы сможете
                  продать его за баланс TON.
                </p>
              </div>
            </li>
          </ol>
          <ul className={styles.perks}>
            <li>
              <CheckIcon className={styles.perkIcon} aria-hidden />
              <span>
                <b>Отправка напрямую:</b> подарок уходит на аккаунт @SexyDropOwner
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

      <button type="button" className={styles.primary} onClick={openOwnerChat}>
        Открыть @SexyDropOwner
      </button>
      <p className={styles.note}>
        Зачисление подарков выполняет менеджер вручную после получения подарка.
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
  const earned = useStarsBalanceStore((s) => s.stars)

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
      {earned > 0 && (
        <button type="button" className={styles.preset} onClick={() => setInput(String(Math.min(STARS_MAX, earned)))}>
          Мои звёзды: {earned.toLocaleString('ru-RU')} ★ — подставить
        </button>
      )}
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
  const [params] = useSearchParams()
  const startTab = params.get('tab')
  const [tab, setTab] = useState<TabId>(TABS.some((x) => x.id === startTab) ? (startTab as TabId) : 'ton')
  const [done, setDone] = useState<string | null>(null)
  const [config, setConfig] = useState<DepositConfig | null | undefined>(undefined)
  const pendingCount = useDepositsStore((s) => s.pending.length)

  useEffect(() => {
    let dead = false
    void loadDepositConfig().then((c) => {
      if (!dead) setConfig(c)
    })
    return () => {
      dead = true
    }
  }, [])

  const finish = (minor: Minor) => {
    credit(minor)
    setDone(`Баланс пополнен на ${formatMinor(minor)} TON`)
    window.setTimeout(() => setDone(null), 2500)
  }

  usePendingDeposits(finish)

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

      {pendingCount > 0 && (
        <p className={styles.rate} role="status">
          Ожидаем подтверждение оплаты ({pendingCount})…
        </p>
      )}

      {tab === 'ton' &&
        (config?.ton_address ? (
          <WalletPanel config={config} />
        ) : (
          <TonPanel via="wallet" onDone={finish} locked={config === undefined} />
        ))}
      {tab === 'crypto' &&
        (config?.cryptobot ? (
          <CryptoBotPanel config={config} />
        ) : (
          <TonPanel via="bot" onDone={finish} locked={config === undefined} />
        ))}
      {tab === 'stars' &&
        (config?.stars && getWebApp()?.openInvoice ? (
          <StarsRealPanel />
        ) : (
          <StarsPanel onDone={finish} />
        ))}
      {tab === 'gifts' && <GiftsPanel />}
      {tab === 'convert' && <ConvertPanel onDone={finish} />}
    </div>
  )
}
