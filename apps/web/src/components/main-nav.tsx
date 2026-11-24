'use client'

import Link from 'next/link'

import { useSignedInHint } from '@/lib/use-signed-in'

export type NavItem = { href: string; label: string }

/**
 * The main navigation on wider screens. Every page behind it is for signed-in learners, so
 * a visitor who is not signed in sees none of it, only "Sign in" in the header.
 */
export function MainNav({ items }: { items: readonly NavItem[] }) {
  if (!useSignedInHint()) return null
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 text-sm sm:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          // These pages redirect through the refresh endpoint when the session needs renewing,
          // which must not happen as a background prefetch.
          prefetch={false}
          className="nav-link rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
