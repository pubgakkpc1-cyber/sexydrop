import { authHeaders } from '../../lib/auth'
import { useState, useEffect } from 'react'
import { Modal, Button, Input } from '../ui'
import {
  getAdminCrashState,
  setAdminNextCrashPoint,
  adminForceRestartCrashRound,
} from '../../services/demoCrashService'
import { useWalletStore } from '../../store/wallet'
import { getTelegramUser } from '../../lib/telegram'
import { TonIcon, ZapIcon, SparkleIcon } from '../shell/icons'
import styles from './CrashMiniAdminModal.module.css'

interface CrashMiniAdminModalProps {
  open: boolean
  onClose: () => void
}

export function CrashMiniAdminModal({ open, onClose }: CrashMiniAdminModalProps) {
  const [telemetry, setTelemetry] = useState(getAdminCrashState())
  const [targetUsername, setTargetUsername] = useState('zapixxgarant')
  const [giveAmount, setGiveAmount] = useState('50')
  const [customMultiplier, setCustomMultiplier] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Проверка прав администратора
  const tgUser = getTelegramUser()
  const cleanUsername = (tgUser?.username || '').toLowerCase().replace(/^@/, '')
  const isAdmin =
    cleanUsername === 'zapixxgarant' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('sexydrop_admin') === 'true')

  // Регулярное обновление телеметрии при открытом окне
  useEffect(() => {
    if (!open) return
    const interval = setInterval(() => {
      setTelemetry(getAdminCrashState())
    }, 500)
    return () => clearInterval(interval)
  }, [open])

  if (!isAdmin) {
    return null
  }

  // Обработка выдачи TON
  const handleGiveTon = async (amount: number) => {
    setLoading(true)
    setStatusMessage(null)
    const cleanUser = targetUsername.trim().replace(/^@/, '')
    if (!cleanUser) {
      setStatusMessage('Укажите username получателя')
      setLoading(false)
      return
    }

    try {
      const resp = await fetch('/api/admin/give-ton', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          username: cleanUser,
          amount_ton: amount,
          description: `Выдача через Crash Mini Admin (@${cleanUser})`,
        }),
      })

      await resp.json().catch(() => ({}))

      if (!resp.ok) {
        // Если оффлайн / демо-режим, начисляем в локальный стор кошелька
        const minor = Math.round(amount * 1000)
        useWalletStore.getState().credit(minor)
        setStatusMessage(`Баланс пополнен на +${amount} TON (Local/Demo)`)
      } else {
        const minor = Math.round(amount * 1000)
        useWalletStore.getState().credit(minor)
        setStatusMessage(`Успешно начислено +${amount} TON для @${cleanUser}!`)
      }
    } catch {
      const minor = Math.round(amount * 1000)
      useWalletStore.getState().credit(minor)
      setStatusMessage(`Баланс пополнен на +${amount} TON`)
    } finally {
      setLoading(false)
    }
  }

  // Установка следующего множителя
  const handleSetMultiplier = (val: number | null) => {
    setAdminNextCrashPoint(val)
    setTelemetry(getAdminCrashState())
    setStatusMessage(
      val !== null ? `Следующий раунд крашнется на x${val.toFixed(2)}` : 'Сброшено на честный рандом',
    )
  }

  // Принудительный перезапуск
  const handleRestart = () => {
    adminForceRestartCrashRound()
    setTelemetry(getAdminCrashState())
    setStatusMessage('Раунд перезапущен!')
  }

  return (
    <Modal open={open} onClose={onClose} title="👑 Управление Ракеткой (Admin)">
      <div className={styles.container}>
        {/* Статус телеметрии */}
        <div className={styles.telemetryCard}>
          <div className={styles.telemetryRow}>
            <span>Раунд:</span>
            <strong>#{telemetry.roundId}</strong>
          </div>
          <div className={styles.telemetryRow}>
            <span>Фаза:</span>
            <span className={styles.phaseBadge} data-phase={telemetry.phase}>
              {telemetry.phase}
            </span>
          </div>
          <div className={styles.telemetryRow}>
            <span>Скрытый краш раунда:</span>
            <strong style={{ color: '#c7696d' }}>
              {telemetry.currentCrashPoint ? `x${telemetry.currentCrashPoint.toFixed(2)}` : 'Скрыто'}
            </strong>
          </div>
          <div className={styles.telemetryRow}>
            <span>Запланированный краш:</span>
            <strong style={{ color: telemetry.nextOverride ? '#389173' : '#b89496' }}>
              {telemetry.nextOverride ? `x${telemetry.nextOverride.toFixed(2)}` : 'Рандом (RTP 0.98)'}
            </strong>
          </div>
        </div>

        {/* Быстрая выдача TON */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <TonIcon className={styles.sectionIcon} />
            <span>Выдать TON</span>
          </h4>
          <div className={styles.inputGroup}>
            <Input
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="@username"
            />
          </div>
          <div className={styles.chipsRow}>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleGiveTon(10)}
              disabled={loading}
            >
              +10 TON
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleGiveTon(50)}
              disabled={loading}
            >
              +50 TON
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleGiveTon(100)}
              disabled={loading}
            >
              +100 TON
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleGiveTon(500)}
              disabled={loading}
            >
              +500 TON
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <Input
              value={giveAmount}
              onChange={(e) => setGiveAmount(e.target.value)}
              placeholder="Своя сумма"
              style={{ flex: 1 }}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const parsed = parseFloat(giveAmount)
                if (parsed > 0) handleGiveTon(parsed)
              }}
              disabled={loading}
            >
              Выдать
            </Button>
          </div>
        </div>

        {/* Управление точкой краша */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <ZapIcon className={styles.sectionIcon} />
            <span>Задать краш следующего раунда</span>
          </h4>
          <div className={styles.chipsRow}>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleSetMultiplier(1.5)}
            >
              x1.50
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleSetMultiplier(2.0)}
            >
              x2.00
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleSetMultiplier(5.0)}
            >
              x5.00
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleSetMultiplier(10.0)}
            >
              x10.00
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleSetMultiplier(50.0)}
            >
              x50.00
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              onClick={() => handleSetMultiplier(null)}
              style={{ borderColor: 'rgba(206, 101, 101, 0.4)' }}
            >
              Рандом
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <Input
              value={customMultiplier}
              onChange={(e) => setCustomMultiplier(e.target.value)}
              placeholder="Свой множитель (напр. 7.77)"
              style={{ flex: 1 }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const val = parseFloat(customMultiplier)
                if (val >= 1.01) {
                  handleSetMultiplier(val)
                  setCustomMultiplier('')
                }
              }}
            >
              Применить
            </Button>
          </div>
        </div>

        {/* Действия раунда */}
        <div className={styles.section}>
          <Button variant="danger" size="md" onClick={handleRestart}>
            Перезапустить раунд немедленно
          </Button>
        </div>

        {/* Сообщения обратной связи */}
        {statusMessage && (
          <div className={styles.statusToast}>
            <SparkleIcon style={{ width: '15px', height: '15px', flexShrink: 0 }} />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
