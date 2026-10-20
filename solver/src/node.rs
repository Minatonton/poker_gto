use postflop_solver::{Action, PostFlopGame, card_to_string, holes_to_strings};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionInfo {
    /// "fold" | "check" | "call" | "bet" | "raise" | "allin"
    pub kind: &'static str,
    /// そのストリートでの合計ベット額（チップ）。fold / check / call では 0
    pub amount: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandInfo {
    pub cards: String,
    /// プリフロップのレンジの重みに、このノードまでの到達確率を掛けたもの（0〜1）
    pub weight: f32,
    /// weight に、ボードと相手のレンジとのカードの重なりを考慮した相手のコンボ数を掛けたもの。
    /// 戦略や EV をレンジ全体で平均するときはこちらで重み付けする
    pub normalized_weight: f32,
    /// actions と同じ並びの頻度
    pub strategy: Vec<f32>,
    pub ev: f32,
    pub equity: f32,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NodeKind {
    #[serde(rename_all = "camelCase")]
    Player { player: usize, actions: Vec<ActionInfo>, hands: Vec<HandInfo> },
    #[serde(rename_all = "camelCase")]
    Chance { possible_cards: Vec<u8> },
    Terminal,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeInfo {
    pub board: Vec<String>,
    pub pot: i32,
    /// ルートからの各プレイヤーの累計ベット額 [OOP, IP]
    pub bets: [i32; 2],
    #[serde(flatten)]
    pub node: NodeKind,
}

/// postflop-solver の apply_history は不正なアクションで panic し、サーバーごと落ちてしまう。
/// そのため、1手ずつ検証してからエラーとして返している。
pub fn node_info(game: &mut PostFlopGame, history: &[usize]) -> Result<NodeInfo, String> {
    game.back_to_root();
    for (depth, &action) in history.iter().enumerate() {
        if game.is_terminal_node() {
            return Err(format!("{depth}手目は終端ノードのため進めません"));
        }
        if game.is_chance_node() {
            if action >= 52 || game.possible_cards() & (1 << action) == 0 {
                return Err(format!("{depth}手目のカード {action} は配れません"));
            }
        } else if action >= game.available_actions().len() {
            return Err(format!("{depth}手目のアクション {action} は存在しません"));
        }
        game.play(action);
    }

    let board = game
        .current_board()
        .into_iter()
        .map(card_to_string)
        .collect::<Result<Vec<_>, _>>()?;
    let bets = game.total_bet_amount();
    let pot = game.tree_config().starting_pot + bets[0] + bets[1];

    let node = if game.is_terminal_node() {
        NodeKind::Terminal
    } else if game.is_chance_node() {
        let mask = game.possible_cards();
        NodeKind::Chance { possible_cards: (0..52u8).filter(|&c| mask & (1 << c) != 0).collect() }
    } else {
        player_node(game)?
    };

    Ok(NodeInfo { board, pot, bets, node })
}

fn player_node(game: &mut PostFlopGame) -> Result<NodeKind, String> {
    game.cache_normalized_weights();
    let player = game.current_player();
    let actions = game.available_actions().into_iter().map(action_info).collect::<Vec<_>>();
    let cards = holes_to_strings(game.private_cards(player))?;
    let weights = game.weights(player).to_vec();
    let normalized_weights = game.normalized_weights(player);
    let strategy = game.strategy();
    let equity = game.equity(player);
    let ev = game.expected_values(player);

    let num_hands = cards.len();
    let hands = cards
        .into_iter()
        .enumerate()
        .map(|(i, cards)| HandInfo {
            cards,
            weight: weights[i],
            normalized_weight: normalized_weights[i],
            strategy: (0..actions.len()).map(|a| strategy[a * num_hands + i]).collect(),
            ev: ev[i],
            equity: equity[i],
        })
        .collect();

    Ok(NodeKind::Player { player, actions, hands })
}

fn action_info(action: Action) -> ActionInfo {
    let (kind, amount) = match action {
        Action::Fold => ("fold", 0),
        Action::Check => ("check", 0),
        Action::Call => ("call", 0),
        Action::Bet(a) => ("bet", a),
        Action::Raise(a) => ("raise", a),
        Action::AllIn(a) => ("allin", a),
        Action::None | Action::Chance(_) => unreachable!("プレイヤーノードには現れない"),
    };
    ActionInfo { kind, amount }
}

#[cfg(test)]
#[allow(non_snake_case)]
mod tests {
    use super::*;
    use crate::spot::{SizeOptions, SpotConfig, StreetSizes, build_game};
    use postflop_solver::{finalize, solve_step};

    fn sizes() -> StreetSizes {
        let s = || SizeOptions { bet: "50%".into(), raise: "".into() };
        StreetSizes { oop: s(), ip: s() }
    }

    fn solved_river_game() -> PostFlopGame {
        let config = SpotConfig {
            oop_range: "AA,KK,QQ,AK".into(),
            ip_range: "AA,KK,QQ,JJ".into(),
            board: "Td9d6hQc2s".into(),
            starting_pot: 1000,
            effective_stack: 2000,
            rake_rate: 0.0,
            rake_cap: 0.0,
            flop: sizes(),
            turn: sizes(),
            river: sizes(),
            add_allin_threshold: 0.0,
            force_allin_threshold: 0.0,
        };
        let mut game = build_game(&config).unwrap();
        game.allocate_memory(false);
        for i in 0..50 {
            solve_step(&game, i);
        }
        finalize(&mut game);
        game
    }

    #[test]
    fn ルートはOOPの判断ノードで各ハンドの頻度の合計が1になる() {
        let mut game = solved_river_game();
        let info = node_info(&mut game, &[]).unwrap();
        let NodeKind::Player { player, actions, hands } = info.node else { panic!("判断ノードではない") };
        assert_eq!(player, 0);
        assert_eq!(actions[0].kind, "check");
        for hand in hands.iter().filter(|h| h.weight > 0.0) {
            assert!((hand.strategy.iter().sum::<f32>() - 1.0).abs() < 1e-3);
        }
    }

    #[test]
    fn ベットするとポットとベット額に反映される() {
        let mut game = solved_river_game();
        let info = node_info(&mut game, &[1]).unwrap();
        assert_eq!(info.bets, [500, 0]);
        assert_eq!(info.pot, 1500);
    }

    #[test]
    fn チェックが2回続くと終端ノードになる() {
        let mut game = solved_river_game();
        let info = node_info(&mut game, &[0, 0]).unwrap();
        assert!(matches!(info.node, NodeKind::Terminal));
    }

    #[test]
    fn 存在しないアクションはpanicせずエラーを返す() {
        let mut game = solved_river_game();
        assert!(node_info(&mut game, &[99]).is_err());
        assert!(node_info(&mut game, &[0, 0, 0]).is_err());
    }
}
