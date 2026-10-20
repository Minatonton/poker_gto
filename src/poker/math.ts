/** コールで得られる見返りの倍率。勝ったときに得るチップ（自分のコール分を含む）÷ 新たに危険に晒すチップ */
export function odds(potIncludingBets: number, toCall: number): number {
  return (potIncludingBets + toCall) / toCall
}

/** コールが損益分岐になる EQ（1 ÷ オッズ） */
export function requiredEquity(potIncludingBets: number, toCall: number): number {
  return toCall / (potIncludingBets + toCall)
}

/**
 * オールインにコールしたときの EV（コールしなければ 0）。勝てばポット全体を取り、負ければコール額を失う。
 * オールインでないときは後のストリートで EQ を取りこぼすため、この値は上限の目安になる
 */
export function allInCallEv(potIncludingBets: number, toCall: number, equity: number): number {
  return equity * (potIncludingBets + toCall) - toCall
}

/** EQ のうち実際に取り戻せている割合。EV ÷ (EQ × ポット) */
export function equityRealization(ev: number, equity: number, pot: number): number | null {
  return equity > 0 && pot > 0 ? ev / (equity * pot) : null
}

/** ベット前のポットに対してベットされたときの必要勝率。bet ÷ (pot + bet + bet) */
export function requiredEquityAgainstBet(pot: number, bet: number): number {
  return requiredEquity(pot + bet, bet)
}

/** 相手のブラフを利益にさせないために、レンジのうち降りずに守る必要がある割合 */
export function minimumDefenseFrequency(pot: number, bet: number): number {
  return pot / (pot + bet)
}

/** リバーで二極化したレンジがベットするとき、相手のコールとフォールドを無差別にするブラフの割合 */
export function bluffRatio(pot: number, bet: number): number {
  return bet / (pot + 2 * bet)
}

export const potPercent = (pot: number, bet: number) => bet / pot

/** 見えていないカード unseen 枚から cards 枚めくって、outs のどれかが1枚以上出る確率 */
export function hitProbability(outs: number, unseen: number, cards: 1 | 2): number {
  if (cards === 1) return outs / unseen
  const miss = ((unseen - outs) / unseen) * ((unseen - outs - 1) / (unseen - 1))
  return 1 - miss
}

/** 2倍4倍の法則。残り1枚ならアウツ×2%、2枚ならアウツ×4% */
export function ruleOfTwoAndFour(outs: number, cards: 1 | 2): number {
  return (outs * (cards === 1 ? 2 : 4)) / 100
}

export interface GeometricPlan {
  /** 毎ストリート同じポット比で打つときの比率 */
  betFraction: number
  /** 各ストリートのベット額と、コールされた後のポット */
  streets: { pot: number; bet: number; potAfterCall: number }[]
}

/**
 * 残りストリート数で、ちょうどオールインに届くように毎回同じポット比で打つサイズ。
 * ベットとコールでポットは (1 + 2x) 倍になるので、(1 + 2x)^n = (pot + 2 × stack) / pot を x について解く
 */
export function geometricBet(pot: number, stack: number, streets: number): GeometricPlan {
  const growth = Math.pow((pot + 2 * stack) / pot, 1 / streets)
  const betFraction = (growth - 1) / 2
  const plan: GeometricPlan['streets'] = []
  let current = pot
  for (let i = 0; i < streets; i++) {
    const bet = current * betFraction
    plan.push({ pot: current, bet, potAfterCall: current + 2 * bet })
    current += 2 * bet
  }
  return { betFraction, streets: plan }
}
