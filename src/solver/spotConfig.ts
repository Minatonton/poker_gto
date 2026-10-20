import { toRangeNotation, type PostflopSpot } from '../poker/postflopSpot'
import { CHIPS_PER_BB, type SizeOptions, type SpotConfig } from './types'

export type Street = 'flop' | 'turn' | 'river'
export type StreetSizeOptions = Record<Street, SizeOptions>

/** プリフロップで作ったスポットと、ボード・ベットサイズからソルバーへの入力を作る。ベットサイズは両者で共通にする */
export function spotConfig(spot: PostflopSpot, board: string, sizes: StreetSizeOptions): SpotConfig {
  const sameForBoth = (street: Street) => ({ oop: sizes[street], ip: sizes[street] })
  return {
    oopRange: toRangeNotation(spot.oopRange),
    ipRange: toRangeNotation(spot.ipRange),
    board,
    startingPot: Math.round(spot.potBb * CHIPS_PER_BB),
    effectiveStack: Math.round(spot.effectiveStackBb * CHIPS_PER_BB),
    rakeRate: 0,
    rakeCap: 0,
    flop: sameForBoth('flop'),
    turn: sameForBoth('turn'),
    river: sameForBoth('river'),
    addAllinThreshold: 1.5,
    forceAllinThreshold: 0.15,
  }
}
