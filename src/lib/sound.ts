/**
 * Синтезатор звуков рулетки и победы на Web Audio API.
 * Работает без внешних mp3-файлов, мгновенный отклик, безопасно для iOS/Telegram/Chrome.
 */

let audioCtx: AudioContext | null = null
let isSoundMuted = false

export function setSoundMuted(muted: boolean): void {
  isSoundMuted = muted
}

export function isSoundEnabled(): boolean {
  return !isSoundMuted
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || isSoundMuted) return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      /* автоплей может быть заблокирован до первого клика */
    })
  }
  return audioCtx
}

/**
 * Короткий механический щелчок прокрута рулетки при пересечении карточки.
 * Частота слегка варьируется от скорости прокрутки.
 */
export function playRouletteTick(pitch = 1.0): void {
  if (isSoundMuted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    // Резкий высокочастотный щелчок с быстрым спадом
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(600 * pitch, now)
    osc.frequency.exponentialRampToValueAtTime(150 * pitch, now + 0.02)

    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.03)
  } catch {
    /* безопасность при сбое Web Audio */
  }
}

/**
 * Торжественный победный аккорд при выпадении приза.
 */
export function playWinChime(): void {
  if (isSoundMuted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6 (мажорное трезвучие)
    const start = ctx.currentTime

    notes.forEach((freq, idx) => {
      const noteTime = start + idx * 0.08
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, noteTime)

      gain.gain.setValueAtTime(0.15, noteTime)
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(noteTime)
      osc.stop(noteTime + 0.5)
    })
  } catch {
    /* безопасность при сбое Web Audio */
  }
}

/**
 * Высокотехнологичный щелчок обратного отсчёта перед стартом ракеты.
 */
export function playCountdownTick(secondsLeft: number): void {
  if (isSoundMuted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    // На последней секунде тон выше и акцентированнее
    const freq = secondsLeft <= 1 ? 880 : secondsLeft <= 3 ? 660 : 520
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 0.05)

    const vol = secondsLeft <= 1 ? 0.22 : 0.14
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.09)
  } catch {
    /* no-op */
  }
}

/**
 * Звук взлёта ракеты (нарастающий реактивный импульс).
 */
export function playRocketLaunch(): void {
  if (isSoundMuted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.35)

    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.42)
  } catch {
    /* no-op */
  }
}

interface ActiveFlightAudio {
  osc1: OscillatorNode
  osc2: OscillatorNode
  noiseNode: AudioBufferSourceNode
  filter: BiquadFilterNode
  masterGain: GainNode
  ctx: AudioContext
}

let activeFlightAudio: ActiveFlightAudio | null = null

/**
 * Непрерывный космический звук полёта ракеты (гул двигателя и аэродинамический вихрь).
 * Плавный старт, непрерывный цикл, частота нарастает по мере разгона множителя.
 */
export function startRocketFlightSound(initialMultiplier = 1.0): void {
  if (isSoundMuted) return
  try {
    stopRocketFlightSound()
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    // 1. Низкочастотный рокот сопла двигателя (саб-осцилляторы)
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    osc1.type = 'sawtooth'
    osc2.type = 'triangle'

    const factor = Math.min(2.8, 1 + Math.log2(Math.max(1, initialMultiplier)) * 0.35)
    osc1.frequency.setValueAtTime(62 * factor, now)
    osc2.frequency.setValueAtTime(42 * factor, now)

    // 2. Аэродинамический шум разреженного космоса и плазменного потока (Looping Pink/Filtered Noise)
    const sampleRate = ctx.sampleRate || 44100
    const bufferSize = Math.floor(sampleRate * 2.0)
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0.0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.03 * white) / 1.03
      data[i] = last * 3.2
    }

    const noiseNode = ctx.createBufferSource()
    noiseNode.buffer = buffer
    noiseNode.loop = true

    // 3. Резонансный НЧ-фильтр для ощущения турбины
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    const cutoff = Math.min(1400, 320 + Math.log2(Math.max(1, initialMultiplier)) * 360)
    filter.frequency.setValueAtTime(cutoff, now)
    filter.Q.setValueAtTime(1.8, now)

    // 4. Мастер-громкость с мягкой огибающей появления (без щелчка)
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.001, now)
    masterGain.gain.linearRampToValueAtTime(0.18, now + 0.15)

    // Коммутация узлов
    osc1.connect(filter)
    osc2.connect(filter)
    noiseNode.connect(filter)
    filter.connect(masterGain)
    masterGain.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    noiseNode.start(now)

    activeFlightAudio = {
      osc1,
      osc2,
      noiseNode,
      filter,
      masterGain,
      ctx,
    }
  } catch {
    /* безопасность при сбое Web Audio */
  }
}

/**
 * Динамическая модуляция звука полёта по текущему множителю (усиление тяги).
 */
export function updateRocketFlightSound(multiplier: number): void {
  if (!activeFlightAudio || isSoundMuted) return
  try {
    const { osc1, osc2, filter, masterGain, ctx } = activeFlightAudio
    const now = ctx.currentTime
    const factor = Math.min(2.8, 1 + Math.log2(Math.max(1, multiplier)) * 0.35)
    osc1.frequency.setTargetAtTime(62 * factor, now, 0.08)
    osc2.frequency.setTargetAtTime(42 * factor, now, 0.08)

    const cutoff = Math.min(1400, 320 + Math.log2(Math.max(1, multiplier)) * 360)
    filter.frequency.setTargetAtTime(cutoff, now, 0.08)

    const targetGain = Math.min(0.24, 0.16 + Math.log2(Math.max(1, multiplier)) * 0.04)
    masterGain.gain.setTargetAtTime(targetGain, now, 0.08)
  } catch {
    /* no-op */
  }
}

/**
 * Мгновенная плавная остановка звука полёта при взрыве или выходе с экрана.
 */
export function stopRocketFlightSound(): void {
  if (!activeFlightAudio) return
  try {
    const { osc1, osc2, noiseNode, masterGain, ctx } = activeFlightAudio
    const now = ctx.currentTime
    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.setValueAtTime(masterGain.gain.value, now)
    masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.06)

    setTimeout(() => {
      try {
        osc1.stop()
        osc2.stop()
        noiseNode.stop()
        osc1.disconnect()
        osc2.disconnect()
        noiseNode.disconnect()
      } catch {
        /* no-op */
      }
    }, 70)
  } catch {
    /* no-op */
  } finally {
    activeFlightAudio = null
  }
}

/**
 * Глубокий кинематографичный космический взрыв при краше ракеты.
 * Комбинирует саб-бас импульс, фильтрованный шум взрывной волны и детонационный щелчок.
 */
export function playCrashBoom(): void {
  if (isSoundMuted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    // 1. Низкочастотный саб-бас импульс (ударная волна)
    const subOsc = ctx.createOscillator()
    const subGain = ctx.createGain()
    subOsc.type = 'triangle'
    subOsc.frequency.setValueAtTime(140, now)
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.55)

    subGain.gain.setValueAtTime(0.35, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    subOsc.connect(subGain)
    subGain.connect(ctx.destination)
    subOsc.start(now)
    subOsc.stop(now + 0.62)

    // 2. Взрывной шум обломков и огня (Filtered Noise Burst)
    const bufferSize = Math.floor(ctx.sampleRate * 0.45)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1
    }

    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1200, now)
    filter.frequency.exponentialRampToValueAtTime(60, now + 0.45)

    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.25, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48)

    whiteNoise.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)

    whiteNoise.start(now)
    whiteNoise.stop(now + 0.5)
  } catch {
    /* no-op */
  }
}

/**
 * Звонкий кристальный перезвон успешного кешаута.
 */
export function playCashoutWin(): void {
  if (isSoundMuted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    const freqs = [659.25, 880, 1174.66, 1760] // E5, A5, D6, A6

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const noteTime = now + idx * 0.05

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, noteTime)

      gain.gain.setValueAtTime(0.15, noteTime)
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(noteTime)
      osc.stop(noteTime + 0.38)
    })
  } catch {
    /* no-op */
  }
}
