// solver/src/spot.rs・node.rs・session.rs・report.rs の JSON と揃えている

/** postflop-solver はチップを整数で扱うため、0.01bb 単位にしている */
export const CHIPS_PER_BB = 100

export interface SizeOptions {
  bet: string
  raise: string
}

export interface StreetSizes {
  oop: SizeOptions
  ip: SizeOptions
}

export interface SpotConfig {
  oopRange: string
  ipRange: string
  board: string
  startingPot: number
  effectiveStack: number
  rakeRate: number
  rakeCap: number
  flop: StreetSizes
  turn: StreetSizes
  river: StreetSizes
  addAllinThreshold: number
  forceAllinThreshold: number
}

export interface SolverAction {
  kind: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
  amount: number
}

export interface SolverHand {
  cards: string
  /** プリフロップのレンジの重みに、このノードまでの到達確率を掛けたもの（0〜1） */
  weight: number
  /** weight にカードの重なりを考慮した相手のコンボ数を掛けたもの。平均を取るときの重みに使う */
  normalizedWeight: number
  strategy: number[]
  /** strategy と同じ並びの、そのアクションを選んだときの EV（チップ） */
  actionEvs: (number | null)[]
  /** このノードからポットのうち取り戻せるチップの期待値 */
  ev: number | null
  equity: number | null
}

export interface OpponentHand {
  cards: string
  weight: number
  normalizedWeight: number
  ev: number | null
  equity: number | null
}

export interface RangeSummary {
  combos: number
  equity: number
  /** チップ */
  ev: number
  /** EV ÷ (EQ × ポット) */
  eqr: number
}

interface NodeBase {
  board: string[]
  pot: number
  bets: [number, number]
}

export type PlayerNode = NodeBase & {
  kind: 'player'
  player: 0 | 1
  actions: SolverAction[]
  hands: SolverHand[]
  opponentHands: OpponentHand[]
  /** [OOP, IP] */
  ranges: [RangeSummary, RangeSummary]
}
export type ChanceNode = NodeBase & { kind: 'chance'; possibleCards: number[] }
export type TerminalNode = NodeBase & { kind: 'terminal' }
export type NodeInfo = PlayerNode | ChanceNode | TerminalNode

export interface SolveOptions {
  maxIterations: number
  /** 目標の exploitability（チップ） */
  targetExploitability: number
}

export type SolverStatus =
  | { state: 'idle' }
  | { state: 'solving'; memoryBytes: number; compressed: boolean; iteration: number; exploitability: number | null }
  | { state: 'solved'; iteration: number; exploitability: number }

export interface StrategySummary {
  actions: SolverAction[]
  frequencies: number[]
}

export interface ReportRow {
  board: string
  iteration: number
  exploitability: number
  /** [OOP, IP] */
  ranges: [RangeSummary, RangeSummary]
  oop: StrategySummary
  ipAfterCheck: StrategySummary | null
}

export interface ReportStatus {
  state: 'idle' | 'running' | 'done'
  total: number
  current: string | null
  rows: ReportRow[]
  failures: { board: string; message: string }[]
}
