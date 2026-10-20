import { buildStrategy, type Action, type Strategy } from './strategy'

export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const

export type Position = (typeof POSITIONS)[number]

export interface SpotSpec {
  raiseTo: number
  raise: string
  call?: string
}

type ByPosition<T> = Partial<Record<Position, T>>

export interface PreflopSolution {
  name: string
  rfi: ByPosition<SpotSpec>
  /** [オープンした人][応答する人] */
  vsOpen: ByPosition<ByPosition<SpotSpec>>
  /** [オープンした人][3ベットした人] */
  vs3bet: ByPosition<ByPosition<SpotSpec>>
}

export interface Step {
  position: Position
  action: Action
  /** そのときの戦略。データがないため自動でフォールド扱いにしたときは null */
  strategy: Strategy | null
}

export type Walk =
  | { steps: Step[]; status: 'deciding'; position: Position; strategy: Strategy }
  | { steps: Step[]; status: 'finished'; result: string }

const FOLD: Action = { kind: 'fold', label: 'Fold' }

function toStrategy(spec: SpotSpec, raiseName: string): Strategy {
  const raise: Action = { kind: 'raise', label: `${raiseName} ${spec.raiseTo}bb`, amount: spec.raiseTo }
  const call: Action = { kind: 'call', label: 'Call' }
  return buildStrategy([
    { action: raise, range: spec.raise },
    ...(spec.call ? [{ action: call, range: spec.call }] : []),
  ])
}

/**
 * choices（各意思決定で選んだアクションの種類）に沿ってプリフロップを進める。
 * データのないプレイヤーはフォールドしたものとして扱う。
 * コールドコールやスクイーズのようなマルチウェイの分岐まで持つとデータ量が爆発するため、
 * ヘッズアップに収束するラインだけを辿れるようにしている。
 */
export function walkPreflop(solution: PreflopSolution, choices: readonly Action['kind'][]): Walk {
  const steps: Step[] = []
  let choiceIndex = 0

  const autoFold = (positions: readonly Position[]) => {
    for (const position of positions) steps.push({ position, action: FOLD, strategy: null })
  }

  const decide = (position: Position, strategy: Strategy): Action | null => {
    if (choiceIndex >= choices.length) return null
    const kind = choices[choiceIndex++]
    const action = strategy.actions.find((a) => a.kind === kind)
    if (!action) throw new Error(`${position} は ${kind} を選べません`)
    steps.push({ position, action, strategy })
    return action
  }

  const deciding = (position: Position, strategy: Strategy): Walk => ({
    steps,
    status: 'deciding',
    position,
    strategy,
  })
  const finished = (result: string): Walk => ({ steps, status: 'finished', result })

  for (let openerIndex = 0; openerIndex < POSITIONS.length - 1; openerIndex++) {
    const opener = POSITIONS[openerIndex]
    const rfi = solution.rfi[opener]
    if (!rfi) {
      autoFold([opener])
      continue
    }
    const rfiStrategy = toStrategy(rfi, 'Raise')
    const openAction = decide(opener, rfiStrategy)
    if (!openAction) return deciding(opener, rfiStrategy)
    if (openAction.kind === 'fold') continue

    const behind = POSITIONS.slice(openerIndex + 1)
    for (let i = 0; i < behind.length; i++) {
      const responder = behind[i]
      const vsOpen = solution.vsOpen[opener]?.[responder]
      if (!vsOpen) {
        autoFold([responder])
        continue
      }
      const vsOpenStrategy = toStrategy(vsOpen, '3Bet')
      const response = decide(responder, vsOpenStrategy)
      if (!response) return deciding(responder, vsOpenStrategy)
      if (response.kind === 'fold') continue

      autoFold(behind.slice(i + 1))
      if (response.kind === 'call') return finished(`${opener} vs ${responder} でフロップへ`)

      const vs3bet = solution.vs3bet[opener]?.[responder]
      if (!vs3bet) return finished(`${opener} の3ベットへの対応データは未収録です`)
      const vs3betStrategy = toStrategy(vs3bet, '4Bet')
      const reply = decide(opener, vs3betStrategy)
      if (!reply) return deciding(opener, vs3betStrategy)
      if (reply.kind === 'fold') return finished(`${responder} がポットを獲得`)
      if (reply.kind === 'call') return finished(`${opener} vs ${responder}（3ベットポット）でフロップへ`)
      return finished('4ベット以降のデータは未収録です')
    }
    return finished(`${opener} がポットを獲得`)
  }
  return finished('全員フォールド。BB がポットを獲得')
}
