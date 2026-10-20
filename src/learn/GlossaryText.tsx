import { GLOSSARY, GLOSSARY_PATTERN } from './glossary'

/** 文の中の用語に説明を添えて表示する。split に括弧付きの正規表現を渡すと、奇数番目に用語が入る */
export function GlossaryText({ text }: { text: string }) {
  return (
    <>
      {text.split(GLOSSARY_PATTERN).map((part, i) =>
        i % 2 === 1 ? (
          <abbr key={i} className="term" title={GLOSSARY[part]}>
            {part}
          </abbr>
        ) : (
          part
        ),
      )}
    </>
  )
}
