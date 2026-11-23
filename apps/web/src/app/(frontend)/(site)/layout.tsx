import type { ReactNode } from 'react'

import { SiteFooter, SiteHeader } from '@/components/site-chrome'

/** The public site: header, page, footer. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#content"
        className="sr-only rounded-md bg-white px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 dark:bg-slate-900"
      >
        Skip to content
      </a>
      <SiteHeader />
      {/* flex-1 takes the leftover height, so the footer sits at the bottom on short pages. */}
      <main id="content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
