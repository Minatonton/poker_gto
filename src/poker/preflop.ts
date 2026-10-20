import { ALL_HANDS, type HandClass } from './hands'
import { buildStrategy, type Action, type Strategy } from './strategy'

/** 9人卓までのすべての席の名前。早く行動する順 */
export const ALL_POSITIONS = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const

export type Position = (typeof ALL_POSITIONS)[number]

/** 6人卓の席。ここで持っているレンジの基準になる */
export const POSITIONS: readonly Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']

export interface SpotSpec {
  raiseTo: number
  raise: string
  call?: string
}

type ByPosition<T> = Partial<Record<Position, T>>

export interface PreflopSolution {
  name: string
  /** この卓の席。プリフロップで行動する順 */
  positions: readonly Position[]
  rfi: ByPosition<SpotSpec>
  /** [オープンした人][応答する人] */
  vsOpen: ByPosition<ByPosition<SpotSpec>>
  /** [オープンした人][3ベットした人]。スクイーズされたオープナーの対応にも使う */
  vs3bet: ByPosition<ByPosition<SpotSpec>>
  /** [応答する人]。オープンに誰かがコールした後の、オーバーコール（call）とスクイーズ（raise） */
  vsOpenCall?: ByPosition<SpotSpec>
  /** オープンにコールした後でスクイーズされた人の対応 */
  callerVsSqueeze?: SpotSpec
}

export interface Step {
  position: Position
  action: Action
  /** そのときの戦略。データがないため自動でフォールド扱いにしたときは null */
  strategy: Strategy | null
}

export type Walk =
  | { steps: Step[]; positions: readonly Position[]; status: 'deciding'; position: Position; strategy: Strategy }
  | {
      steps: Step[]
      positions: readonly Position[]
      status: 'finished'
      result: string
      /** フロップに進んだプレイヤー。ポットを誰かが獲得して終わったときは空 */
      flopPlayers: Position[]
    }

const FOLD: Action = { kind: 'fold', label: 'Fold' }

/** そのプレイヤーの各判断で、実際に選ばれたアクションの頻度を掛け合わせたもの。いまそのハンドを持っている割合になる */
export function rangeOfPosition(steps: readonly Step[], position: Position): Map<HandClass, number> {
  const range = new Map<HandClass, number>(ALL_HANDS.map((hand) => [hand, 1]))
  for (const step of steps) {
    if (step.position !== position || step.strategy === null) continue
    const actionIndex = step.strategy.actions.indexOf(step.action)
    for (const hand of ALL_HANDS) {
      const frequency = step.strategy.frequencies.get(hand)?.[actionIndex] ?? 0
      range.set(hand, (range.get(hand) ?? 0) * frequency)
    }
  }
  return range
}

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
 * オープン → 応答（コール・3ベット）→ オーバーコール・スクイーズ → 3ベットやスクイーズへの対応、までを辿れる。
 * 4ベット以降やコールド4ベットは、データ量の割に学習で使う場面が少ないため持っていない。
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

  // 2回目以降の判断では、そこまでに降りたハンドを除いた割合で戦略を見せる
  const positions = solution.positions
  const deciding = (position: Position, strategy: Strategy): Walk => ({
    steps,
    positions,
    status: 'deciding',
    position,
    strategy: { ...strategy, weights: rangeOfPosition(steps, position) },
  })
  const finished = (result: string, flopPlayers: Position[] = []): Walk => ({
    steps,
    positions,
    status: 'finished',
    result,
    flopPlayers,
  })
  const toFlop = (players: Position[], potName: string) =>
    finished(
      players.length === 2
        ? `${players[0]} vs ${players[1]}${potName || ' '}でフロップへ`
        : `${players.join(' / ')} の${players.length}人でフロップへ（ポストフロップのソルブは2人まで）`,
      players,
    )

  for (let openerIndex = 0; openerIndex < positions.length - 1; openerIndex++) {
    const opener = positions[openerIndex]
    const rfi = solution.rfi[opener]
    if (!rfi) {
      autoFold([opener])
      continue
    }
    const rfiStrategy = toStrategy(rfi, 'Raise')
    const openAction = decide(opener, rfiStrategy)
    if (!openAction) return deciding(opener, rfiStrategy)
    if (openAction.kind === 'fold') continue

    const behind = positions.slice(openerIndex + 1)
    const callers: Position[] = []
    let threeBettor: Position | null = null
    for (let i = 0; i < behind.length && !threeBettor; i++) {
      const responder = behind[i]
      const spec = callers.length === 0 ? solution.vsOpen[opener]?.[responder] : solution.vsOpenCall?.[responder]
      if (!spec) {
        autoFold([responder])
        continue
      }
      const strategy = toStrategy(spec, callers.length === 0 ? '3Bet' : 'Squeeze')
      const response = decide(responder, strategy)
      if (!response) return deciding(responder, strategy)
      if (response.kind === 'call') callers.push(responder)
      if (response.kind === 'raise') {
        threeBettor = responder
        autoFold(behind.slice(i + 1))
      }
    }

    if (!threeBettor) {
      if (callers.length === 0) return finished(`${opener} がポットを獲得`)
      return toFlop([opener, ...callers], '')
    }

    const stillIn: Position[] = []
    const vs3bet = solution.vs3bet[opener]?.[threeBettor]
    if (!vs3bet) return finished(`${opener} の3ベットへの対応データは未収録です`)
    const vs3betStrategy = toStrategy(vs3bet, '4Bet')
    const reply = decide(opener, vs3betStrategy)
    if (!reply) return deciding(opener, vs3betStrategy)
    if (reply.kind === 'raise') return finished('4ベット以降のデータは未収録です')
    if (reply.kind === 'call') stillIn.push(opener)

    for (const caller of callers) {
      if (!solution.callerVsSqueeze) {
        autoFold([caller])
        continue
      }
      const strategy = toStrategy(solution.callerVsSqueeze, '4Bet')
      const callerReply = decide(caller, strategy)
      if (!callerReply) return deciding(caller, strategy)
      if (callerReply.kind === 'raise') return finished('4ベット以降のデータは未収録です')
      if (callerReply.kind === 'call') stillIn.push(caller)
    }

    if (stillIn.length === 0) return finished(`${threeBettor} がポットを獲得`)
    return toFlop([...stillIn, threeBettor], '（3ベットポット）')
  }
  return finished(`全員フォールド。${positions[positions.length - 1]} がポットを獲得`)
}
