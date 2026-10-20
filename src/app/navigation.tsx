import type { ReactNode } from 'react'

export type Page = 'preflop' | 'postflop' | 'calculators'

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
