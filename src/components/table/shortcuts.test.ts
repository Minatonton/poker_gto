import { describe, expect, it } from 'vitest'
import { actionForKey } from './shortcuts'

const actions = [
  { kind: 'raise' as const, label: '3Bet 7.5bb' },
  { kind: 'call' as const, label: 'Call' },
  { kind: 'fold' as const, label: 'Fold' },
]

describe('actionForKey', () => {
  it('F・C・R でフォールド・コール・最初のレイズを選ぶ', () => {
    expect(actionForKey(actions, 'f')).toBe(2)
    expect(actionForKey(actions, 'C')).toBe(1)
    expect(actionForKey(actions, 'r')).toBe(0)
  })

  it('数字キーは並び順で選ぶ', () => {
    expect(actionForKey(actions, '1')).toBe(0)
    expect(actionForKey(actions, '3')).toBe(2)
  })

  it('対応するアクションがなければ null', () => {
    expect(actionForKey(actions, '4')).toBeNull()
    expect(actionForKey([actions[2]], 'c')).toBeNull()
    expect(actionForKey(actions, 'x')).toBeNull()
  })
})
