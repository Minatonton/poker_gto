import { useState } from 'react'
import { CHAPTERS, type Chapter, type Quiz } from '../learn/chapters'
import { markRead, normalizeReadMarks, unmarkRead, type ReadMarks } from '../learn/readProgress'

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

/** 考え方を章ごとに読み、例題と確認問題で確かめ、その章の道具で数字を変えて試す */
export function LearnPage() {
  const [saved, setSaved] = useState(loadSaved)
  const index = Math.max(
    0,
    CHAPTERS.findIndex((c) => c.id === saved.current),
  )
  const chapter = CHAPTERS[index]
  const isRead = saved.read.includes(chapter.id)

  const update = (next: Saved) => {
    setSaved(next)
    save(next)
  }
  const open = (id: string) => {
    update({ ...saved, current: id })
    window.scrollTo({ top: 0 })
  }
  const finish = () => {
    const read = markRead(saved.read, chapter.id)
    const next = CHAPTERS[index + 1]
    update({ current: next?.id ?? chapter.id, read })
    if (next) window.scrollTo({ top: 0 })
  }

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

      <div className="learn-main">
        <article className="reading" key={chapter.id}>
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

          {chapter.sections.map((section) => (
            <section key={section.heading} className="reading-section">
              <h2>{section.heading}</h2>
              {section.body}
            </section>
          ))}

          {chapter.example && <Example example={chapter.example} />}

          <section className="reading-section">
            <h2>確認問題</h2>
            {chapter.quiz.map((quiz, i) => (
              <QuizCard key={i} quiz={quiz} />
            ))}
          </section>
        </article>

        {chapter.tools && (
          <section className="learn-tools">
            <h2>触って確かめる</h2>
            <p className="muted">この章の数字を、自分で変えて試せます。</p>
            <div className="calc-grid">{chapter.tools}</div>
          </section>
        )}
        <div className="reading reading-end">
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

          <ChapterFooter
            prev={CHAPTERS[index - 1]}
            next={CHAPTERS[index + 1]}
            isRead={isRead}
            onOpen={open}
            onFinish={finish}
            onUnread={() => update({ ...saved, read: unmarkRead(saved.read, chapter.id) })}
          />
        </div>
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

function ChapterFooter({
  prev,
  next,
  isRead,
  onOpen,
  onFinish,
  onUnread,
}: {
  prev?: Chapter
  next?: Chapter
  isRead: boolean
  onOpen: (id: string) => void
  onFinish: () => void
  onUnread: () => void
}) {
  return (
    <footer className="reading-footer">
      {isRead ? (
        <p className="reading-done">
          この章は読了済みです。
          <button className="link-button" onClick={onUnread}>
            未読に戻す
          </button>
        </p>
      ) : (
        <button className="btn primary reading-finish" onClick={onFinish}>
          {next ? `読み終えて次の章へ（${next.title}）` : '読み終えた'}
        </button>
      )}
      <div className="reading-nav">
        {prev ? (
          <button className="btn" onClick={() => onOpen(prev.id)}>
            前の章: {prev.title}
          </button>
        ) : (
          <span />
        )}
        {next && isRead && (
          <button className="btn" onClick={() => onOpen(next.id)}>
            次の章: {next.title}
          </button>
        )}
      </div>
    </footer>
  )
}
