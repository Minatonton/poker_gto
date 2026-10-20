import type { ActionKind } from '../poker/strategy'

export const ACTION_COLORS: Record<ActionKind, string> = {
  raise: 'var(--action-raise)',
  call: 'var(--action-call)',
  fold: 'var(--action-fold)',
}

export const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`
