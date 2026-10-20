/** 読み終えた章の id。章の並びは教材側が持つので、ここでは重複なく覚えるだけにする */
export type ReadMarks = string[]

export function markRead(marks: ReadMarks, chapterId: string): ReadMarks {
  return marks.includes(chapterId) ? marks : [...marks, chapterId]
}

/** 保存された値のうち、今ある章の id だけを残す。章を消したり名前を変えたりしても読了の数がずれないように */
export function normalizeReadMarks(saved: unknown, chapterIds: string[]): ReadMarks {
  if (!Array.isArray(saved)) return []
  return chapterIds.filter((id) => saved.includes(id))
}
