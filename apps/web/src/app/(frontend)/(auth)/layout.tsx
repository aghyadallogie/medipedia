import type { ReactNode } from 'react'

import { SiteFooter } from '@/components/site-chrome'

/**
 * Sign-in and sign-up. No navigation bar: the page is a focused card, and its logo links home.
 * The footer stays, because it carries the medical disclaimer.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main id="content" className="flex flex-1 flex-col justify-center">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
