import { useEffect, useRef, useState } from 'react'
import { SolverClient, type SolvedStatus } from './client'
import type { NodeInfo, SolveOptions, SolverStatus, SpotConfig } from './types'

export type SolvePhase =
  | { name: 'idle' }
  | {
      name: 'solving'
      startingPot: number
      options: SolveOptions
      status?: Extract<SolverStatus, { state: 'solving' }>
    }
  | { name: 'solved'; startingPot: number; result: SolvedStatus }

export type PathEntry =
  | { kind: 'action'; choice: number; actor: string; label: string; color: string }
  | { kind: 'card'; choice: number; card: string }

/**
 * ポストフロップのソルブと、解いた木の中の移動。
 * 解いた木はサーバーが1つだけ持つので、このフックを使う画面は同時に1つにする
 */
export function usePostflopSolve(onSolved?: () => void) {
  const clientRef = useRef<SolverClient | null>(null)
  const [phase, setPhase] = useState<SolvePhase>({ name: 'idle' })
  const [error, setError] = useState('')
  const [path, setPath] = useState<PathEntry[]>([])
  const [node, setNode] = useState<NodeInfo | null>(null)
  // ストリートの最初のノードのベット額を覚えておき、いまのストリートで前に出したチップを求める
  const [visited, setVisited] = useState(() => new Map<string, NodeInfo>())

  useEffect(() => () => clientRef.current?.dispose(), [])

  useEffect(() => {
    if (phase.name !== 'solved' || !clientRef.current) return
    let cancelled = false
    const history = path.map((p) => p.choice)
    clientRef.current
      .node(history)
      .then((next) => {
        if (cancelled) return
        setVisited((current) => new Map(current).set(history.join(), next))
        setNode(next)
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      cancelled = true
    }
  }, [phase.name, path])

  const solve = async (config: SpotConfig, options: SolveOptions) => {
    clientRef.current ??= new SolverClient()
    setError('')
    setPath([])
    setNode(null)
    setVisited(new Map())
    const startingPot = config.startingPot
    setPhase({ name: 'solving', startingPot, options })
    try {
      const result = await clientRef.current.solve(config, options, (status) => {
        if (status.state === 'solving') setPhase((p) => (p.name === 'solving' ? { ...p, status } : p))
      })
      setPhase({ name: 'solved', startingPot, result })
      onSolved?.()
    } catch (e) {
      setError((e as Error).message)
      setPhase({ name: 'idle' })
    }
  }

  const stop = () => clientRef.current?.stop()

  const reset = () => {
    setPhase({ name: 'idle' })
    setPath([])
    setNode(null)
    setVisited(new Map())
  }

  /** いまのストリートが始まったときのノード（最後に配られたカードの直後） */
  const lastCard = path.findLastIndex((entry) => entry.kind === 'card')
  const streetStart = visited.get(
    path
      .slice(0, lastCard + 1)
      .map((entry) => entry.choice)
      .join(),
  )

  return { phase, error, path, setPath, node, streetStart, solve, stop, reset }
}
