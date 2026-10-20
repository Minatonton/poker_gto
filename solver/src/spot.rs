use postflop_solver::{
    ActionTree, BetSizeOptions, BoardState, CardConfig, NOT_DEALT, PostFlopGame, Range, TreeConfig,
    card_from_str, flop_from_str,
};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SizeOptions {
    pub bet: String,
    pub raise: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreetSizes {
    pub oop: SizeOptions,
    pub ip: SizeOptions,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotConfig {
    pub oop_range: String,
    pub ip_range: String,
    /// "Td9d6h"（フロップ）、"Td9d6hQc"（ターン）、"Td9d6hQc7s"（リバー）
    pub board: String,
    /// チップ単位。1bb = 100 チップ
    pub starting_pot: i32,
    pub effective_stack: i32,
    pub rake_rate: f64,
    pub rake_cap: f64,
    pub flop: StreetSizes,
    pub turn: StreetSizes,
    pub river: StreetSizes,
    pub add_allin_threshold: f64,
    pub force_allin_threshold: f64,
}

pub fn build_game(config: &SpotConfig) -> Result<PostFlopGame, String> {
    let board = config.board.replace(' ', "");
    if !matches!(board.len(), 6 | 8 | 10) {
        return Err(format!("ボードは3〜5枚で指定してください: {}", config.board));
    }
    let turn = if board.len() >= 8 { card_from_str(&board[6..8])? } else { NOT_DEALT };
    let river = if board.len() == 10 { card_from_str(&board[8..10])? } else { NOT_DEALT };
    let initial_state = match board.len() {
        6 => BoardState::Flop,
        8 => BoardState::Turn,
        _ => BoardState::River,
    };

    let card_config = CardConfig {
        range: [parse_range(&config.oop_range)?, parse_range(&config.ip_range)?],
        flop: flop_from_str(&board[0..6])?,
        turn,
        river,
    };

    let tree_config = TreeConfig {
        initial_state,
        starting_pot: config.starting_pot,
        effective_stack: config.effective_stack,
        rake_rate: config.rake_rate,
        rake_cap: config.rake_cap,
        flop_bet_sizes: street_sizes(&config.flop)?,
        turn_bet_sizes: street_sizes(&config.turn)?,
        river_bet_sizes: street_sizes(&config.river)?,
        turn_donk_sizes: None,
        river_donk_sizes: None,
        add_allin_threshold: config.add_allin_threshold,
        force_allin_threshold: config.force_allin_threshold,
        merging_threshold: 0.1,
    };

    let action_tree = ActionTree::new(tree_config)?;
    PostFlopGame::with_config(card_config, action_tree)
}

fn parse_range(notation: &str) -> Result<Range, String> {
    notation.parse::<Range>().map_err(|e| format!("レンジを解釈できません ({notation}): {e}"))
}

fn street_sizes(sizes: &StreetSizes) -> Result<[BetSizeOptions; 2], String> {
    let parse = |s: &SizeOptions| BetSizeOptions::try_from((s.bet.as_str(), s.raise.as_str()));
    Ok([parse(&sizes.oop)?, parse(&sizes.ip)?])
}
