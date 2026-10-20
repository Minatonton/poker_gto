export type Grade = 'best' | 'correct' | 'inaccuracy' | 'wrong' | 'blunder'

export const GRADES: { grade: Grade; label: string; description: string }[] = [
  { grade: 'best', label: 'Best', description: 'GTO が最も多く選ぶアクション' },
  { grade: 'correct', label: 'Correct', description: 'GTO も選ぶアクションで、損はほとんどない' },
  { grade: 'inaccuracy', label: 'Inaccuracy', description: 'GTO はまれにしか選ばない' },
  { grade: 'wrong', label: 'Wrong', description: 'GTO はほぼ選ばず、EV を失う' },
  { grade: 'blunder', label: 'Blunder', description: '大きく EV を失う' },
]

/** ここまでの頻度なら「GTO も選ぶアクション」とみなす */
const CORRECT_MIN_FREQUENCY = 0.25
/** これ未満の頻度は、ソルバーの誤差とほぼ区別がつかない */
const INACCURACY_MIN_FREQUENCY = 0.03

/**
 * 頻度だけで採点する。プリフロップのデータは EV を持たないため。
 * EV がないので Blunder は付けず、最も悪くても Wrong にしている。
 * rng（0〜1）を渡すと、頻度の区間のうち rng が入るアクションだけを Best にする。
 * 混合戦略を「毎回独立に、決めた頻度どおりに選ぶ」練習のため
 */
export function gradeByFrequency(frequencies: readonly number[], chosen: number, rng?: number): Grade {
  if (rng !== undefined) {
    if (chosen === actionForRng(frequencies, rng)) return 'best'
  } else if (frequencies[chosen] >= Math.max(...frequencies)) {
    return 'best'
  }
  const frequency = frequencies[chosen]
  if (frequency >= CORRECT_MIN_FREQUENCY) return 'correct'
  if (frequency >= INACCURACY_MIN_FREQUENCY) return 'inaccuracy'
  return 'wrong'
}

/** 頻度を並び順に 0〜1 の区間へ割り当て、rng が入る区間のアクション */
export function actionForRng(frequencies: readonly number[], rng: number): number {
  let cumulative = 0
  for (let i = 0; i < frequencies.length; i++) {
    cumulative += frequencies[i]
    if (rng < cumulative) return i
  }
  return frequencies.length - 1
}

/** EV の損失（ポット比）の境目。GTO Wizard のトレーナーの段階に合わせた目安 */
const CORRECT_MAX_LOSS = 0.01
const INACCURACY_MAX_LOSS = 0.03
const WRONG_MAX_LOSS = 0.1

/** EV の損失で採点する。頻度が最も高いアクションは、EV の差が誤差の範囲でも Best にする */
export function gradeByEv(
  frequencies: readonly number[],
  evs: readonly number[],
  chosen: number,
  pot: number,
  rng?: number,
): { grade: Grade; evLoss: number } {
  const evLoss = Math.max(0, Math.max(...evs) - evs[chosen])
  const byFrequency = gradeByFrequency(frequencies, chosen, rng)
  if (byFrequency === 'best') return { grade: 'best', evLoss }
  const lossRatio = evLoss / pot
  if (lossRatio <= CORRECT_MAX_LOSS) return { grade: 'correct', evLoss }
  if (lossRatio <= INACCURACY_MAX_LOSS) return { grade: 'inaccuracy', evLoss }
  if (lossRatio <= WRONG_MAX_LOSS) return { grade: 'wrong', evLoss }
  return { grade: 'blunder', evLoss }
}
