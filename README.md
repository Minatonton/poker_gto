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

画面の入り口は3つ。

| 入り口 | できること |
|---|---|
| **分析** | 2〜9人の卓で各プレイヤーのアクションを1手ずつ入れ、手番の人のレンジと戦略を見る。フロップまで進んだら、その2人のスポットをソルブして続きを入れ、戦略・EV・EQ・EQR・レンジの構成を見る。「フロップを比較」では同じスポットを代表的なフロップでまとめて解く |
| **壁打ち** | GTO を相手に判断し、Best〜Blunder の採点と、なぜ別のアクションを選ぶべきかの説明を受ける。レンジの塗り絵と、ハンドの振り返りの記録もここ |
| **教材** | EV と EQ、ベットサイズ、GTO、混合戦略、レンジ、Robust Equity、ジオメトリックベット、プリフロップ、ハンドレビューを章ごとに読み、計算機やトイゲームで数字を変えて確かめる |

学習の内容は Amu 氏の note（[目次](https://note.com/goole/n/n1509d08eba55)）の考え方を、計算や表示、ドリルとして組み込んだもの。

> [!NOTE]
> プリフロップのレンジは、一般的に知られている標準的なレンジをもとにした**近似値**で、ソルバーの出力ではない。
> ポストフロップのソルバーは2人までしか扱えない。

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
