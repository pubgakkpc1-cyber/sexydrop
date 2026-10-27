import { useState } from 'react'
import { Button, Card, Input, Modal } from '../components/ui'
import { GiftPickerSheet } from '../components/inventory/GiftPickerSheet'
import { useWalletStore } from '../store/wallet'
import { formatMinor } from '../lib/money'
import styles from '../App.module.css'

/** Витрина UI-кита (TIER 0.3) — доступна на /dev/ui, в навигацию не входит. */
function DevUiScreen() {
  const mode = useWalletStore((s) => s.mode)
  const balance = useWalletStore((s) => s.balances[s.mode])
  const setMode = useWalletStore((s) => s.setMode)
  const resetDemo = useWalletStore((s) => s.resetDemo)

  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>0.3 · UI Kit</h1>

      <Card className={styles.wallet}>
        <span className={styles.walletLabel}>
          Mode: <strong>{mode}</strong> · Balance: <strong>{formatMinor(balance)}</strong>
        </span>
        <span className={styles.walletActions}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setMode(mode === 'demo' ? 'real' : 'demo')}
          >
            Switch
          </Button>
          <Button size="sm" variant="ghost" onClick={resetDemo}>
            Reset demo
          </Button>
        </span>
      </Card>

      <section className={styles.section}>
        <h2 className={styles.h2}>Buttons</h2>
        <div className={styles.row}>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div className={styles.row}>
          <Button size="sm">sm</Button>
          <Button size="md">md</Button>
          <Button size="lg">lg</Button>
          <Button disabled>Disabled</Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 1500)
            }}
          >
            {loading ? 'Loading…' : 'Click me'}
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Inputs</h2>
        <div className={styles.stack}>
          <Input label="Ставка" placeholder="0.00" suffix="₽" inputMode="decimal" />
          <Input label="С ошибкой" value="99999" error="Недостаточно средств" readOnly />
          <Input label="С подсказкой" placeholder="Никнейм" hint="Виден другим игрокам" />
          <Input placeholder="Disabled" disabled />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Cards</h2>
        <div className={styles.stack}>
          <Card>
            <p>Обычная карточка (padding md)</p>
          </Card>
          <Card
            interactive
            onClick={() => setText('Карточка нажата!')}
            aria-label="Интерактивная карточка"
          >
            <strong>Interactive card</strong>
            <p className={styles.muted}>{text || 'Нажмите на меня'}</p>
          </Card>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Выбор подарка (3.3)</h2>
        <Button variant="secondary" onClick={() => setPickerOpen(true)}>
          Выбрать подарок
        </Button>
        {picked && <p className={styles.muted}>Выбран предмет: {picked}</p>}
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Modal</h2>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          Открыть модальное окно
        </Button>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Подтверждение">
        <p>Базовая модалка: портал, Esc, клик по фону, блокировка скролла.</p>
        <div className={styles.modalFooter}>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Отмена
          </Button>
          <Button onClick={() => setModalOpen(false)}>Ок</Button>
        </div>
      </Modal>

      <GiftPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(item) => setPicked(`${item.giftId} (${item.uid})`)}
      />
    </main>
  )
}

export default DevUiScreen
