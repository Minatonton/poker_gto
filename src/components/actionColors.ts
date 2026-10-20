import type { Action, ActionKind } from '../poker/strategy'

const BASE_COLORS: Record<ActionKind, string> = {
  raise: 'var(--action-raise)',
  call: 'var(--action-call)',
  fold: 'var(--action-fold)',
}

const SHADE_STEP_PERCENT = 18

export function actionColor(action: Action): string {
  const base = BASE_COLORS[action.kind]
  if (!action.shade) return base
  return `color-mix(in srgb, ${base}, #000 ${Math.min(action.shade * SHADE_STEP_PERCENT, 60)}%)`
}

export const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`
