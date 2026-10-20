use crate::node::{NodeInfo, node_info};
use crate::spot::{SpotConfig, build_game};
use postflop_solver::{PostFlopGame, compute_exploitability, finalize, solve_step};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

/// exploitability の計算は CFR 1回分ほどのコストがかかるため、毎回は計算しない
const ITERATIONS_PER_CHECK: u32 = 10;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SolveOptions {
    pub max_iterations: u32,
    /// 目標の exploitability（チップ）
    pub target_exploitability: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum Status {
    Idle,
    #[serde(rename_all = "camelCase")]
    Solving { memory_bytes: u64, compressed: bool, iteration: u32, exploitability: Option<f32> },
    #[serde(rename_all = "camelCase")]
    Solved { iteration: u32, exploitability: f32 },
}

/// ソルブ中はゲームをソルブ用スレッドが専有し、終わったら solved に移して閲覧できるようにする。
/// ソルブ中のゲームをロック越しに共有しないのは、CFR の反復のたびにロックを取ると
/// 状態の問い合わせがソルブ全体の終了まで待たされてしまうため。
pub struct Session {
    status: Arc<Mutex<Status>>,
    solved: Arc<Mutex<Option<PostFlopGame>>>,
    stop_requested: Arc<AtomicBool>,
    max_memory_bytes: u64,
}

impl Session {
    pub fn new(max_memory_bytes: u64) -> Self {
        Session {
            status: Arc::new(Mutex::new(Status::Idle)),
            solved: Arc::new(Mutex::new(None)),
            stop_requested: Arc::new(AtomicBool::new(false)),
            max_memory_bytes,
        }
    }

    pub fn status(&self) -> Status {
        self.status.lock().unwrap().clone()
    }

    pub fn stop(&self) {
        self.stop_requested.store(true, Ordering::SeqCst);
    }

    pub fn node(&self, history: &[usize]) -> Result<NodeInfo, String> {
        let mut solved = self.solved.lock().unwrap();
        let game = solved.as_mut().ok_or("まだソルブしていません")?;
        node_info(game, history)
    }

    /// ツリーを構築してメモリを確認したら、ソルブ自体はバックグラウンドのスレッドで進める
    pub fn start(&self, config: &SpotConfig, options: SolveOptions) -> Result<(), String> {
        if matches!(self.status(), Status::Solving { .. }) {
            return Err("ソルブ中です".into());
        }
        *self.solved.lock().unwrap() = None;

        let mut game = build_game(config)?;
        let (raw, compressed_size) = game.memory_usage();
        let compressed = raw > self.max_memory_bytes;
        let memory_bytes = if compressed { compressed_size } else { raw };
        if memory_bytes > self.max_memory_bytes {
            return Err(format!(
                "必要メモリが {:.2}GiB で上限 {:.2}GiB を超えています。ベットサイズを減らしてください",
                gib(memory_bytes),
                gib(self.max_memory_bytes)
            ));
        }
        game.allocate_memory(compressed);

        self.stop_requested.store(false, Ordering::SeqCst);
        *self.status.lock().unwrap() =
            Status::Solving { memory_bytes, compressed, iteration: 0, exploitability: None };

        let status = Arc::clone(&self.status);
        let solved = Arc::clone(&self.solved);
        let stop_requested = Arc::clone(&self.stop_requested);
        thread::spawn(move || {
            let mut iteration = 0;
            let mut exploitability = f32::INFINITY;
            while iteration < options.max_iterations && !stop_requested.load(Ordering::SeqCst) {
                let steps = ITERATIONS_PER_CHECK.min(options.max_iterations - iteration);
                for _ in 0..steps {
                    if stop_requested.load(Ordering::SeqCst) {
                        break;
                    }
                    solve_step(&game, iteration);
                    iteration += 1;
                }
                exploitability = compute_exploitability(&game);
                *status.lock().unwrap() = Status::Solving {
                    memory_bytes,
                    compressed,
                    iteration,
                    exploitability: Some(exploitability),
                };
                if exploitability <= options.target_exploitability {
                    break;
                }
            }
            finalize(&mut game);
            *solved.lock().unwrap() = Some(game);
            *status.lock().unwrap() = Status::Solved { iteration, exploitability };
        });
        Ok(())
    }
}

fn gib(bytes: u64) -> f64 {
    bytes as f64 / (1u64 << 30) as f64
}

#[cfg(test)]
#[allow(non_snake_case)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    fn river_config() -> SpotConfig {
        serde_json::from_value(serde_json::json!({
            "oopRange": "AA,KK,QQ,AK", "ipRange": "AA,KK,QQ,JJ", "board": "Td9d6hQc2s",
            "startingPot": 1000, "effectiveStack": 2000, "rakeRate": 0.0, "rakeCap": 0.0,
            "flop": sizes(), "turn": sizes(), "river": sizes(),
            "addAllinThreshold": 0.0, "forceAllinThreshold": 0.0
        }))
        .unwrap()
    }

    fn sizes() -> serde_json::Value {
        let s = serde_json::json!({ "bet": "50%", "raise": "" });
        serde_json::json!({ "oop": s, "ip": s })
    }

    fn wait_until_finished(session: &Session) -> Status {
        let deadline = Instant::now() + Duration::from_secs(30);
        loop {
            let status = session.status();
            if !matches!(status, Status::Solving { .. }) || Instant::now() > deadline {
                return status;
            }
            thread::sleep(Duration::from_millis(10));
        }
    }

    #[test]
    fn ソルブが終わるとノードを閲覧できる() {
        let session = Session::new(1 << 30);
        assert!(session.node(&[]).is_err());
        session.start(&river_config(), SolveOptions { max_iterations: 100, target_exploitability: 0.0 }).unwrap();
        assert!(matches!(wait_until_finished(&session), Status::Solved { iteration: 100, .. }));
        assert!(session.node(&[]).is_ok());
    }

    #[test]
    fn 目標のexploitabilityに達したら最大反復回数の前に止まる() {
        let session = Session::new(1 << 30);
        session.start(&river_config(), SolveOptions { max_iterations: 10_000, target_exploitability: 50.0 }).unwrap();
        let Status::Solved { iteration, exploitability } = wait_until_finished(&session) else { panic!() };
        assert!(iteration < 10_000);
        assert!(exploitability <= 50.0);
    }

    #[test]
    fn 必要メモリが上限を超えるとソルブを始めない() {
        let session = Session::new(1);
        let error = session.start(&river_config(), SolveOptions { max_iterations: 10, target_exploitability: 0.0 });
        assert!(error.unwrap_err().contains("上限"));
        assert!(matches!(session.status(), Status::Idle));
    }
}
