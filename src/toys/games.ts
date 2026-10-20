export type Hand = 'rock' | 'paper' | 'scissors'

export const HANDS: { hand: Hand; label: string }[] = [
  { hand: 'rock', label: 'グー' },
  { hand: 'paper', label: 'パー' },
  { hand: 'scissors', label: 'チョキ' },
]

export type Mix = Record<Hand, number>

/** 相手の出し方に対して、それぞれの手を出し続けたときの EV（勝ち +1、負け -1、あいこ 0） */
export function rpsEvs(opponent: Mix): Mix {
  return {
    rock: opponent.scissors - opponent.paper,
    paper: opponent.rock - opponent.scissors,
    scissors: opponent.paper - opponent.rock,
  }
}

export function rpsEv(mine: Mix, opponent: Mix): number {
  const evs = rpsEvs(opponent)
  return HANDS.reduce((sum, { hand }) => sum + mine[hand] * evs[hand], 0)
}

/** 相手に対して最も EV の高い手（最大搾取戦略） */
export function rpsBestResponse(opponent: Mix): Hand {
  const evs = rpsEvs(opponent)
  return HANDS.reduce((best, { hand }) => (evs[hand] > evs[best] ? hand : best), 'rock' as Hand)
}

/*
 * AKQ ゲーム: リバーで、打つ側は A（必ず勝つ）か Q（必ず負ける）を半々で持ち、受ける側は K だけを持つ。
 * 打つ側は A では必ずベットし、Q ではブラフの頻度を選ぶ。受ける側は K でコールする頻度を選ぶ。
 * ポットとベットはどちらも同じ単位（例: bb）
 */

export interface AkqEquilibrium {
  /** Q でブラフする頻度。受ける側のコールとフォールドを無差別にする */
  bluffFrequency: number
  /** K でコールする頻度（MDF）。打つ側の Q のブラフとチェックを無差別にする */
  callFrequency: number
  /** 打つ側の EV。ポットのうち取り戻せる平均 */
  bettorEv: number
}

export function akqEquilibrium(pot: number, bet: number): AkqEquilibrium {
  const bluffFrequency = bet / (pot + bet)
  const callFrequency = pot / (pot + bet)
  return { bluffFrequency, callFrequency, bettorEv: akqBettorEv(pot, bet, bluffFrequency, callFrequency) }
}

/** 打つ側の EV。A は必ずベットし、Q は bluff の頻度でベットする */
export function akqBettorEv(pot: number, bet: number, bluff: number, call: number): number {
  const withAce = pot + call * bet
  const withQueen = bluff * ((1 - call) * pot - call * bet)
  return 0.5 * withAce + 0.5 * withQueen
}

const EPSILON = 1e-9

/** 相手の頻度に対する最善の対応。均衡の頻度ちょうどなら、どちらを選んでも EV は同じ */
export function akqBestResponses(pot: number, bet: number, bluff: number, call: number) {
  const eq = akqEquilibrium(pot, bet)
  // 相手のブラフが多すぎればいつもコール、少なすぎればいつもフォールド
  const caller =
    bluff > eq.bluffFrequency + EPSILON ? '必ずコール' : bluff < eq.bluffFrequency - EPSILON ? '必ずフォールド' : 'どちらでも同じ'
  // 相手のコールが少なすぎればいつもブラフ、多すぎればブラフしない
  const bettor =
    call < eq.callFrequency - EPSILON ? '必ずブラフ' : call > eq.callFrequency + EPSILON ? 'ブラフしない' : 'どちらでも同じ'
  return { caller, bettor }
}
