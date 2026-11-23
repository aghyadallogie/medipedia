import Link from 'next/link'
import type { ReactNode } from 'react'

import { SITE_NAME } from '@/lib/seo'

const NAV = [
  { href: '/lectures', label: 'Lectures' },
  { href: '/papers', label: 'Papers' },
  { href: '/videos', label: 'Videos' },
  { href: '/domains', label: 'Domains' },
] as const

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-md bg-brand-600 text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
          {SITE_NAME}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
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
  return <div className={`mx-auto max-w-5xl px-4 ${className}`}>{children}</div>
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
    <div className="space-y-2 pb-8 pt-10">
      {eyebrow ? (
        <p className="text-sm font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">{description}</p>
      ) : null}
    </div>
  )
}

export function Breadcrumbs({ items }: { items: ReadonlyArray<{ name: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="pt-6 text-sm text-slate-500 dark:text-slate-400">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-slate-900 hover:underline dark:hover:text-white"
              >
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-slate-700 dark:text-slate-200">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
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
    <section className="space-y-4 pt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {href ? (
          <Link href={href} className="text-sm text-brand-700 hover:underline dark:text-brand-300">
            View all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  )
}
