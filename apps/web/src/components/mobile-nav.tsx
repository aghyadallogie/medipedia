'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type Item = { href: string; label: string }

/**
 * The main navigation below the `sm` breakpoint: a menu button and a drop-down panel with
 * large tap targets. Rendered inside the sticky header, which is its positioning context.
 */
export function MobileNav({ items }: { items: readonly Item[] }) {
  const pathname = usePathname()
  // Remember which page the menu was opened on. Navigating elsewhere then closes it by itself,
  // without an effect that sets state.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const close = () => setOpenOn(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenOn(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpenOn(open ? null : pathname)}
        className="-mr-2 grid size-11 place-items-center rounded-md text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open ? (
        <>
          {/* Tap anywhere outside the menu to close it. Sized to end at the viewport bottom. */}
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={close}
            className="absolute inset-x-0 top-full h-[calc(100dvh-3.5rem)] cursor-default bg-black/40"
          />
          <nav
            id="mobile-menu"
            aria-label="Main"
            className="absolute inset-x-0 top-full border-b border-slate-200 bg-white px-2 py-2 shadow-lg dark:border-slate-800 dark:bg-slate-950"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="flex min-h-12 items-center rounded-md px-3 text-base font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      ) : null}
    </div>
  )
}
