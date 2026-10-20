import type { Position } from '../poker/preflop'
import type { ActionKind } from '../poker/strategy'

/** Amu 氏の note「思考をハンドレビューする」の、ずれの原因の分け方 */
export const MISTAKE_KINDS = [
  'ボードの戦略の誤解',
  'ハンド選びの誤解',
  '別のスポットの知識を流用した',
  '相手の読み違い',
  'GTO どおりだった',
  'その他',
] as const

export type MistakeKind = (typeof MISTAKE_KINDS)[number]

export interface HandReview {
  id: string
  createdAt: string
  /** 卓の人数とプリフロップのライン。記録した局面を開き直すのに使う */
  players: number
  choices: ActionKind[]
  heroPosition: Position | null
  heroCards: string
  board: string
  /** 記録した時点の GTO の頻度の要約（例: AKs: 3Bet 11bb 100%） */
  gtoSummary: string
  myAction: string
  thought: string
  mistakeKind: MistakeKind | ''
  evSource: string
  lesson: string
  nextTime: string
  opponent: string
}

export function newReview(fields: Partial<HandReview> = {}): HandReview {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    players: 6,
    choices: [],
    heroPosition: null,
    heroCards: '',
    board: '',
    gtoSummary: '',
    myAction: '',
    thought: '',
    mistakeKind: '',
    evSource: '',
    lesson: '',
    nextTime: '',
    opponent: '',
    ...fields,
  }
}

const STORAGE_KEY = 'poker-gto:reviews'

/**
 * 記録はこの端末のブラウザに保存する。ブラウザのデータを消すと失われるため、
 * 画面から JSON に書き出して残せるようにしている
 */
export function loadReviews(): HandReview[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.map((r) => newReview(r)) : []
  } catch {
    return []
  }
}

export function saveReviews(reviews: HandReview[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
    return true
  } catch {
    return false
  }
}

/** 書き出した JSON を読み込む。同じ id の記録は読み込んだ方で上書きする */
export function mergeReviews(current: HandReview[], imported: unknown): HandReview[] {
  if (!Array.isArray(imported)) throw new Error('記録の JSON ではありません')
  const byId = new Map(current.map((r) => [r.id, r]))
  for (const item of imported) {
    if (typeof item !== 'object' || item === null || typeof (item as HandReview).id !== 'string') {
      throw new Error('記録の形式が正しくありません')
    }
    byId.set((item as HandReview).id, newReview(item as HandReview))
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
