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

/**
 * 解説の1行が、考える順番のどこにあたるか。人は「どんな場面か → 自分の手はどうか → だからどうする」の順に考えるので、
 * 解説もその順に並べて見せる。理由を思いついた順に並べると、読む人が自分で組み立て直す手間が残るため
 */
export type ReasonStep = 'scene' | 'hand' | 'verdict' | 'memory'

export interface Reason {
  step: ReasonStep
  text: string
}

export const REASON_STEPS: { step: ReasonStep; label: string }[] = [
  { step: 'scene', label: '場面' },
  { step: 'hand', label: '手札' },
  { step: 'verdict', label: '結論' },
]

/** 考える順番に並べ替える。同じ段の中では、組み立てた順を保つ。覚えるための一言は段の外で、最後に置く */
export function inThinkingOrder(reasons: Reason[]): Reason[] {
  const order: ReasonStep[] = [...REASON_STEPS.map((s) => s.step), 'memory']
  return [...reasons].sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step))
}

const scene = (text: string): Reason => ({ step: 'scene', text })
const handReason = (text: string): Reason => ({ step: 'hand', text })
const verdict = (text: string): Reason => ({ step: 'verdict', text })
const memory = (text: string): Reason => ({ step: 'memory', text })

/** 頻度を言葉にする境目。細かい % のままだと覚えられないので、卓で思い出せる言葉に丸める */
const FREQUENCY_WORDS: { min: number; word: string }[] = [
  { min: 0.9, word: 'いつも' },
  { min: 0.6, word: 'たいてい' },
  { min: 0.4, word: '半分ほど' },
  { min: 0.1, word: 'ときどき' },
]

/**
 * 覚えるための一言。例:「CO の A5s は、たいてい Raise 2.5bb、ときどき Fold」。
 * 10% 未満のアクションは言葉に入れない。卓で毎回思い出すには、主な選択だけで足りるため
 */
export function memoryLine(subject: string, actions: Action[], frequencies: readonly number[]): string {
  const parts = actions
    .map((action, i) => ({ action, f: frequencies[i] ?? 0 }))
    .filter((a) => a.f >= FREQUENCY_WORDS.at(-1)!.min)
    .sort((a, b) => b.f - a.f)
    .map(({ action, f }) => `${FREQUENCY_WORDS.find((w) => f >= w.min)!.word} ${action.label}`)
  return `「${subject}は、${parts.join('、')}」。`
}

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
  /** 手番の人の席。覚えるための一言に使う */
  position?: string
  /**
   * 頻度の行（「選んだ Raise 2.5bb が最も多く選ばれます」）を外す。額だけが違うときに使う。
   * 別の額を選んだ人には、選んだものが正解だと言っているように読めてしまうため
   */
  omitFrequency?: boolean
  /**
   * 額を選ばせたときの、選んだアクションの呼び方（例: 「3Bet 6.5bb」）。「選んだ〜」の文にだけ使う。
   * データの額のままだと、別の額を選んだ人には別の手の話に読めるため。覚えるための一言は GTO の額のままにする
   */
  chosenLabel?: string
}

const BROADWAY = ['A', 'K', 'Q', 'J', 'T']
/** 強い順。ハンドの表記（AKs など）は強いカードが先に来る */
const RANKS = 'AKQJT98765432'

/**
 * 手札そのものの性質。どのハンドにも1行は付ける。
 * 人は場面を見たあと、まず「自分の手はどういう手か」を確かめるので、正解が Fold の手でもここを飛ばさない
 */
function handProfile(hand: HandClass): string {
  if (hand.length === 2) {
    return 'ポケットペアは、フロップでセットになれば大きなポットを取れるため、ポジションが良いほど参加する価値が上がります。'
  }
  if (hand.endsWith('s')) {
    return 'スーテッドはフラッシュの可能性があり、後のストリートで EQ を実現しやすい（EQR が高い）ため、同じランクのオフスートより参加しやすいハンドです。'
  }
  if (BROADWAY.includes(hand[0]) && BROADWAY.includes(hand[1])) {
    return `${hand} は2枚とも T 以上で、ペアになったときにキッカーも強い手です。オフスートなので、フラッシュの見込みはありません。`
  }
  if (BROADWAY.includes(hand[0]) && WEAK_KICKERS.includes(hand[1])) {
    return `${hand} はオフスートでキッカーが弱く、${hand[0]} が当たっても相手のレンジにある ${hand[0]}x の強いハンドに負けやすい（ドミネートされやすい）ハンドです。`
  }
  if (RANKS.indexOf(hand[0]) - RANKS.indexOf(hand[1]) <= 2) {
    return `${hand} はつながっていてストレートの見込みはありますが、オフスートでフラッシュの見込みがなく、ペアになっても低いペアにしかなりません。`
  }
  return `${hand} はオフスートで、フラッシュの見込みがなく、ペアになっても強いキッカーの手に負けやすいハンドです。`
}

/** プリフロップの採点に添える説明。正解のアクションを選ぶ理由を、頻度と EQ とオッズから組み立てる */
export function explainPreflop(input: PreflopExplainInput): Reason[] {
  const { hand, actions, frequencies, chosen } = input
  const asChosen = actions.map((a, i) => (i === chosen && input.chosenLabel ? { ...a, label: input.chosenLabel } : a))
  const reasons = input.omitFrequency ? [] : [verdict(frequencyLine(asChosen, frequencies, chosen))]
  const mixed = mixedLine(asChosen, frequencies, chosen)
  if (mixed) reasons.push(verdict(mixed))

  const best = bestIndex(frequencies)
  const bestAction = actions[best]
  const chosenAction = actions[chosen]
  const suited = hand.endsWith('s')
  const hasAce = hand.startsWith('A')
  const remember = memory(memoryLine(`${input.position ? `${input.position} の ` : ''}${hand} `, actions, frequencies))

  if (input.toCall === undefined) {
    // オープンの判断
    reasons.push(
      scene(
        `まだ誰も参加していないので、先にレイズするかどうかの判断です。後ろには ${input.playersBehind} 人残っていて、人数が少ないほどオープンできるレンジは広がります。`,
      ),
    )
    if (bestAction.kind === 'raise' && chosenAction.kind === 'fold') {
      reasons.push(
        verdict(`後ろが ${input.playersBehind} 人なら、${hand} は先に参加して主導権を取れるだけの強さがあります。`),
      )
    } else if (bestAction.kind === 'fold' && chosenAction.kind === 'raise') {
      reasons.push(
        verdict(
          `後ろに ${input.playersBehind} 人残っていると、誰かがより強いハンドを持っている可能性が高く、${hand} ではオープンしても利益を出しにくいです。前のポジションほどレンジを絞ります。`,
        ),
      )
    }
    reasons.push(handReason(handProfile(hand)))
    return inThinkingOrder([...reasons, remember])
  }

  // 英字の席名と日本語の間には空白を入れる決まりなので、「相手」のときだけ空白を付けない
  const opponent = input.aggressor ?? '相手'
  const gap = input.aggressor ? ' ' : ''
  const middle = input.potBeforeCall ?? 0
  const required = requiredEquity(middle, input.toCall)
  reasons.push(
    scene(
      `${opponent}${gap}のレイズを受けています。コールに必要な勝率は ${pct(required)}（${bb(input.toCall)} を払って ${bb(middle + input.toCall)} を取り合う）。`,
    ),
  )
  if (input.equity !== undefined) {
    reasons.push(handReason(`${hand} の${gap}${opponent}${gap}のレンジに対する EQ は ${pct(input.equity)} です。`))
  }

  reasons.push(handReason(handProfile(hand)))

  if (bestAction.kind === 'fold' && chosenAction.kind !== 'fold') {
    reasons.push(
      verdict(
        input.equity !== undefined && input.equity < required
          ? 'EQ が必要勝率を下回っているので、コールすると平均して損をします。'
          : 'EQ は必要勝率を超えていても、ポジションが悪いとフロップ以降に EQ を実現しきれず（EQR が低く）、実際には損になります。',
      ),
    )
  } else if (bestAction.kind === 'call' && chosenAction.kind === 'fold') {
    reasons.push(
      verdict(
        `${hand} は相手のレンジに対して十分な EQ があり、オッズに見合います。フォールドすると、取れたはずの EV を捨てることになります。`,
      ),
    )
  } else if (bestAction.kind === 'raise') {
    const valueRaise = input.equity !== undefined && input.equity >= 0.5
    reasons.push(
      verdict(
        valueRaise
          ? `${hand} は相手のレンジに対して EQ が 50% を超えるので、より大きなポットを作るバリューのレイズになります。コールで済ませると、取れる EV を逃します。`
          : hasAce && suited
            ? `${hand} はブラフのレイズです。A を持っていることで相手の AA・AK などの強いハンドを減らし（ブロッカー）、コールしても EQ を実現しにくいハンドをレイズに回すことで、レンジのバランスが取れます。`
            : `${hand} はレンジのバランスを取るためにレイズに回すハンドです。コールでは EQ を実現しにくい一方、相手を降ろせれば利益になります。`,
      ),
    )
  } else if (bestAction.kind === 'call' && chosenAction.kind === 'raise') {
    reasons.push(
      verdict(
        `${hand} はレイズしても相手に降りてもらいたいハンドではなく、強いハンドにだけコールされてしまいます。コールでポットを小さく保ち、EQ を実現する方が得です。`,
      ),
    )
  }
  return inThinkingOrder([...reasons, remember])
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
export function explainPostflop(input: PostflopExplainInput): Reason[] {
  const { actions, frequencies, evs, chosen } = input
  const ids = input.cards.map(cardToId) as [number, number]
  const { made, draws, robustness } = classifyHand(ids, input.board.map(cardToId))
  const best = bestIndex(frequencies)
  const reasons = [verdict(frequencyLine(actions, frequencies, chosen))]

  const handText = draws.length > 0 ? `${made}＋${draws.join('・')}` : made
  reasons.push(
    handReason(
      `この手札は ${handText}。EQ は ${pct(input.equity)} で、${ROBUSTNESS_LABEL[robustness]} に分類されます。`,
    ),
  )

  const bestEv = Math.max(...evs)
  const loss = bestEv - evs[chosen]
  reasons.push(
    verdict(
      loss > 0.005
        ? `EV は ${actions[evs.indexOf(bestEv)].label} が ${bb(bestEv)}、選んだ ${actions[chosen].label} は ${bb(evs[chosen])} で、${bb(loss)}（ポットの ${pct(loss / input.pot)}）損をしています。`
        : `選んだ ${actions[chosen].label} の EV は ${bb(evs[chosen])} で、最も高い EV とほぼ同じです。`,
    ),
  )

  const mixed = mixedLine(actions, frequencies, chosen)
  if (mixed) reasons.push(verdict(mixed))

  if (input.toCall > 0) {
    const required = requiredEquity(input.pot, input.toCall)
    reasons.push(
      scene(`${bb(input.toCall)} のベットを受けています。コールに必要な勝率は ${pct(required)} です。`),
      verdict(
        `EQ ${pct(input.equity)} は必要勝率を${input.equity >= required ? '上回って' : '下回って'}います。` +
          (input.equity >= required && actions[best].kind === 'fold'
            ? 'それでもフォールドが正解なのは、後のストリートでさらに打たれて EQ を実現しきれない（EQR が低い）ためです。'
            : input.equity < required && actions[best].kind !== 'fold'
              ? 'それでも降りないのは、後のストリートで相手から追加で取れる見込み（インプライドオッズ）や、ドローが完成したときの利益があるためです。'
              : ''),
      ),
    )
  } else {
    reasons.push(scene(`ポットは ${bb(input.pot)}。まだ誰も打っていないので、先に打つかどうかの判断です。`))
    const big = input.equity >= 0.5
    const advice =
      robustness === 'vulnerable'
        ? big
          ? '大きい EQ でも崩れやすいので、相手の小さい EQ を降ろして逆転の可能性を消すためにベットするか、チェックで守るかを頻度で使い分けます。'
          : 'EQ が小さく崩れやすいので、攻撃を控えてチェックで守るのが基本です。'
        : big
          ? 'EQ が大きく崩れにくいので、ポットを育てるためにベットする価値があります。'
          : 'EQ は小さいが崩れにくいので、相手の大きい EQ を降ろす目的でベット（セミブラフ）に回せます。'
    reasons.push(verdict(advice))
  }

  if (input.categoryFrequencies) {
    const mainCategoryAction = bestIndex(input.categoryFrequencies)
    reasons.push(
      handReason(
        `レンジ全体では、${made} の手札は ${actions[mainCategoryAction].label} を ${pct(input.categoryFrequencies[mainCategoryAction])} 選んでいます。` +
          (input.categoryFrequencies[mainCategoryAction] < MAIN_ACTION_FREQUENCY
            ? '同じ役の中でも、キッカーやブロッカーで選ぶアクションが分かれます。'
            : ''),
      ),
    )
  }
  reasons.push(memory(memoryLine(`この${made}`, actions, frequencies)))
  return inThinkingOrder(reasons)
}

export interface PreflopSizeInput {
  gtoAmount: number
  chosenAmount: number
  /** 自分がレイズする前に真ん中にあるチップ（bb） */
  potBefore: number
  /** 自分がすでに出している額（ブラインドなど） */
  heroInvested: number
  /** 主に相手をする人。オープンなら BB、レイズを受けているならレイズした人 */
  opponent: string
  opponentInvested: number
}

/**
 * レイズの額が GTO と違うときの説明。大きすぎる・小さすぎるのどちらにも理由があり、
 * GTO の額はその釣り合いの点だと伝える。片側の理由だけだと「小さく打てば安全」と誤解されるため。
 * 相手の必要勝率を両方の額で並べ、額が相手に与える条件を数字で比べられるようにする
 */
export function explainPreflopSize(input: PreflopSizeInput): Reason[] {
  const { gtoAmount, chosenAmount, potBefore, heroInvested, opponent, opponentInvested } = input
  const opponentRequired = (size: number) => requiredEquity(potBefore + size - heroInvested, size - opponentInvested)
  const numbers = `${opponent} がコールに必要な勝率は、${chosenAmount}bb なら ${pct(opponentRequired(chosenAmount))}、GTO の ${gtoAmount}bb なら ${pct(opponentRequired(gtoAmount))} です。`
  const tooSmall = chosenAmount < gtoAmount
  return [
    scene(`レイズは正解ですが、額は ${gtoAmount}bb が GTO の基準です。${numbers}`),
    verdict(
      tooSmall
        ? `小さく打つと相手は安い値段で参加できるので、本来なら降りるはずの弱い手までコールしてきます。降ろせたはずのポットを取り損ね、強い手を持っていても、育つポットが小さくなります。`
        : `大きく打つと、払ってほしい弱い手が降り、残るのはあなたに勝てる強い手が中心になります。降りてくれたときの取り分は少ししか増えないのに、負けるときに失う額が大きくなります。`,
    ),
    verdict(`GTO の額は、降りてほしい手には降りてもらい、払ってほしい手にはついて来てもらう、その釣り合いの点です。`),
  ]
}
