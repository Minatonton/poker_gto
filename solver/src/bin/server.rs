//! ブラウザの画面から呼び出すローカル専用のソルバーサーバー。
//! ブラウザ内の WASM で動かさないのは、スレッドが使えず 4GiB のメモリ上限もあり、
//! フロップからのソルブにはネイティブのマルチスレッドより一桁以上時間がかかるため。

use poker_gto_solver::{Session, SolveOptions, SpotConfig};
use serde::Deserialize;
use std::io::Read;
use tiny_http::{Header, Method, Request, Response, Server};

const ADDRESS: &str = "127.0.0.1:8787";
const ALLOWED_ORIGIN: &str = "http://localhost:5173";
const DEFAULT_MAX_MEMORY_GIB: f64 = 12.0;
const MAX_BODY_BYTES: u64 = 1 << 20;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SolveRequest {
    config: SpotConfig,
    options: SolveOptions,
}

#[derive(Deserialize)]
struct NodeRequest {
    history: Vec<usize>,
}

fn main() {
    let max_memory_gib = std::env::var("SOLVER_MAX_MEMORY_GIB")
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(DEFAULT_MAX_MEMORY_GIB);
    let session = Session::new((max_memory_gib * (1u64 << 30) as f64) as u64);

    // 外部から接続されないよう、ループバックアドレスだけで待ち受ける
    let server = Server::http(ADDRESS).expect("サーバーを起動できません");
    println!("solver server: http://{ADDRESS} (メモリ上限 {max_memory_gib}GiB)");

    for mut request in server.incoming_requests() {
        // 想定外の panic で、ソルブ中の状態ごとサーバーが落ちないようにする
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| handle(&session, &mut request)))
            .unwrap_or_else(|_| Err((500, "サーバー内部でエラーが発生しました".into())));
        let response = match result {
            Ok(body) => Response::from_string(body).with_status_code(200),
            Err((code, message)) => {
                Response::from_string(serde_json::json!({ "error": message }).to_string()).with_status_code(code)
            }
        };
        let _ = request.respond(
            response
                .with_header(header("Content-Type", "application/json"))
                .with_header(header("Access-Control-Allow-Origin", ALLOWED_ORIGIN))
                .with_header(header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"))
                .with_header(header("Access-Control-Allow-Headers", "Content-Type")),
        );
    }
}

/// localhost で待ち受けていても、ブラウザで開いた別のサイトからはリクエストを送れてしまう。
/// 重いソルブを勝手に始められないよう、この画面以外の Origin と、
/// CORS のプリフライトを経ない JSON 以外の POST を拒否している。
fn reject_foreign(request: &Request) -> Result<(), (u16, String)> {
    let header_value = |name: &'static str| {
        request.headers().iter().find(|h| h.field.equiv(name)).map(|h| h.value.as_str().to_owned())
    };
    if header_value("Origin").is_some_and(|origin| origin != ALLOWED_ORIGIN) {
        return Err((403, "許可されていない Origin です".into()));
    }
    if *request.method() == Method::Post
        && !header_value("Content-Type").is_some_and(|t| t.starts_with("application/json"))
    {
        return Err((415, "Content-Type は application/json にしてください".into()));
    }
    Ok(())
}

fn handle(session: &Session, request: &mut Request) -> Result<String, (u16, String)> {
    let bad_request = |e: String| (400, e);
    if *request.method() != Method::Options {
        reject_foreign(request)?;
    }
    match (request.method(), request.url()) {
        (Method::Options, _) => Ok(String::new()),
        (Method::Get, "/status") => Ok(serde_json::to_string(&session.status()).unwrap()),
        (Method::Post, "/solve") => {
            let body: SolveRequest = read_json(request).map_err(bad_request)?;
            session.start(&body.config, body.options).map_err(bad_request)?;
            Ok("{}".into())
        }
        (Method::Post, "/stop") => {
            session.stop();
            Ok("{}".into())
        }
        (Method::Post, "/node") => {
            let body: NodeRequest = read_json(request).map_err(bad_request)?;
            let node = session.node(&body.history).map_err(bad_request)?;
            Ok(serde_json::to_string(&node).unwrap())
        }
        _ => Err((404, "Not Found".into())),
    }
}

fn read_json<T: for<'de> Deserialize<'de>>(request: &mut Request) -> Result<T, String> {
    let mut body = String::new();
    request.as_reader().take(MAX_BODY_BYTES).read_to_string(&mut body).map_err(|e| e.to_string())?;
    serde_json::from_str(&body).map_err(|e| format!("リクエストを解釈できません: {e}"))
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name, value).unwrap()
}
