import type { Action } from '../../poker/strategy'

/** 押したキーに対応するアクション。F = Fold、C = Check/Call、R = 最初のベット・レイズ、1〜9 = 並び順 */
export function actionForKey(actions: Action[], key: string): number | null {
  const lower = key.toLowerCase()
  if (/^[1-9]$/.test(lower)) {
    const index = Number(lower) - 1
    return index < actions.length ? index : null
  }
  const kind = lower === 'f' ? 'fold' : lower === 'c' ? 'call' : lower === 'r' ? 'raise' : null
  if (!kind) return null
  const index = actions.findIndex((a) => a.kind === kind)
  return index === -1 ? null : index
}
