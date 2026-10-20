import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CHAPTERS, type Chapter, type Quiz } from '../learn/chapters'
import { markRead, normalizeReadMarks, type ReadMarks } from '../learn/readProgress'

const LEARN_KEY = 'poker-gto:learn'

interface Saved {
  current: string
  read: ReadMarks
}

/** 読んでいた章と読了の印は端末のブラウザにだけ残す。消えても読み直せば済むので、読み書きの失敗は無視する */
function loadSaved(): Saved {
  const ids = CHAPTERS.map((c) => c.id)
  try {
    const saved = JSON.parse(localStorage.getItem(LEARN_KEY) ?? 'null')
    return {
      current: ids.includes(saved?.current) ? saved.current : ids[0],
      read: normalizeReadMarks(saved?.read, ids),
    }
  } catch {
    return { current: ids[0], read: [] }
  }
}

function save(saved: Saved) {
  try {
    localStorage.setItem(LEARN_KEY, JSON.stringify(saved))
  } catch {
    // 同上
  }
}

interface ReadingPage {
  id: string
  /** ページ送りの点に添える名前 */
  label: string
  content: ReactNode
}

/**
 * 章を「導入・各節・例題・確認問題・道具・まとめ」のページに分ける。
 * 長い1枚を縦にスクロールさせると、どこまで読んだかが分からず、道具も読み飛ばされやすいため
 */
function pagesOf(chapter: Chapter, index: number): ReadingPage[] {
  return [
    {
      id: 'intro',
      label: '導入',
      content: (
        <>
          <header className="reading-head">
            <span className="reading-number">
              第 {index + 1} 章 / {CHAPTERS.length}
            </span>
            <h1 className="reading-title">{chapter.title}</h1>
            <p className="reading-lead">{chapter.lead}</p>
          </header>
          <section className="reading-points" aria-label="この章で分かること">
            <h2>この章で分かること</h2>
            <ul>
              {chapter.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        </>
      ),
    },
    ...chapter.sections.map((section) => ({
      id: section.heading,
      label: section.heading,
      content: (
        <section className="reading-section">
          <h2>{section.heading}</h2>
          {section.body}
        </section>
      ),
    })),
    ...(chapter.example ? [{ id: 'example', label: '例題', content: <Example example={chapter.example} /> }] : []),
    {
      id: 'quiz',
      label: '確認問題',
      content: (
        <section className="reading-section">
          <h2>確認問題</h2>
          {chapter.quiz.map((quiz, i) => (
            <QuizCard key={i} quiz={quiz} />
          ))}
        </section>
      ),
    },
    ...(chapter.tools ?? []).map((tool, i, tools) => ({
      id: `tool-${i}`,
      label: '触って確かめる',
      content: (
        <section className="learn-tools">
          <h2>
            触って確かめる
            {tools.length > 1 && (
              <span className="muted num">
                {' '}
                {i + 1} / {tools.length}
              </span>
            )}
          </h2>
          <p className="muted">この章の数字を、自分で変えて試せます。</p>
          {tool}
        </section>
      ),
    })),
  ]
}

/** 考え方を章ごとにページ送りで読み、例題と確認問題で確かめ、その章の道具で数字を変えて試す */
export function LearnPage() {
  const [saved, setSaved] = useState(loadSaved)
  const [pageIndex, setPageIndex] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const index = Math.max(
    0,
    CHAPTERS.findIndex((c) => c.id === saved.current),
  )
  const chapter = CHAPTERS[index]
  const pages = pagesOf(chapter, index)
  const page = pages[Math.min(pageIndex, pages.length - 1)]
  const isLast = pageIndex >= pages.length - 1
  const nextChapter = CHAPTERS[index + 1]

  const update = (next: Saved) => {
    setSaved(next)
    save(next)
  }
  const open = (id: string) => {
    update({ ...saved, current: id })
    setPageIndex(0)
  }
  const finish = () => {
    update({ current: nextChapter?.id ?? chapter.id, read: markRead(saved.read, chapter.id) })
    setPageIndex(0)
  }
  const forward = () => (isLast ? finish() : setPageIndex(pageIndex + 1))
  const back = () => setPageIndex(Math.max(0, pageIndex - 1))

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [chapter.id, pageIndex])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // 教材を開いていないときや、計算ツールに数字を入れているときは、矢印キーをページ送りに使わない
      if (!bodyRef.current || bodyRef.current.offsetParent === null) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === 'ArrowRight') forward()
      if (event.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="learn-layout">
      <nav className="learn-toc" aria-label="教材の章">
        <div className="toc-progress">
          <span>
            読了 <strong className="num">{saved.read.length}</strong>
            <span className="muted"> / {CHAPTERS.length} 章</span>
          </span>
          <span className="progress-track">
            <span style={{ width: `${(saved.read.length / CHAPTERS.length) * 100}%` }} />
          </span>
        </div>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.id}>
              <button aria-current={c.id === chapter.id ? 'page' : undefined} onClick={() => open(c.id)}>
                <span className={`toc-number num ${saved.read.includes(c.id) ? 'read' : ''}`}>
                  {saved.read.includes(c.id) ? '✓' : i + 1}
                </span>
                <span className="toc-title">{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="reader">
        <div className="reader-body" ref={bodyRef}>
          <article className="reading" key={`${chapter.id}-${page.id}`}>
            {page.content}
            {isLast && (
              <p className="reading-sources">
                詳しくは元の記事:{' '}
                {chapter.sources.map((source, i) => (
                  <span key={source.url}>
                    {i > 0 && '、'}
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  </span>
                ))}
                （Amu 氏の note）
              </p>
            )}
          </article>
        </div>
        <footer className="reader-nav">
          <button className="btn" onClick={back} disabled={pageIndex === 0}>
            前へ <kbd className="action-key">←</kbd>
          </button>
          <ol className="page-dots" aria-label="この章のページ">
            {pages.map((p, i) => (
              <li key={p.id}>
                <button
                  aria-current={i === pageIndex ? 'step' : undefined}
                  className={i < pageIndex ? 'done' : ''}
                  title={p.label}
                  onClick={() => setPageIndex(i)}
                />
              </li>
            ))}
          </ol>
          <button className="btn primary" onClick={forward}>
            {isLast ? (nextChapter ? '読み終えて次の章へ' : '読み終えた') : '次へ'} <kbd className="action-key">→</kbd>
          </button>
        </footer>
      </div>
    </div>
  )
}

function Example({ example }: { example: NonNullable<Chapter['example']> }) {
  const [shown, setShown] = useState(false)
  return (
    <section className="reading-example">
      <h2>例題</h2>
      <p>{example.question}</p>
      {shown ? (
        <p className="example-answer">{example.answer}</p>
      ) : (
        <button className="btn" onClick={() => setShown(true)}>
          答えを見る
        </button>
      )}
    </section>
  )
}

function QuizCard({ quiz }: { quiz: Quiz }) {
  const [chosen, setChosen] = useState<number | null>(null)
  const answered = chosen !== null
  return (
    <div className="quiz">
      <p className="quiz-question">{quiz.question}</p>
      <div className="quiz-choices">
        {quiz.choices.map((choice, i) => (
          <button
            key={choice}
            className={`quiz-choice ${answered && i === quiz.answer ? 'correct' : ''} ${
              answered && i === chosen && i !== quiz.answer ? 'wrong' : ''
            }`}
            onClick={() => setChosen(i)}
            disabled={answered}
          >
            {choice}
          </button>
        ))}
      </div>
      {answered && (
        <div className={`quiz-result ${chosen === quiz.answer ? 'correct' : 'wrong'}`}>
          <strong>{chosen === quiz.answer ? '正解です' : `正解は「${quiz.choices[quiz.answer]}」`}</strong>
          <p>{quiz.why}</p>
          <button className="btn small-btn" onClick={() => setChosen(null)}>
            もう一度解く
          </button>
        </div>
      )}
    </div>
  )
}
