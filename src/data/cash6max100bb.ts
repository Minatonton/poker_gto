import type { Position, PreflopSolution, SpotSpec } from '../poker/preflop'

/*
 * 一般に知られている 6-max 100bb キャッシュ（レーキあり）の標準的なレンジをもとにした近似値。
 * ソルバーの出力ではない。ステップ2以降で自前のソルブ結果に置き換える前提の仮データ。
 */

const OPEN = 2.5
const SB_OPEN = 3
const IP_3BET = 7.5
const OOP_3BET = 11
const BB_VS_SB_3BET = 9

const rfi: PreflopSolution['rfi'] = {
  UTG: {
    raiseTo: OPEN,
    raise:
      '66+, 55:0.75, 44:0.5, 33:0.25, 22:0.25, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s:0.5, 76s:0.5, 65s:0.25, AJo+, ATo:0.5, KQo, KJo:0.5',
  },
  HJ: {
    raiseTo: OPEN,
    raise:
      '22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, 65s:0.5, ATo+, KJo+, QJo, KTo:0.5, A9o:0.25',
  },
  CO: {
    raiseTo: OPEN,
    raise:
      '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s:0.5, 54s, A8o+, A5o:0.5, KTo+, QTo+, JTo, K9o:0.5',
  },
  BTN: {
    raiseTo: OPEN,
    raise:
      '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s:0.5, A2o+, K8o+, Q9o+, J9o+, T9o, K7o:0.5, Q8o:0.5, J8o:0.5, T8o:0.5, 98o:0.5',
  },
  SB: {
    raiseTo: SB_OPEN,
    raise:
      '22+, A2s+, K3s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A4o+, K9o+, Q9o+, J9o+, T9o, A2o:0.5, A3o:0.5, K8o:0.5, 98o:0.5',
  },
}

const vsOpen: PreflopSolution['vsOpen'] = {
  UTG: {
    HJ: {
      raiseTo: IP_3BET,
      raise: 'QQ+, JJ:0.5, AKs, AKo, AQs:0.5, KQs:0.25, A5s:0.5, A4s:0.5, 76s:0.25',
      call: 'JJ:0.5, TT-66, AQs:0.5, AJs, ATs, KJs, KQs:0.75, QJs, JTs, T9s, 98s:0.5, AQo:0.5',
    },
    CO: {
      raiseTo: IP_3BET,
      raise: 'QQ+, JJ:0.5, AKs, AKo, AQs:0.5, KQs:0.25, A5s:0.5, A4s:0.5, 76s:0.25, 65s:0.25',
      call: 'JJ:0.5, TT-55, AQs:0.5, AJs, ATs, A9s:0.5, KJs, KTs:0.5, KQs:0.75, QJs, JTs, T9s, 98s:0.5, AQo:0.5',
    },
    BTN: {
      raiseTo: IP_3BET,
      raise: 'QQ+, JJ:0.5, AKs, AKo, AQs:0.25, A5s:0.5, A4s:0.25, KQs:0.25, 65s:0.25',
      call: 'JJ:0.5, TT-22, AQs:0.75, AJs-A8s, KJs, KTs, KQs:0.75, QJs, QTs, JTs, J9s:0.5, T9s, 98s, 87s, 76s:0.5, AQo, AJo:0.5, KQo:0.5',
    },
    SB: {
      raiseTo: OOP_3BET,
      raise: 'TT+, 99:0.5, AKs, AQs, AJs:0.5, KQs, A5s, A4s:0.5, AKo, AQo:0.5',
    },
    BB: {
      raiseTo: OOP_3BET,
      raise: 'QQ+, JJ:0.5, AKs, AKo, AQs:0.5, A5s:0.5, A4s:0.5, KQs:0.25',
      call: 'JJ:0.5, TT-22, AQs:0.5, AJs-A6s, A5s:0.5, A4s:0.5, A3s, A2s, KJs-K6s, KQs:0.75, QTs+, Q9s, J9s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, AQo, AJo, ATo, KQo, KJo, QJo:0.5',
    },
  },
  HJ: {
    CO: {
      raiseTo: IP_3BET,
      raise: 'QQ+, JJ:0.5, TT:0.25, AKs, AKo, AQs:0.5, AQo:0.25, KQs:0.5, A5s, A4s:0.5, KJs:0.25, 76s:0.25, 65s:0.25',
      call: 'JJ:0.5, TT:0.75, 99-55, AQs:0.5, AJs, ATs, A9s:0.5, KJs:0.75, KTs, KQs:0.5, QJs, QTs:0.5, JTs, T9s, 98s, AQo:0.5',
    },
    BTN: {
      raiseTo: IP_3BET,
      raise: 'QQ+, JJ:0.5, TT:0.25, AKs, AKo, AQs:0.5, AQo:0.25, A5s, A4s:0.5, KQs:0.5, KJs:0.25, 65s:0.5, 54s:0.25',
      call: 'JJ:0.5, TT:0.75, 99-22, AQs:0.5, AJs-A6s, KJs:0.75, KTs, K9s, KQs:0.5, QJs, QTs, Q9s:0.5, JTs, J9s, T9s, T8s:0.5, 98s, 87s, 76s, AQo:0.75, AJo, KQo',
    },
    SB: {
      raiseTo: OOP_3BET,
      raise: '99+, 88:0.5, AJs+, ATs:0.5, KQs, KJs:0.5, QJs:0.25, A5s, A4s, AKo, AQo, AJo:0.25, 76s:0.25',
    },
    BB: {
      raiseTo: OOP_3BET,
      raise: 'QQ+, JJ:0.5, TT:0.25, AKs, AKo, AQs:0.5, AQo:0.25, A5s, A4s:0.5, KQs:0.5, 65s:0.25',
      call: 'JJ:0.5, TT:0.75, 99-22, AQs:0.5, AJs-A6s, A4s:0.5, A3s, A2s, KQs:0.5, KJs-K5s, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 65s:0.75, 53s+, AQo:0.75, AJo-A9o, KJo+, QJo, KTo:0.5, JTo:0.5',
    },
  },
  CO: {
    BTN: {
      raiseTo: IP_3BET,
      raise: 'TT+, 99:0.5, AKs, AQs, AJs:0.5, AKo, AQo:0.5, A5s, A4s, A3s:0.5, KQs, KJs:0.5, QJs:0.25, K9s:0.25, 65s:0.5, 54s:0.5, A9o:0.25, KJo:0.25',
      call: '99:0.5, 88-22, AJs:0.5, ATs-A6s, A2s:0.5, KJs:0.5, KTs, K9s:0.75, QJs:0.75, QTs, Q9s, JTs, J9s, T9s, T8s, 98s, 97s:0.5, 87s, 76s, AQo:0.5, AJo, ATo, KQo, KJo:0.5, QJo:0.5',
    },
    SB: {
      raiseTo: OOP_3BET,
      raise: '88+, 77:0.5, ATs+, A9s:0.5, KJs+, KTs:0.5, QJs, JTs:0.5, A5s-A3s, AJo+, KQo, 76s:0.5, 65s:0.5',
    },
    BB: {
      raiseTo: OOP_3BET,
      raise: 'TT+, 99:0.25, AKs, AQs, AJs:0.5, AKo, AQo:0.5, A5s, A4s, A3s:0.5, KQs:0.75, KJs:0.25, 76s:0.25, 65s:0.25, 54s:0.25',
      call: '99:0.75, 88-22, AJs:0.5, ATs-A6s, A3s:0.5, A2s, KQs:0.25, KJs:0.75, KTs-K3s, Q6s+, J7s+, T7s+, 96s+, 85s+, 75s+, 76s:0.75, 64s+, 65s:0.75, 53s+, 54s:0.75, 43s:0.5, AQo:0.5, AJo-A7o, A5o:0.5, KTo+, QTo+, JTo, K9o:0.5, T9o:0.5',
    },
  },
  BTN: {
    SB: {
      raiseTo: OOP_3BET,
      raise: '66+, 55:0.5, A8s+, A7s:0.5, A5s-A2s, K9s+, Q9s+, J9s+, T9s, 98s, 87s:0.5, 76s, 65s, 54s:0.5, ATo+, A9o:0.5, KJo+, KTo:0.5, QJo',
    },
    BB: {
      raiseTo: OOP_3BET,
      raise: '99+, 88:0.5, ATs+, A9s:0.25, KJs+, KTs:0.5, QJs:0.5, A5s, A4s, A3s:0.5, AJo+, KQo:0.5, ATo:0.25, 76s:0.25, 65s:0.25, 54s:0.25, J9s:0.25, T9s:0.25',
      call: '88:0.5, 77-22, A9s:0.75, A8s-A6s, A3s:0.5, A2s, KTs:0.5, K9s-K2s, QJs:0.5, QTs-Q2s, JTs, J9s:0.75, J8s-J4s, T9s:0.75, T8s-T6s, 96s+, 85s+, 74s+, 76s:0.75, 63s+, 65s:0.75, 52s+, 54s:0.75, 42s+, ATo:0.75, A9o-A2o, KQo:0.5, KJo-K7o, QTo+, Q9o, Q8o:0.5, JTo, J9o, J8o:0.5, T9o, T8o, 98o, 87o:0.5',
    },
  },
  SB: {
    BB: {
      raiseTo: BB_VS_SB_3BET,
      raise: '77+, ATs+, A9s:0.5, A5s-A3s, KJs+, KTs:0.5, QJs, JTs:0.5, T9s:0.25, 65s:0.5, 54s:0.5, AJo+, KQo',
      call: '66-22, A9s:0.5, A8s-A6s, A2s, KTs:0.5, K9s-K2s, QTs-Q3s, JTs:0.5, J9s-J5s, T9s:0.75, T8s-T6s, 96s+, 85s+, 75s+, 64s+, 65s:0.5, 53s+, 54s:0.5, 43s, ATo-A2o, KJo-K6o, QJo-Q8o, JTo-J8o, T9o, T8o, 98o, 97o:0.5, 87o',
    },
  },
}

interface Vs3betTemplate {
  /** ブラインドから3ベットされ、オープナーがポジションを持つとき */
  inPosition?: SpotSpec
  /** 後ろのポジションから3ベットされ、オープナーがポジションを持たないとき */
  outOfPosition?: SpotSpec
}

const vs3betTemplates: Record<Exclude<Position, 'BB'>, Vs3betTemplate> = {
  UTG: {
    outOfPosition: {
      raiseTo: 22,
      raise: 'KK+, QQ:0.5, AKs, AKo:0.5, A5s:0.5',
      call: 'QQ:0.5, JJ-99, 88:0.5, AQs, AJs, ATs:0.5, KQs, KJs:0.5, QJs:0.5, JTs:0.5, AKo:0.5',
    },
    inPosition: {
      raiseTo: 24,
      raise: 'KK+, QQ:0.5, AKs, AKo:0.5, A5s:0.5',
      call: 'QQ:0.5, JJ-77, AQs-ATs, KQs, KJs, QJs, JTs, T9s:0.5, AKo:0.5, AQo:0.5',
    },
  },
  HJ: {
    outOfPosition: {
      raiseTo: 22,
      raise: 'QQ+, JJ:0.25, AKs, AKo:0.75, A5s:0.5, A4s:0.25',
      call: 'JJ:0.75, TT-88, 77:0.5, AQs-ATs, KQs, KJs, QJs, JTs, T9s:0.5, AKo:0.25, AQo:0.5',
    },
    inPosition: {
      raiseTo: 24,
      raise: 'QQ+, JJ:0.25, AKs, AKo:0.75, A5s:0.5, A4s:0.25',
      call: 'JJ:0.75, TT-66, AQs-A9s, KQs, KJs, KTs:0.5, QJs, QTs:0.5, JTs, T9s, 98s:0.5, AKo:0.25, AQo',
    },
  },
  CO: {
    outOfPosition: {
      raiseTo: 22,
      raise: 'QQ+, JJ:0.5, AKs, AKo, A5s, A4s:0.5, KQs:0.25',
      call: 'JJ:0.5, TT-77, 66:0.5, AQs-A9s, KQs:0.75, KJs, KTs:0.5, QJs, QTs:0.5, JTs, T9s, 98s:0.5, AQo, AJo:0.5',
    },
    inPosition: {
      raiseTo: 24,
      raise: 'QQ+, JJ:0.5, AKs, AKo, A5s, A4s:0.5, KQs:0.25',
      call: 'JJ:0.5, TT-55, AQs-A8s, KQs:0.75, KJs, KTs, QJs, QTs, JTs, J9s:0.5, T9s, 98s, 87s:0.5, AQo, AJo, KQo:0.5',
    },
  },
  BTN: {
    inPosition: {
      raiseTo: 24,
      raise: 'QQ+, JJ:0.5, AKs, AQs:0.5, AKo, A5s, A4s:0.5, A3s:0.25, KQs:0.25',
      call: 'JJ:0.5, TT-44, 33:0.5, AQs:0.5, AJs-A6s, A4s:0.5, KQs:0.75, KJs-K9s, QJs, QTs, Q9s:0.5, JTs, J9s, T9s, T8s:0.5, 98s, 87s, 76s, 65s:0.5, AQo, AJo:0.75, ATo:0.5, KQo, KJo:0.5',
    },
  },
  SB: {
    outOfPosition: {
      raiseTo: 25,
      raise: 'QQ+, JJ:0.5, AKs, AQs:0.5, AKo, A5s, A4s:0.5, AJo:0.25',
      call: 'JJ:0.5, TT-55, 44:0.5, AQs:0.5, AJs-A6s, A4s:0.5, A3s, A2s:0.5, KQs, KJs, KTs, K9s:0.5, QJs, QTs, JTs, J9s:0.5, T9s, 98s, 87s, 76s, 65s:0.5, AQo, AJo:0.75, ATo:0.5, KQo, KJo:0.5',
    },
  },
}

const BLINDS: readonly Position[] = ['SB', 'BB']

function buildVs3bet(): PreflopSolution['vs3bet'] {
  const result: PreflopSolution['vs3bet'] = {}
  for (const [opener, responders] of Object.entries(vsOpen) as [Position, Partial<Record<Position, SpotSpec>>][]) {
    if (opener === 'BB') continue
    const template = vs3betTemplates[opener]
    for (const threeBettor of Object.keys(responders) as Position[]) {
      const openerHasPosition = opener !== 'SB' && BLINDS.includes(threeBettor)
      const spec = openerHasPosition ? template.inPosition : template.outOfPosition
      if (spec) (result[opener] ??= {})[threeBettor] = spec
    }
  }
  return result
}

export const cash6max100bb: PreflopSolution = {
  name: 'Cash 6-max 100bb',
  rfi,
  vsOpen,
  vs3bet: buildVs3bet(),
}
