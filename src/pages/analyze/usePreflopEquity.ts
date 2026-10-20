import { useMemo } from 'react'
import { cardToId } from '../../poker/cards'
import { equityVsRange } from '../../poker/equity'
import type { Hero } from '../../poker/hero'
import { preflopMatchup, type PreflopMatchup } from '../../poker/matchup'
import type { Walk } from '../../poker/preflop'

/** 画面の操作を止めない程度の抽選回数。誤差は ±1% 前後 */
const SAMPLES = 4000

export interface PreflopEquity extends PreflopMatchup {
  equity: number | null
}

/** 自分が席に座って手札を選んでいるときだけ、いまのラインでの自分の EQ を求める */
export function usePreflopEquity(walk: Walk, hero: Hero): PreflopEquity | null {
  const matchup = useMemo(
    () => (hero.position ? preflopMatchup(walk.steps, walk.positions, hero.position) : null),
    [walk.steps, walk.positions, hero.position],
  )
  return useMemo(() => {
    if (!matchup || !hero.cards) return null
    try {
      const ids = hero.cards.map(cardToId) as [number, number]
      return { ...matchup, equity: equityVsRange(ids, [], matchup.range, SAMPLES).equity }
    } catch {
      return { ...matchup, equity: null }
    }
  }, [matchup, hero.cards])
}
