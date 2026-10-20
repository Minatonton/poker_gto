/** まだ誰もレイズしていないときに並べるオープンの額（bb） */
const OPEN_SIZES = [2, 2.5, 3, 4]
/** 誰かのレイズを受けたときに並べる、その額に対する倍率 */
const RERAISE_MULTIPLIERS = [2.5, 3, 4, 5]

const roundToHalf = (bb: number) => Math.round(bb * 2) / 2

/**
 * プリフロップのレイズで選べる額の候補。データにある額（GTO の額）を必ず含めて、小さい順に並べる。
 * データが1つの額しか持たないので、ほかの候補は「サイズを選ぶ練習」のための選択肢で、
 * 選んでも戦略はデータの額のもので続ける
 */
export function preflopSizeChoices(gtoAmount: number, currentBet: number): number[] {
  const candidates =
    currentBet <= 1 ? OPEN_SIZES : RERAISE_MULTIPLIERS.map((multiple) => roundToHalf(currentBet * multiple))
  return [...new Set([...candidates, gtoAmount])].sort((a, b) => a - b)
}

/** 額が GTO の額と同じか。データの額は 0.5bb 刻みとは限らないので、表示の丸め誤差だけ許す */
export const isGtoSize = (chosen: number, gtoAmount: number) => Math.abs(chosen - gtoAmount) < 0.01
