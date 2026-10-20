//! postflop-solver をローカルの HTTP サーバー経由でブラウザから使うためのラッパー。
//! JSON の型は `src/solver/types.ts` と揃えている。

mod node;
mod report;
mod session;
mod spot;

pub use node::{NodeInfo, node_info};
pub use report::{Report, ReportStatus};
pub use session::{Session, SolveOptions, Status};
pub use spot::{SpotConfig, build_game};
