use crate::node::{ActionInfo, NodeKind, RangeSummary, node_info};
use crate::session::{SolveOptions, prepare_game, run_cfr};
use crate::spot::SpotConfig;
use postflop_solver::finalize;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

/// あるノードで、手番のレンジ全体が各アクションを選ぶ割合
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategySummary {
    pub actions: Vec<ActionInfo>,
    pub frequencies: Vec<f32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRow {
    pub board: String,
    pub iteration: u32,
    pub exploitability: f32,
    /// [OOP, IP]
    pub ranges: [RangeSummary; 2],
    /// フロップで OOP が最初に選ぶアクション
    pub oop: StrategySummary,
    /// OOP がチェックした後に IP が選ぶアクション
    pub ip_after_check: Option<StrategySummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportFailure {
    pub board: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportStatus {
    /// "idle" | "running" | "done"
    pub state: &'static str,
    pub total: usize,
    pub current: Option<String>,
    pub rows: Vec<ReportRow>,
    pub failures: Vec<ReportFailure>,
}

/// 同じスポットを複数のフロップで順に解き、フロップごとの戦略と EQ をまとめる（集合分析）。
/// フロップを並列に解かないのは、1枚ごとに数 GiB のメモリを使い、まとめて確保すると上限を超えるため
pub struct Report {
    status: Arc<Mutex<ReportStatus>>,
    stop_requested: Arc<AtomicBool>,
    max_memory_bytes: u64,
}

impl Report {
    pub fn new(max_memory_bytes: u64) -> Self {
        Report {
            status: Arc::new(Mutex::new(ReportStatus {
                state: "idle",
                total: 0,
                current: None,
                rows: vec![],
                failures: vec![],
            })),
            stop_requested: Arc::new(AtomicBool::new(false)),
            max_memory_bytes,
        }
    }

    pub fn status(&self) -> ReportStatus {
        self.status.lock().unwrap().clone()
    }

    pub fn is_running(&self) -> bool {
        self.status().state == "running"
    }

    pub fn stop(&self) {
        self.stop_requested.store(true, Ordering::SeqCst);
    }

    pub fn start(&self, config: SpotConfig, boards: Vec<String>, options: SolveOptions) -> Result<(), String> {
        if self.is_running() {
            return Err("集合分析を実行中です".into());
        }
        if boards.is_empty() {
            return Err("フロップを1つ以上選んでください".into());
        }
        self.stop_requested.store(false, Ordering::SeqCst);
        *self.status.lock().unwrap() =
            ReportStatus { state: "running", total: boards.len(), current: None, rows: vec![], failures: vec![] };

        let status = Arc::clone(&self.status);
        let stop_requested = Arc::clone(&self.stop_requested);
        let max_memory_bytes = self.max_memory_bytes;
        thread::spawn(move || {
            for board in boards {
                if stop_requested.load(Ordering::SeqCst) {
                    break;
                }
                status.lock().unwrap().current = Some(board.clone());
                let result = solve_board(&config, &board, &options, &stop_requested, max_memory_bytes);
                let mut status = status.lock().unwrap();
                match result {
                    Ok(row) => status.rows.push(row),
                    Err(message) => status.failures.push(ReportFailure { board, message }),
                }
            }
            let mut status = status.lock().unwrap();
            status.state = "done";
            status.current = None;
        });
        Ok(())
    }
}

fn solve_board(
    config: &SpotConfig,
    board: &str,
    options: &SolveOptions,
    stop_requested: &AtomicBool,
    max_memory_bytes: u64,
) -> Result<ReportRow, String> {
    let config = SpotConfig { board: board.to_string(), ..config.clone() };
    let (mut game, _, _) = prepare_game(&config, max_memory_bytes)?;
    let (iteration, exploitability) = run_cfr(&game, options, stop_requested, |_, _| {});
    finalize(&mut game);

    let root = node_info(&mut game, &[])?;
    let NodeKind::Player { actions, hands, ranges, .. } = root.node else {
        return Err("ルートが判断ノードではありません".into());
    };
    let check_index = actions.iter().position(|a| a.kind == "check");
    let oop = summarize(actions, &hands);
    let ip_after_check = match check_index {
        Some(index) => match node_info(&mut game, &[index])?.node {
            NodeKind::Player { actions, hands, .. } => Some(summarize(actions, &hands)),
            _ => None,
        },
        None => None,
    };
    Ok(ReportRow { board: board.to_string(), iteration, exploitability, ranges, oop, ip_after_check })
}

fn summarize(actions: Vec<ActionInfo>, hands: &[crate::node::HandInfo]) -> StrategySummary {
    let mut frequencies = vec![0.0; actions.len()];
    let mut total = 0.0;
    for hand in hands.iter().filter(|h| h.normalized_weight > 0.0) {
        total += hand.normalized_weight;
        for (i, f) in hand.strategy.iter().enumerate() {
            frequencies[i] += f * hand.normalized_weight;
        }
    }
    if total > 0.0 {
        frequencies.iter_mut().for_each(|f| *f /= total);
    }
    StrategySummary { actions, frequencies }
}

#[cfg(test)]
#[allow(non_snake_case)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    fn config() -> SpotConfig {
        let sizes = serde_json::json!({ "oop": { "bet": "50%", "raise": "" }, "ip": { "bet": "50%", "raise": "" } });
        serde_json::from_value(serde_json::json!({
            "oopRange": "AA,KK,QQ,AK", "ipRange": "AA,KK,QQ,JJ", "board": "",
            "startingPot": 1000, "effectiveStack": 2000, "rakeRate": 0.0, "rakeCap": 0.0,
            "flop": sizes, "turn": sizes, "river": sizes,
            "addAllinThreshold": 0.0, "forceAllinThreshold": 0.0
        }))
        .unwrap()
    }

    fn wait(report: &Report) -> ReportStatus {
        let deadline = Instant::now() + Duration::from_secs(60);
        while report.is_running() && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(20));
        }
        report.status()
    }

    #[test]
    fn 各ボードを順に解き_OOPとチェック後のIPの戦略をまとめる() {
        let report = Report::new(1 << 30);
        let options = SolveOptions { max_iterations: 20, target_exploitability: 0.0 };
        report.start(config(), vec!["Td9d6hQc2s".into(), "Ah7c2d5s9h".into()], options).unwrap();
        let status = wait(&report);
        assert_eq!(status.rows.len(), 2);
        let row = &status.rows[0];
        assert!((row.oop.frequencies.iter().sum::<f32>() - 1.0).abs() < 1e-3);
        assert!(row.ip_after_check.is_some());
    }

    #[test]
    fn 解けなかったボードは失敗として残し_残りを続ける() {
        let report = Report::new(1 << 30);
        let options = SolveOptions { max_iterations: 5, target_exploitability: 0.0 };
        report.start(config(), vec!["XxYy".into(), "Td9d6hQc2s".into()], options).unwrap();
        let status = wait(&report);
        assert_eq!(status.failures.len(), 1);
        assert_eq!(status.rows.len(), 1);
    }
}
