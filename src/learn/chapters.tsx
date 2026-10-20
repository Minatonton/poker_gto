import type { ReactNode } from 'react'
import {
  BetOddsCard,
  CallOddsCard,
  EquityCard,
  GeometricCard,
  OutsCard,
} from '../components/tools/Calculators'
import { AkqGame, RockPaperScissors } from '../components/tools/ToyGames'

export interface Chapter {
  id: string
  title: string
  /** 一覧に出す一行の説明 */
  lead: string
  body: ReactNode
  /** 触って確かめる道具 */
  tools?: ReactNode
  sources: { title: string; url: string }[]
}

const NOTE = 'https://note.com/goole/n/'

/*
 * 教材の文章は、ポーカー理論の一般的な概念を自分の言葉で説明したもの。
 * 参考にした Amu 氏の note の記事は各章の末尾にリンクを置き、詳しくは元の記事を読む前提にしている
 */
export const CHAPTERS: Chapter[] = [
  {
    id: 'ev-eq',
    title: 'EV と EQ',
    lead: '期待値と勝率の違い。コールするかはオッズと比べて決める',
    body: (
      <>
        <p>
          <strong>EV（期待値）</strong>はその選択で平均して得られるチップの量、<strong>EQ（エクイティ）</strong>
          は今のハンドの勝率（引き分けは半分）です。EV を直接暗算するのは難しいので、実戦では「EQ が必要な勝率を超えているか」で判断します。
        </p>
        <ul>
          <li>オッズ = 勝ったときに得るチップ（自分のコール分を含む）÷ コール額</li>
          <li>必要勝率 = 1 ÷ オッズ。EQ がこれを上回れば、オールインのコールは +EV</li>
          <li>EQ が 50% 未満でも、オッズが良ければコールが正解になることは多い</li>
          <li>
            オールインでないときは、後のストリートで打たれて EQ の一部を手放します。EQ のうち実際に取り戻せる割合を
            <strong>EQR（EQ の実現率）</strong>と呼びます
          </li>
          <li>後のストリートで相手から追加で取れる分も含めたオッズを、インプライドオッズと呼びます</li>
        </ul>
      </>
    ),
    tools: (
      <>
        <BetOddsCard />
        <EquityCard />
        <CallOddsCard />
      </>
    ),
    sources: [{ title: 'EVとEQ', url: `${NOTE}n92909ce3823e` }],
  },
  {
    id: 'outs',
    title: 'アウツと完成確率',
    lead: 'ドローの完成確率を素早く見積もる',
    body: (
      <>
        <p>引けば勝てるカードを<strong>アウツ</strong>と呼びます。完成確率は次の暗算で近い値を出せます。</p>
        <ul>
          <li>フロップからリバーまで（2枚めくる）: アウツ × 4%</li>
          <li>ターンからリバー（1枚めくる）: アウツ × 2%</li>
          <li>例: フラッシュドロー（9枚）なら、フロップからは約 36%、ターンからは約 18%</li>
        </ul>
        <p>フロップでオールインされたときは2枚分、ターンで打たれて次も打たれそうなときは1枚分で考えます。</p>
      </>
    ),
    tools: <OutsCard />,
    sources: [{ title: 'EVとEQ', url: `${NOTE}n92909ce3823e` }],
  },
  {
    id: 'bet-size',
    title: 'ベットサイズと MDF',
    lead: 'サイズはポット比で考える。大きいほど相手のコールレンジは強くなる',
    body: (
      <>
        <p>ベットの大きさは金額ではなく、ベット前のポットに対する比率（pot%）で考えます。</p>
        <table className="plain-table">
          <thead>
            <tr>
              <th>ベット（ポット比）</th>
              <th className="num">相手の必要勝率</th>
              <th className="num">MDF（守るべき割合）</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['33%', '20%', '75%'],
              ['50%', '25%', '67%'],
              ['75%', '30%', '57%'],
              ['100%', '33%', '50%'],
              ['150%', '37.5%', '40%'],
            ].map(([size, required, mdf]) => (
              <tr key={size}>
                <td>{size}</td>
                <td className="num">{required}</td>
                <td className="num">{mdf}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul>
          <li>大きく打つほど相手は弱いハンドを降り、残るコールレンジは強くなる。大きなベットでバリューが残るかを確かめる</li>
          <li>バリューベットは「自分が強い」だけでは足りず、相手がコールするハンドに勝っている必要がある</li>
          <li>小さいベットはフロップやターンで広く使える。リバーではバリューかブラフかがはっきり問われる</li>
          <li>自分のハンドを見る前に、そのスポットで使うサイズの組をレンジ全体で決めておく</li>
        </ul>
      </>
    ),
    tools: <BetOddsCard />,
    sources: [{ title: 'bet sizeの第一歩', url: `${NOTE}ndc8338bdbf1e` }],
  },
  {
    id: 'gto',
    title: 'GTO と搾取',
    lead: 'GTO は保守的な打ち方ではなく、相手がどう動いても損をしない戦略',
    body: (
      <>
        <p>
          ポーカーは2人の間ではゼロサムのゲームで、自分の EV が +0.1 なら相手は -0.1 です。<strong>GTO</strong>
          は相手がどう動いても搾取されない戦略で、GTO 同士の EV は 0 になります。
        </p>
        <ul>
          <li>相手の偏りを突いて最も得をする戦略を MES（最大搾取戦略）と呼ぶ。ただし自分も偏るので、読まれると逆に搾取される</li>
          <li>GTO は「相手も GTO のときの MES」。まず相手を GTO と仮定して組み立て、GTO と違う一点を見つけたらそこを突く</li>
          <li>EV ロスは、その選択が正しい選択に比べてどれだけ損をしているか</li>
        </ul>
        <p>下のじゃんけんで、相手の偏りを変えると各手の EV がどう変わるかを確かめられます。</p>
      </>
    ),
    tools: <RockPaperScissors />,
    sources: [
      { title: 'GTOとは何か-誤解と理解-', url: `${NOTE}ndb36157966dd` },
      { title: 'GTOとは何か-対GTO-', url: `${NOTE}n0d05bcb9d08f` },
    ],
  },
  {
    id: 'mixed',
    title: '純粋戦略と混合戦略',
    lead: '混ぜているアクション同士の EV は等しい。頻度どおりに選び分ける',
    body: (
      <>
        <p>
          GTO がある手札で複数のアクションを混ぜるとき、それらの EV は等しくなっています。片方の EV が高ければ、その頻度を上げた方が得になり、GTO
          ではなくなるからです。「こちらの方が EV が高いから多く選ぶ」という説明は誤りです。
        </p>
        <ul>
          <li>混ぜる頻度が偏ると、相手にその偏りを突かれる</li>
          <li>実戦では、時計の秒針などで毎回独立に乱数を作り、前回の選択に引きずられずに頻度どおり選ぶ</li>
          <li>壁打ちの「RNG を使う」で、出目どおりに選ぶ練習ができる</li>
        </ul>
      </>
    ),
    sources: [{ title: '純粋戦略と混合戦略', url: `${NOTE}na484004c82dc` }],
  },
  {
    id: 'range',
    title: 'ハンドとレンジ・ポラライズ',
    lead: '相手の1ハンドではなく、レンジ全体を相手に判断する',
    body: (
      <>
        <p>判断は相手のレンジ全体を前提に行い、結果の勝ち負けではなくその時点のレンジで評価します。考え方は次の順に深まります。</p>
        <ol>
          <li>ハンド vs ハンド</li>
          <li>ハンド vs レンジ</li>
          <li>レンジ vs レンジ</li>
          <li>相手の考え方の型を読む</li>
        </ol>
        <ul>
          <li>リニア: 強いハンドから順に並ぶレンジ（例: UTG のオープン）</li>
          <li>キャップド: 最強のハンドが抜けたレンジ（例: 3ベットせずにコールしたレンジ）</li>
          <li>ポラライズ: 強いハンドとブラフの弱いハンドに二極化したレンジ（例: リバーの大きいベット）</li>
          <li>バリューとブラフの両方を混ぜないと、相手に一方的に突かれる</li>
        </ul>
        <p>下の AKQ ゲームで、二極化したベットのブラフ頻度・コール頻度と、サイズが大きいほど EV が上がる様子を確かめられます。</p>
      </>
    ),
    tools: <AkqGame />,
    sources: [
      { title: 'ハンドとレンジ', url: `${NOTE}n39c55dd3e58f` },
      { title: 'ポラライズ-レンジの類別-', url: `${NOTE}na5d11afa3cb3` },
    ],
  },
  {
    id: 'robust',
    title: 'Robust Equity',
    lead: 'EQ は大きさだけでなく、打たれても残るかで評価する',
    body: (
      <>
        <p>
          相手に打たれても残りやすい EQ を<strong>Robust</strong>、打たれると簡単に失われる EQ を<strong>Vulnerable</strong>
          と呼びます。分析のレンジの構成で、この分類ごとの割合と戦略を見られます。
        </p>
        <table className="plain-table">
          <thead>
            <tr>
              <th />
              <th>Robust</th>
              <th>Vulnerable</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>EQ が大きい</td>
              <td>ポットを育てるためにベット</td>
              <td>相手の小さい EQ を降ろし、逆転を防ぐためにベットも選べる</td>
            </tr>
            <tr>
              <td>EQ が小さい</td>
              <td>相手の大きい EQ を降ろすためにベット（セミブラフ）</td>
              <td>攻撃を控え、チェックで守る</td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li>Robust になりやすい: セット以上、ナッツフラッシュドロー、オープンエンド</li>
          <li>Vulnerable になりやすい: 弱いペア、A ハイ</li>
          <li>レイズを重ねるほど、Vulnerable な EQ を自分から捨てることになる</li>
        </ul>
      </>
    ),
    sources: [{ title: 'Robust Equity-EQの堅牢性-', url: `${NOTE}nbad8ad6d35ae` }],
  },
  {
    id: 'geometric',
    title: 'ジオメトリックベット',
    lead: '残りのストリートで、毎回同じ比率で打ってオールインに届くサイズ',
    body: (
      <>
        <p>
          二極化したレンジで複数のストリートを打つときは、毎回同じポット比で打ってちょうどオールインに届くサイズが基準になります。
          ベットとコールでポットは (1 + 2 × 比率) 倍になるので、残りストリート数をかけてスタックを使い切る比率を求めます。
        </p>
        <ul>
          <li>例: ポット 100・スタック 400 を2ストリートなら、毎回ポットの 100%</li>
          <li>3ストリートで入りきるサイズを 3e、2ストリートなら 2e と書く</li>
        </ul>
      </>
    ),
    tools: <GeometricCard />,
    sources: [{ title: 'Geometric Betsize', url: `${NOTE}n7d55df1ca58f` }],
  },
  {
    id: 'preflop',
    title: 'プリフロップの基本',
    lead: 'サイズの基準を覚え、後ろの人数でオープンの範囲を決める',
    body: (
      <>
        <table className="plain-table">
          <thead>
            <tr>
              <th>場面</th>
              <th>サイズの目安</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>オープン</td>
              <td>2.5bb（SB からは 3bb）</td>
            </tr>
            <tr>
              <td>3ベット</td>
              <td>ポジションがあれば3倍、ブラインドからは4倍</td>
            </tr>
            <tr>
              <td>4ベット</td>
              <td>2〜2.5倍</td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li>後ろに残っている人数が多いほど、オープンの範囲は狭い</li>
          <li>3ベットは「バリュー」「ブラフ」に分けて理解する。ブラフには A を持つ低いスーテッドなど、相手の強いハンドを減らす（ブロッカー）ものを使う</li>
          <li>覚えるときは、表を見る前に自分でレンジを描いてから答え合わせする（壁打ちの「レンジを塗る」）</li>
        </ul>
      </>
    ),
    sources: [
      { title: 'プリフロップレンジの覚え方', url: `${NOTE}n0848d4ac675f` },
      { title: '"超"初心者講習', url: `${NOTE}n0623e8fcab03` },
    ],
  },
  {
    id: 'review',
    title: 'ハンドレビューの進め方',
    lead: '正誤より、思考の流れと次の判断の基準を残す',
    body: (
      <>
        <ol>
          <li>自分の選択と、そう判断した理由を書く</li>
          <li>その手札の GTO の頻度と、レンジ全体の戦略を確かめる</li>
          <li>ずれの原因を分ける（ボードの戦略の誤解、ハンド選びの誤解、別のスポットの知識の流用）</li>
          <li>EV がどこから生まれているか（相手のどの応答からか）を考える</li>
          <li>次に同じ場面でどう判断するかを書き、知識を更新する</li>
        </ol>
        <p>壁打ちの「振り返り」で、この順に記録できます。</p>
      </>
    ),
    sources: [{ title: '思考をハンドレビューする', url: `${NOTE}n3f418975599b` }],
  },
]
