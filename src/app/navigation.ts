export type Section = 'analyze' | 'practice' | 'learn'

/** 画面の入り口は、何をしたいかで選べる3つだけにしている */
export const SECTIONS: { section: Section; label: string; description: string }[] = [
  { section: 'analyze', label: '分析', description: '相手の出方を入れて GTO を計算する' },
  { section: 'practice', label: '壁打ち', description: 'GTO を相手に練習して採点を受ける' },
  { section: 'learn', label: '教材', description: '考え方を読んで、数字を変えて確かめる' },
]

export type AnalyzeView = 'hand' | 'compare'
export type PracticeView = 'trainer' | 'drill' | 'review'

export const ANALYZE_VIEWS: { value: AnalyzeView; label: string }[] = [
  { value: 'hand', label: 'ハンドを分析' },
  { value: 'compare', label: 'フロップを比較' },
]

export const PRACTICE_VIEWS: { value: PracticeView; label: string }[] = [
  { value: 'trainer', label: 'GTO と対戦' },
  { value: 'drill', label: 'レンジを塗る' },
  { value: 'review', label: '振り返り' },
]
