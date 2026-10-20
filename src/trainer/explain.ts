import { cardToId } from '../poker/cards'
import { classifyHand, type Robustness } from '../poker/handCategory'
import type { HandClass } from '../poker/hands'
import { requiredEquity } from '../poker/math'
import type { Action } from '../poker/strategy'

/** ドミネートされやすい弱いキッカー */
const WEAK_KICKERS = ['9', '8', '7', '6', '5', '4', '3', '2']

const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`
const bb = (value: number) => `${value.toFixed(2)}bb`

/** 頻度がこれ以上なら、その手札では主にそのアクションを選んでいるとみなす */
const MAIN_ACTION_FREQUENCY = 0.9
/** これ以上選ばれるアクションは、GTO が混ぜて使っているとみなす */
const MIXED_FREQUENCY = 0.25

function bestIndex(frequencies: readonly number[]): number {
  return frequencies.indexOf(Math.max(...frequencies))
}

/** 頻度の比較。どのアクションが正解で、選んだものがどれだけ使われるか */
function frequencyLine(actions: Action[], frequencies: readonly number[], chosen: number): string {
  const best = bestIndex(frequencies)
  const others = actions
    .map((a, i) => ({ label: a.label, f: frequencies[i] }))
    .filter((a) => a.f >= 0.01)
    .map((a) => `${a.label} ${pct(a.f)}`)
    .join('、')
  if (chosen === best) return `GTO の頻度は ${others}。選んだ ${actions[chosen].label} が最も多く選ばれます。`
  return `GTO の頻度は ${others}。選んだ ${actions[chosen].label} は ${pct(frequencies[chosen])} で、主に選ぶべきは ${actions[best].label} です。`
}

function mixedLine(actions: Action[], frequencies: readonly number[], chosen: number): string | null {
  const best = bestIndex(frequencies)
  if (chosen === best || frequencies[chosen] < MIXED_FREQUENCY) return null
  return `${actions[best].label} と ${actions[chosen].label} を混ぜる混合戦略です。均衡では混ぜているアクション同士の EV は等しいので、どちらを選んでも大きな損はありません。頻度どおりに選び分けることが大切です。`
}

export interface PreflopExplainInput {
  hand: HandClass
  actions: Action[]
  frequencies: number[]
  chosen: number
  /** 相手のレンジに対する EQ。オープンの判断では相手が決まっていないので undefined */
  equity?: number
  /** コールに必要な額と、コールする前に真ん中にあるチップの合計（bb） */
  toCall?: number
  potBeforeCall?: number
  /** 最後にレイズした相手 */
  aggressor?: string
  /** 手番より後ろにいる人数 */
  playersBehind: number
}

/** プリフロップの採点に添える説明。正解のアクションを選ぶ理由を、頻度と EQ とオッズから組み立てる */
export function explainPreflop(input: PreflopExplainInput): string[] {
  const { hand, actions, frequencies, chosen } = input
  const lines = [frequencyLine(actions, frequencies, chosen)]
  const mixed = mixedLine(actions, frequencies, chosen)
  if (mixed) lines.push(mixed)

  const best = bestIndex(frequencies)
  const bestAction = actions[best]
  const chosenAction = actions[chosen]
  const suited = hand.endsWith('s')
  const pair = hand.length === 2
  const hasAce = hand.startsWith('A')

  if (input.toCall === undefined) {
    // オープンの判断
    if (bestAction.kind === 'raise' && chosenAction.kind === 'fold') {
      lines.push(
        `後ろにいるのは ${input.playersBehind} 人だけなので、${hand} は先に参加して主導権を取れるだけの強さがあります。後ろの人数が少ないほど、オープンできるレンジは広がります。`,
      )
    } else if (bestAction.kind === 'fold' && chosenAction.kind === 'raise') {
      lines.push(
        `後ろに ${input.playersBehind} 人残っているので、誰かがより強いハンドを持っている可能性が高く、${hand} ではオープンしても利益を出しにくいハンドです。前のポジションほどレンジを絞ります。`,
      )
    }
    if (suited || pair) {
      lines.push(
        pair
          ? 'ポケットペアは、フロップでセットになれば大きなポットを取れるため、ポジションが良いほど参加する価値が上がります。'
          : 'スーテッドはフラッシュの可能性があり、後のストリートで EQ を実現しやすい（EQR が高い）ため、同じランクのオフスートより参加しやすいハンドです。',
      )
    }
    return lines
  }

  const middle = input.potBeforeCall ?? 0
  const required = requiredEquity(middle, input.toCall)
  if (input.equity !== undefined) {
    lines.push(
      `コールに必要な勝率は ${pct(required)}（${bb(input.toCall)} を払って ${bb(middle + input.toCall)} を取り合う）。${hand} の ${input.aggressor ?? '相手'} のレンジに対する EQ は ${pct(input.equity)} です。`,
    )
  }

  if (bestAction.kind === 'fold' && chosenAction.kind !== 'fold') {
    lines.push(
      input.equity !== undefined && input.equity < required
        ? 'EQ が必要勝率を下回っているので、コールすると平均して損をします。'
        : 'EQ は必要勝率を超えていても、ポジションが悪いとフロップ以降に EQ を実現しきれず（EQR が低く）、実際には損になります。',
    )
    if (!pair && !suited && WEAK_KICKERS.includes(hand[1])) {
      lines.push(
        `${hand} はキッカーが弱く、${hand[0]} が当たっても相手のレンジにある ${hand[0]}x の強いハンドに負けやすい（ドミネートされやすい）ハンドです。`,
      )
    }
  } else if (bestAction.kind === 'call' && chosenAction.kind === 'fold') {
    lines.push(
      `${hand} は相手のレンジに対して十分な EQ があり、オッズに見合います。フォールドすると、取れたはずの EV を捨てることになります。`,
    )
  } else if (bestAction.kind === 'raise') {
    const valueRaise = input.equity !== undefined && input.equity >= 0.5
    lines.push(
      valueRaise
        ? `${hand} は相手のレンジに対して EQ が 50% を超えるので、より大きなポットを作るバリューのレイズになります。コールで済ませると、取れる EV を逃します。`
        : hasAce && suited
          ? `${hand} はブラフのレイズです。A を持っていることで相手の AA・AK などの強いハンドを減らし（ブロッカー）、コールしても EQ を実現しにくいハンドをレイズに回すことで、レンジのバランスが取れます。`
          : `${hand} はレンジのバランスを取るためにレイズに回すハンドです。コールでは EQ を実現しにくい一方、相手を降ろせれば利益になります。`,
    )
  } else if (bestAction.kind === 'call' && chosenAction.kind === 'raise') {
    lines.push(
      `${hand} はレイズしても相手に降りてもらいたいハンドではなく、強いハンドにだけコールされてしまいます。コールでポットを小さく保ち、EQ を実現する方が得です。`,
    )
  }
  return lines
}

export interface PostflopExplainInput {
  cards: [string, string]
  board: string[]
  actions: Action[]
  frequencies: number[]
  /** bb */
  evs: number[]
  chosen: number
  equity: number
  /** bb。手番の人が払う必要のある額（ベットを受けていなければ 0） */
  toCall: number
  /** bb */
  pot: number
  /** 同じ役の分類が、レンジ全体としてどのアクションをどれだけ選ぶか */
  categoryFrequencies?: number[]
}

const ROBUSTNESS_LABEL: Record<Robustness, string> = {
  robust: 'Robust（相手に打たれても EQ が残りやすい）',
  middle: '中間（強いが、打たれると EQ を手放すこともある）',
  vulnerable: 'Vulnerable（相手に打たれると EQ を手放しやすい）',
}

/** ポストフロップの採点に添える説明。手札の分類・EV の差・オッズ・Robust EQ の4分類から組み立てる */
export function explainPostflop(input: PostflopExplainInput): string[] {
  const { actions, frequencies, evs, chosen } = input
  const ids = input.cards.map(cardToId) as [number, number]
  const { made, draws, robustness } = classifyHand(ids, input.board.map(cardToId))
  const best = bestIndex(frequencies)
  const lines = [frequencyLine(actions, frequencies, chosen)]

  const handText = draws.length > 0 ? `${made}＋${draws.join('・')}` : made
  lines.push(`この手札は ${handText}。EQ は ${pct(input.equity)} で、${ROBUSTNESS_LABEL[robustness]} に分類されます。`)

  const bestEv = Math.max(...evs)
  const loss = bestEv - evs[chosen]
  lines.push(
    loss > 0.005
      ? `EV は ${actions[evs.indexOf(bestEv)].label} が ${bb(bestEv)}、選んだ ${actions[chosen].label} は ${bb(evs[chosen])} で、${bb(loss)}（ポットの ${pct(loss / input.pot)}）損をしています。`
      : `選んだ ${actions[chosen].label} の EV は ${bb(evs[chosen])} で、最も高い EV とほぼ同じです。`,
  )

  const mixed = mixedLine(actions, frequencies, chosen)
  if (mixed) lines.push(mixed)

  if (input.toCall > 0) {
    const required = requiredEquity(input.pot, input.toCall)
    lines.push(
      `ベットを受けているので、コールに必要な勝率は ${pct(required)}。EQ ${pct(input.equity)} は${input.equity >= required ? '上回って' : '下回って'}います。` +
        (input.equity >= required && actions[best].kind === 'fold'
          ? 'それでもフォールドが正解なのは、後のストリートでさらに打たれて EQ を実現しきれない（EQR が低い）ためです。'
          : input.equity < required && actions[best].kind !== 'fold'
            ? 'それでも降りないのは、後のストリートで相手から追加で取れる見込み（インプライドオッズ）や、ドローが完成したときの利益があるためです。'
            : ''),
    )
  } else {
    const big = input.equity >= 0.5
    const advice =
      robustness === 'vulnerable'
        ? big
          ? '大きい EQ でも崩れやすいので、相手の小さい EQ を降ろして逆転の可能性を消すためにベットするか、チェックで守るかを頻度で使い分けます。'
          : 'EQ が小さく崩れやすいので、攻撃を控えてチェックで守るのが基本です。'
        : big
          ? 'EQ が大きく崩れにくいので、ポットを育てるためにベットする価値があります。'
          : 'EQ は小さいが崩れにくいので、相手の大きい EQ を降ろす目的でベット（セミブラフ）に回せます。'
    lines.push(advice)
  }

  if (input.categoryFrequencies) {
    const mainCategoryAction = bestIndex(input.categoryFrequencies)
    lines.push(
      `レンジ全体では、${made} の手札は ${actions[mainCategoryAction].label} を ${pct(input.categoryFrequencies[mainCategoryAction])} 選んでいます。` +
        (input.categoryFrequencies[mainCategoryAction] < MAIN_ACTION_FREQUENCY ? '同じ役の中でも、キッカーやブロッカーで選ぶアクションが分かれます。' : ''),
    )
  }
  return lines
}
