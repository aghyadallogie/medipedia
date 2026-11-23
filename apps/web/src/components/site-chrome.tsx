import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { AuthNav } from '@/components/auth/auth-nav'
import { MobileNav } from '@/components/mobile-nav'
import { SITE_NAME } from '@/lib/seo'

const NAV = [
  { href: '/lectures', label: 'Lectures' },
  { href: '/flashcards', label: 'Flashcards' },
  { href: '/papers', label: 'Papers' },
  { href: '/videos', label: 'Videos' },
  { href: '/domains', label: 'Domains' },
] as const

export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2 font-semibold tracking-tight">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="logo-mark size-8 rounded-lg"
          />
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <AuthNav />
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 sm:mt-20 dark:border-slate-800">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-6 text-sm text-slate-500 sm:py-8 dark:text-slate-400">
        <p>
          <strong className="font-semibold text-slate-700 dark:text-slate-200">
            For education only.
          </strong>{' '}
          {SITE_NAME} is not medical advice and must not be used to diagnose or treat patients.
          Always follow current clinical guidelines and your institution&apos;s protocols.
        </p>
        <p>
          © {new Date().getUTCFullYear()} {SITE_NAME}
        </p>
      </div>
    </footer>
  )
}

export function Container({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  // Every page is wrapped in a Container, and a navigation mounts a new one, so this is the one
  // place that gives pages their transition (see "Page transitions" in globals.css).
  return <div className={`mx-auto max-w-5xl px-4 animate-page-in ${className}`}>{children}</div>
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: string | null
}) {
  return (
    <div className="space-y-2 pb-6 pt-8 sm:pb-8 sm:pt-10">
      {eyebrow ? (
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight text-balance break-words sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
          {description}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Title of a detail page (lecture, paper, video). Titles can be long, so it is smaller on
 * phones than a list-page heading, and long words may wrap instead of overflowing.
 */
export function DetailTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-2xl font-semibold tracking-tight text-balance break-words sm:text-3xl lg:text-4xl">
      {children}
    </h1>
  )
}

export function Breadcrumbs({ items }: { items: ReadonlyArray<{ name: string; href?: string }> }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="pt-4 text-sm text-slate-500 sm:pt-6 dark:text-slate-400"
    >
      {/* One line always: earlier crumbs keep their size and the current page truncates. */}
      <ol className="flex items-center gap-1.5 whitespace-nowrap">
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li
              key={item.name}
              className={`flex items-center gap-1.5 ${current ? 'min-w-0' : 'shrink-0'}`}
            >
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="py-1 transition-colors duration-150 hover:text-slate-900 hover:underline dark:hover:text-white"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  aria-current="page"
                  title={item.name}
                  className="truncate py-1 text-slate-700 dark:text-slate-200"
                >
                  {item.name}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center animate-fade-in sm:p-10 dark:border-slate-700">
      <p className="font-medium">{title}</p>
      {children ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{children}</p>
      ) : null}
    </div>
  )
}

export function Section({
  title,
  href,
  children,
}: {
  title: string
  href?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4 pt-8 sm:pt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="group inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            View all
            <span
              aria-hidden="true"
              className="transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  )
}
