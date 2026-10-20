import { useSyncExternalStore } from 'react'

export type Cue = 'action' | 'deal' | 'good' | 'bad' | 'streak'

const SOUND_KEY = 'poker-gto:sound'

/** 音は端末ごとの好みなので、ブラウザにだけ残す。読めなければ鳴らす設定にする */
function loadEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = loadEnabled()
const listeners = new Set<() => void>()
let context: AudioContext | null = null

export function setSoundEnabled(next: boolean) {
  enabled = next
  try {
    localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
  } catch {
    // 保存できなくても、この画面を開いている間は切り替えが効く
  }
  listeners.forEach((listener) => listener())
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => enabled,
  )
}

/** [周波数 Hz, 開始までの秒, 長さ秒] の並び。効果音のファイルを持たずに済むよう、その場で合成する */
const NOTES: Record<Cue, [number, number, number][]> = {
  action: [[660, 0, 0.05]],
  deal: [
    [1200, 0, 0.03],
    [1500, 0.05, 0.03],
  ],
  good: [
    [660, 0, 0.09],
    [880, 0.08, 0.14],
  ],
  streak: [
    [660, 0, 0.08],
    [880, 0.07, 0.08],
    [1320, 0.14, 0.18],
  ],
  bad: [
    [220, 0, 0.12],
    [180, 0.1, 0.18],
  ],
}

export function playCue(cue: Cue) {
  if (!enabled || typeof AudioContext === 'undefined') return
  try {
    context ??= new AudioContext()
    const now = context.currentTime
    for (const [frequency, start, length] of NOTES[cue]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = cue === 'bad' ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.08, now + start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now + start)
      oscillator.stop(now + start + length + 0.02)
    }
  } catch {
    // 音が出せない環境でも操作は続けられるようにする
  }
}
