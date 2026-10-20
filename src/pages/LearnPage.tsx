import { useState } from 'react'
import { CHAPTERS } from '../learn/chapters'

/** 考え方を章ごとに読み、その章の道具で数字を変えて確かめる */
export function LearnPage() {
  const [chapterId, setChapterId] = useState(CHAPTERS[0].id)
  const chapter = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0]

  return (
    <div className="learn-layout">
      <nav className="card learn-toc" aria-label="教材の章">
        <ol>
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <button aria-current={c.id === chapterId ? 'page' : undefined} onClick={() => setChapterId(c.id)}>
                <span className="toc-title">{c.title}</span>
                <span className="toc-lead">{c.lead}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <article className="learn-article">
        <section className="card">
          <header className="card-header">
            <h2 className="chapter-title">{chapter.title}</h2>
          </header>
          <div className="card-body chapter-body">{chapter.body}</div>
          <footer className="chapter-sources">
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
          </footer>
        </section>
        {chapter.tools && (
          <>
            <h3 className="tools-heading">触って確かめる</h3>
            <div className="calc-grid">{chapter.tools}</div>
          </>
        )}
      </article>
    </div>
  )
}
