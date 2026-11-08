import { useState } from 'react'
import { authHeaders } from '../../lib/auth'
import { getTelegramUser } from '../../lib/telegram'
import { useWalletStore } from '../../store/wallet'
import { Button, Input } from '../ui'
import styles from './AdminPanelModal.module.css'

/** Выдача TON игроку по юзернейму. */
export function AdminGiveTab() {
  const [username, setUsername] = useState('')
  const [amount, setAmount] = useState('10')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const credit = useWalletStore((s) => s.credit)
  const myName = (getTelegramUser()?.username ?? '').replace(/^@/, '')

  const handleGiveTon = async () => {
    const cleanUser = username.trim().replace(/^@/, '')
    const numAmount = parseFloat(amount.replace(',', '.'))

    if (!cleanUser) {
      setStatus({ type: 'error', text: 'Укажите юзернейм получателя (например @ivan)' })
      return
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setStatus({ type: 'error', text: 'Укажите корректную сумму TON больше 0' })
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const res = await fetch('/api/admin/give-ton', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          username: cleanUser,
          amount_ton: numAmount,
          description: 'Выдача через панель администратора @zapixxgarant',
        }),
      })

      const data = await res.json()

      if (res.ok && data.ok) {
        setStatus({
          type: 'success',
          text: `Успешно! Пользователю @${cleanUser} начислено ${numAmount} TON. Текущий баланс: ${data.new_balance} TON.`,
        })

        // Локально зачисляем только если выдача подтверждена сервером и получатель — сам админ
        const tgUser = getTelegramUser()
        const currentActiveUsername = (tgUser?.username || '').toLowerCase().replace(/^@/, '')
        if (currentActiveUsername !== '' && currentActiveUsername === cleanUser.toLowerCase()) {
          credit(Math.round(numAmount * 1000))
        }

        setUsername('')
      } else {
        setStatus({
          type: 'error',
          text: data.detail || 'Ошибка при начислении TON.',
        })
      }
    } catch {
      // Без ответа сервера деньги не создаются
      setStatus({ type: 'error', text: 'Сервер недоступен — выдача не выполнена, баланс не изменён.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.body}>
        {myName && (
          <button type="button" className={styles.pill} onClick={() => setUsername(myName)}>
            Себе (@{myName})
          </button>
        )}

        <Input
          label="Юзернейм получателя"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          hint="Игрок должен хотя бы один раз запустить бота"
        />

        <Input
          label="Сумма в TON"
          type="number"
          step="0.1"
          min="0.1"
          placeholder="10"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          suffix="TON"
        />

        <div className={styles.quickPills}>
          {['5', '10', '25', '50', '100'].map((p) => (
            <button
              key={p}
              type="button"
              className={styles.pill}
              onClick={() => setAmount(p)}
            >
              +{p} TON
            </button>
          ))}
        </div>

        {username.trim().replace(/^@/, '') && Number(amount.replace(',', '.')) > 0 && (
          <div className={styles.statusMessage}>
            Будет начислено <b>{amount.replace(',', '.')} TON</b> игроку <b>@{username.trim().replace(/^@/, '')}</b>.
            Проверьте ник — отменить начисление нельзя.
          </div>
        )}

        {status && (
          <div className={`${styles.statusMessage} ${styles[status.type]}`}>
            {status.text}
          </div>
        )}

        <Button
          fullWidth
          className={styles.submitBtn}
          onClick={handleGiveTon}
          disabled={loading}
        >
          {loading ? 'Начисление...' : '🚀 Выдать TON'}
        </Button>
      </div>
  )
}
