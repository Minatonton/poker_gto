# Poker GTO

GTO Wizard のような、ポーカーの GTO 戦略を閲覧・学習するためのローカル Web アプリ。個人利用を前提にしている。

対象ゲーム: **Cash / 100bb**（2〜9人。プリフロップのレンジは6人卓をもとにした近似値）

## 起動

[Rust](https://rustup.rs/) と Node.js（pnpm）が必要。ターミナルを2つ使う。

```sh
pnpm install
pnpm solver   # ソルバーサーバー http://127.0.0.1:8787（初回はビルドに数分かかる）
pnpm dev      # 画面 http://localhost:5173
```

テスト:

```sh
pnpm test
cargo test --release --manifest-path solver/Cargo.toml
```

ソルバーサーバーが確保するメモリの上限は既定で 12GiB。`SOLVER_MAX_MEMORY_GIB=16 pnpm solver` のように変更できる。

## 現在できること

- プリフロップのアクションツリーを辿り、各ポジションのレンジを 13×13 グリッドで表示する
  - オープン（RFI）→ オープンへの応答（3Bet / Call / Fold）→ 3ベットへの応答（4Bet / Call / Fold）
- アクションごとの全体頻度とコンボ数、ハンドごとの頻度を表示する
- 特定のアクションだけを強調表示する
- フロップまで進んだラインを、ポストフロップのソルバーで解く
  - プリフロップの各判断の頻度から、両者のレンジ・ポット・有効スタックを自動で求める
  - ボードとベットサイズを指定してソルブし、各ノードの戦略・EV・エクイティを表示する
  - ターン・リバーのカードを選んで先のストリートへ進める

> [!NOTE]
> 現在のプリフロップレンジは、一般的に知られている標準的なレンジをもとにした**近似値**で、ソルバーの出力ではない。

## ロードマップ

1. ✅ プリフロップのレンジビューア
2. ✅ ポストフロップのカスタムソルブ（[postflop-solver](https://github.com/b-inary/postflop-solver) をローカルの Rust サーバーで実行）
3. トレーナー（スポットを出題し、GTO 頻度と EV 損失で採点）
4. 代表フロップの事前計算ライブラリと集計レポート
5. ハンド履歴の分析

## 構成

| パス | 役割 |
|---|---|
| `src/poker/` | ハンド・レンジ表記・戦略・プリフロップのツリー探索（UI 非依存） |
| `src/data/` | 戦略データ |
| `src/components/` | React コンポーネント |
| `src/solver/` | ソルバーサーバーとの通信と、結果のハンドクラス単位への集約 |
| `solver/` | postflop-solver を包む Rust の HTTP サーバー（127.0.0.1 でのみ待ち受ける） |

## ライセンス

[postflop-solver](https://github.com/b-inary/postflop-solver)（AGPL-3.0）を利用しているため、このリポジトリも [AGPL-3.0](LICENSE) とする。
