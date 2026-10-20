import type { NodeInfo, ReportStatus, SolveOptions, SolverStatus, SpotConfig } from './types'

/** solver/src/bin/server.rs が待ち受けるアドレス */
const SERVER_URL = 'http://127.0.0.1:8787'
const POLL_INTERVAL_MS = 500

export type SolvedStatus = Extract<SolverStatus, { state: 'solved' }>

/** ローカルのソルバーサーバーを Promise で扱えるようにする */
export class SolverClient {
  private disposed = false

  /** ソルブを始め、終わるまで状態を onStatus に通知し続ける */
  async solve(
    config: SpotConfig,
    options: SolveOptions,
    onStatus: (status: SolverStatus) => void,
  ): Promise<SolvedStatus> {
    await this.request('/solve', { config, options })
    while (!this.disposed) {
      const status = await this.request<SolverStatus>('/status')
      onStatus(status)
      if (status.state === 'solved') return status
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    throw new Error('中断されました')
  }

  /** 中断しても、それまでの反復で得た戦略は閲覧できる */
  async stop() {
    await this.request('/stop', {})
  }

  node(history: number[]): Promise<NodeInfo> {
    return this.request('/node', { history })
  }

  /** 同じスポットを複数のフロップで順に解く（集合分析）。進み具合は reportStatus で確かめる */
  async startReport(config: SpotConfig, boards: string[], options: SolveOptions) {
    await this.request('/report', { config, boards, options })
  }

  reportStatus(): Promise<ReportStatus> {
    return this.request('/report')
  }

  async stopReport() {
    await this.request('/report/stop', {})
  }

  dispose() {
    this.disposed = true
  }

  private async request<T>(path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(SERVER_URL + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new Error('ソルバーサーバーに接続できません。別のターミナルで `pnpm solver` を実行してください')
    }
    const json = await response.json()
    if (!response.ok) throw new Error(json.error ?? `ソルバーサーバーのエラー (${response.status})`)
    return json as T
  }
}
