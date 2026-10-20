import type { Position, PreflopSolution, SpotSpec } from '../poker/preflop'
import { cash6max100bb as sixMax } from './cash6max100bb'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 9

const SEATS: Record<number, readonly Position[]> = {
  2: ['SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
}

/*
 * 6人卓より後ろに人が多い席のオープンレンジ。Amu 氏の note「プリフロップレンジの覚え方」の
 * 「後ろの人数で境界が決まる」考え方に沿って、6人卓の UTG（後ろ5人）より一段ずつ絞っている。
 * いずれも近似値で、ソルバーの出力ではない。
 */
const EARLY_RFI: Record<number, SpotSpec> = {
  6: {
    raiseTo: 2.5,
    raise: '55+, 44:0.5, A8s+, A5s-A3s, K9s+, Q9s+, J9s+, T9s, 98s, 87s:0.5, AJo+, ATo:0.5, KQo, KJo:0.5',
  },
  7: {
    raiseTo: 2.5,
    raise: '66+, 55:0.5, A9s+, A5s:0.5, A4s:0.5, KTs+, QTs+, JTs, T9s, 98s:0.5, AJo+, KQo',
  },
  8: {
    raiseTo: 2.5,
    raise: '77+, 66:0.5, ATs+, A5s:0.5, KTs+, QTs+, JTs, T9s:0.5, AQo+, AJo:0.5, KQo:0.5',
  },
}

/* ヘッズアップでは SB がボタンを兼ねて先に動き、ポストフロップではポジションを持つため、レンジがかなり広い */
const HEADS_UP_RFI: SpotSpec = {
  raiseTo: 2.5,
  raise:
    '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q3o+, J5o+, T6o+, 96o+, 86o+, 76o, 65o, 54o:0.5',
}

const HEADS_UP_BB_VS_SB: SpotSpec = {
  raiseTo: 9,
  raise: '88+, ATs+, A5s-A2s, KTs+, QTs+, JTs, AJo+, KQo, 76s:0.5, 65s:0.5',
  call: '77-22, A9s-A6s, K9s-K2s, Q9s-Q2s, J9s-J4s, T9s-T5s, 95s+, 84s+, 74s+, 63s+, 53s+, 43s, 76s:0.5, 65s:0.5, ATo-A2o, KJo-K2o, QJo-Q5o, JTo-J7o, T9o-T7o, 97o+, 86o+, 76o, 65o',
}

/** 後ろに残っている人数から、6人卓で同じ立場にある席を選ぶ */
function sixMaxOpenerFor(positions: readonly Position[], position: Position): Position {
  if (position === 'SB' || position === 'BB') return position
  const behind = positions.length - 1 - positions.indexOf(position)
  return (['BTN', 'CO', 'HJ', 'UTG'] as const)[Math.min(behind, 5) - 2]
}

/** オープンに応じる人は、6人卓の UTG のオープンに最初に応じる HJ より前にはならない */
function sixMaxResponderFor(positions: readonly Position[], position: Position): Position {
  if (position === 'SB' || position === 'BB') return position
  const behind = positions.length - 1 - positions.indexOf(position)
  return (['BTN', 'CO', 'HJ'] as const)[Math.min(behind, 4) - 2]
}

function headsUp(): PreflopSolution {
  return {
    name: 'Cash Heads-up 100bb',
    positions: SEATS[2],
    rfi: { SB: HEADS_UP_RFI },
    vsOpen: { SB: { BB: HEADS_UP_BB_VS_SB } },
    // SB はポストフロップでポジションを持つので、6人卓で BTN が BB に3ベットされたときの対応を使う
    vs3bet: { SB: { BB: sixMax.vs3bet.BTN?.BB as SpotSpec } },
  }
}

/**
 * 人数ごとのプリフロップのデータ。6人卓のデータを、後ろに残っている人数が同じ席に当てはめて作る。
 * 人数ごとに別々のレンジを持たないのは、近似のデータを人数の数だけ手で持つと食い違いやすいため
 */
function buildSolution(players: number): PreflopSolution {
  if (players === 2) return headsUp()
  const positions = SEATS[players]
  const solution: PreflopSolution = {
    name: `Cash ${players}-max 100bb`,
    positions,
    rfi: {},
    vsOpen: {},
    vs3bet: {},
    vsOpenCall: {},
    callerVsSqueeze: sixMax.callerVsSqueeze,
  }

  positions.forEach((position, index) => {
    if (position === 'BB') return
    const behind = positions.length - 1 - index
    solution.rfi[position] = EARLY_RFI[behind] ?? sixMax.rfi[sixMaxOpenerFor(positions, position)]
    solution.vsOpenCall![position] = sixMax.vsOpenCall?.[sixMaxResponderFor(positions, position) === 'HJ' ? 'CO' : sixMaxResponderFor(positions, position)]

    const opener = sixMaxOpenerFor(positions, position)
    for (const responder of positions.slice(index + 1)) {
      const sixMaxResponder = sixMaxResponderFor(positions, responder)
      const vsOpen = sixMax.vsOpen[opener]?.[sixMaxResponder]
      const vs3bet = sixMax.vs3bet[opener]?.[sixMaxResponder]
      if (vsOpen) (solution.vsOpen[position] ??= {})[responder] = vsOpen
      if (vs3bet) (solution.vs3bet[position] ??= {})[responder] = vs3bet
    }
  })
  return solution
}

const cache = new Map<number, PreflopSolution>()

export function cashSolution(players: number): PreflopSolution {
  if (players < MIN_PLAYERS || players > MAX_PLAYERS) throw new Error(`${players}人の卓には対応していません`)
  let solution = cache.get(players)
  if (!solution) {
    solution = players === 6 ? sixMax : buildSolution(players)
    cache.set(players, solution)
  }
  return solution
}
