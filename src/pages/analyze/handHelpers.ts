import { actionColor } from '../../components/actionColors'
import type { HistoryEntry } from '../../components/table/HandHistory'
import type { Hero } from '../../poker/hero'
import type { Walk } from '../../poker/preflop'
import type { ActionKind } from '../../poker/strategy'

/** プリフロップの履歴。行を押すと、その手前からやり直す */
export function preflopHistory(walk: Walk, choices: ActionKind[], onNavigate: (choices: ActionKind[]) => void) {
  let choiceCount = 0
  return walk.steps.map((step): HistoryEntry => {
    const rewindTo = choiceCount
    const auto = step.strategy === null
    if (!auto) choiceCount++
    return {
      actor: step.position,
      label: auto ? 'Fold（データなし）' : step.action.label,
      color: actionColor(step.action),
      disabled: auto,
      onRewind: () => onNavigate(choices.slice(0, rewindTo)),
    }
  })
}

/** 自分の席と手札をまだ決めていないときに、何をすればよいかを先に伝える */
export function coachForSeat(hero: Hero): string | null {
  if (!hero.position) return '卓の席をクリックすると、あなたの席になります（座らなくても入力できます）。'
  if (!hero.cards) return 'あなたの手札（卓の ＋）をクリックして選ぶと、その手札の答えが出ます。'
  return null
}
