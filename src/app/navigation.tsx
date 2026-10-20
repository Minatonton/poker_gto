import type { ReactNode } from 'react'

export type Page = 'preflop' | 'postflop' | 'calculators' | 'trainer' | 'drill' | 'review' | 'toys' | 'report'

const icon = (children: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    {children}
  </svg>
)

export const NAV: { page: Page; label: string; icon: ReactNode }[] = [
  {
    page: 'preflop',
    label: 'プリフロップ',
    icon: icon(
      <>
        <rect x="2.5" y="2.5" width="13" height="13" rx="1.5" />
        <path d="M2.5 7h13M2.5 11h13M7 2.5v13M11 2.5v13" />
      </>,
    ),
  },
  {
    page: 'postflop',
    label: 'ポストフロップ',
    icon: icon(
      <>
        <rect x="1.5" y="4" width="4.5" height="6.5" rx="1" />
        <rect x="6.75" y="4" width="4.5" height="6.5" rx="1" />
        <rect x="12" y="4" width="4.5" height="6.5" rx="1" />
        <path d="M3 14h12" />
      </>,
    ),
  },
  {
    page: 'report',
    label: '集合分析',
    icon: icon(
      <>
        <path d="M3 15V9M7 15V5M11 15V8M15 15V3" />
      </>,
    ),
  },
  {
    page: 'trainer',
    label: 'トレーナー',
    icon: icon(
      <>
        <circle cx="9" cy="9" r="6.5" />
        <circle cx="9" cy="9" r="3" />
        <path d="M9 1v3M9 14v3M1 9h3M14 9h3" />
      </>,
    ),
  },
  {
    page: 'drill',
    label: 'レンジ暗記',
    icon: icon(
      <>
        <path d="M3 15l3-1 8-8-2-2-8 8z" />
        <path d="M11 5l2 2" />
      </>,
    ),
  },
  {
    page: 'review',
    label: 'ハンドレビュー',
    icon: icon(
      <>
        <rect x="3" y="2" width="12" height="14" rx="1.5" />
        <path d="M6 6h6M6 9h6M6 12h3" />
      </>,
    ),
  },
  {
    page: 'toys',
    label: 'トイゲーム',
    icon: icon(
      <>
        <rect x="2.5" y="5" width="13" height="8" rx="4" />
        <path d="M6 8v2M5 9h2M12 8.5h0M13 10h0" />
      </>,
    ),
  },
  {
    page: 'calculators',
    label: '計算機',
    icon: icon(
      <>
        <rect x="3.5" y="2" width="11" height="14" rx="1.5" />
        <path d="M6 5h6M6 9h1M9 9h1M12 9h0M6 12h1M9 12h1" />
      </>,
    ),
  },
]
