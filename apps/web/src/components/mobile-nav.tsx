'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { NavItem } from '@/components/main-nav'
import { useSignedInHint } from '@/lib/use-signed-in'

/** Longer than the exit animation. Only used if `animationend` never fires. */
const EXIT_FALLBACK_MS = 400

/**
 * The main navigation below the `sm` breakpoint: a menu button and a drop-down panel with
 * large tap targets. Rendered inside the sticky header, which is its positioning context.
 *
 * The panel animates in and out. React would remove it instantly, so it stays mounted
 * (`rendered`) while its exit animation plays and is removed when that animation ends.
 */
export function MobileNav({ items }: { items: readonly NavItem[] }) {
  const signedIn = useSignedInHint()
  const pathname = usePathname()
  // Remember which page the menu was opened on. Navigating elsewhere then closes it by itself,
  // without an effect that sets state.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  // In the DOM: while open, and while the exit animation plays.
  const [rendered, setRendered] = useState(false)
  const closing = rendered && !open

  const close = () => setOpenOn(null)
  const toggle = () => {
    if (open) {
      close()
    } else {
      setOpenOn(pathname)
      setRendered(true)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenOn(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // If the exit animation is skipped or interrupted, still remove the panel.
  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(() => setRendered(false), EXIT_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [closing])

  // Everything in the menu is for signed-in learners (see MainNav).
  if (!signedIn) return null

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={toggle}
        className="-mr-2 grid size-11 place-items-center rounded-md text-slate-700 transition-colors duration-150 hover:bg-slate-100 motion-safe:active:scale-90 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <svg
          // A new key restarts the animation, so the icon spins in each time it switches.
          key={open ? 'close' : 'menu'}
          viewBox="0 0 24 24"
          className="size-6 animate-icon-in"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {rendered ? (
        <>
          {/* Tap anywhere outside the menu to close it. Sized to end at the viewport bottom. */}
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={close}
            className={`absolute inset-x-0 top-full h-[calc(100dvh-3.5rem)] cursor-default bg-black/40 ${
              open ? 'animate-fade-in' : 'pointer-events-none animate-fade-out'
            }`}
          />
          <nav
            id="mobile-menu"
            aria-label="Main"
            onAnimationEnd={(event) => {
              if (closing && event.target === event.currentTarget) setRendered(false)
            }}
            className={`absolute inset-x-0 top-full border-b border-slate-200 bg-white px-2 py-2 shadow-lg dark:border-slate-800 dark:bg-slate-950 ${
              open ? 'animate-menu-in' : 'animate-menu-out'
            }`}
          >
            {items.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={close}
                // The links rise in one after another while the panel opens.
                style={open ? { animationDelay: `${60 + index * 45}ms` } : undefined}
                className={`flex min-h-12 items-center rounded-md px-3 text-base font-medium text-slate-800 transition-colors duration-150 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-700 ${
                  open ? 'animate-fade-up' : ''
                }`}
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
