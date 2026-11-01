import { useNavigate } from 'react-router-dom'
import { BottomSheet, Button } from '../ui'

interface DepositRequiredSheetProps {
  onClose: () => void
}

/**
 * FREE 24: после трёх бесплатных прокрутов просим пополнить баланс на 50 Stars или 0.25 TON,
 * чтобы продолжить. Игроку об этом заранее не сообщается — окно появляется после третьего прокрута.
 */
export function DepositRequiredSheet({ onClose }: DepositRequiredSheetProps) {
  const navigate = useNavigate()
  return (
    <BottomSheet open onClose={onClose} title="Продолжить бесплатные прокруты">
      <div style={{ display: 'grid', gap: 12 }}>
        <p>
          Вы уже сделали 3 бесплатных прокрута. Чтобы открывать FREE 24 дальше, пополните баланс на
          <strong> 50 Stars</strong> или <strong>0.25 TON</strong>. Пополнение остаётся у вас на балансе.
        </p>
        <Button fullWidth onClick={() => navigate('/deposit?tab=stars')}>
          Пополнить на 50 Stars
        </Button>
        <Button fullWidth variant="secondary" onClick={() => navigate('/deposit?tab=ton')}>
          Пополнить на 0.25 TON
        </Button>
        <Button fullWidth variant="ghost" onClick={onClose}>
          Позже
        </Button>
      </div>
    </BottomSheet>
  )
}
