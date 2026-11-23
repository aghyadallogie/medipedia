import Image from 'next/image'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

import { pressable, sheen } from '@/components/motion'
import { SITE_NAME } from '@/lib/seo'

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base shadow-sm transition-colors duration-150 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900'

/** A labelled input. `hint` is help text shown under the field. */
export function Field({
  label,
  hint,
  id,
  ...props
}: ComponentProps<'input'> & { label: string; hint?: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className={inputClass}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 motion-safe:animate-spin motion-reduce:animate-pulse"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  )
}

export function SubmitButton({
  busy,
  children,
  busyLabel = 'Please wait…',
  tone = 'primary',
}: {
  busy: boolean
  children: ReactNode
  busyLabel?: string
  tone?: 'primary' | 'danger'
}) {
  const colours =
    tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : `bg-brand-600 hover:bg-brand-700 ${sheen}`
  return (
    <button
      type="submit"
      disabled={busy}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white disabled:opacity-60 sm:py-2.5 ${colours} ${pressable}`}
    >
      {busy ? <Spinner /> : null}
      {busy ? busyLabel : children}
    </button>
  )
}

export function SecondaryButton({ className = '', ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 sm:py-2.5 dark:border-slate-700 dark:hover:bg-slate-800 ${pressable} ${className}`}
      {...props}
    />
  )
}

/** Errors are announced to screen readers at once; notices are polite. */
export function Message({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info'
  children: ReactNode
}) {
  const colours = {
    error:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
    success:
      'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-100',
    info: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
  }[tone]
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2.5 text-sm animate-fade-in ${colours}`}
    >
      {children}
    </p>
  )
}

const PERKS = [
  'Lectures and papers with sources you can check',
  'Practice questions with an explanation for every choice',
  'Your accuracy by domain, so you know where to focus',
] as const

function Logo({ size, className = '' }: { size: number; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      priority
      className={`rounded-[22%] ${className}`}
    />
  )
}

/**
 * The auth pages: one card, split in two on wider screens. The left side is the brand (logo,
 * a line about what the site is, three reasons to sign up); the right side holds the form. On
 * phones the brand side collapses to the logo above the title.
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-12">
      <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-xl shadow-brand-950/10 backdrop-blur md:grid-cols-[5fr_6fr] dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/40">
        <aside
          className="relative hidden flex-col justify-between gap-10 overflow-hidden p-8 text-white md:flex lg:p-10"
          style={{
            backgroundColor: '#0a1b45',
            backgroundImage:
              'radial-gradient(28rem 20rem at 0% 0%, rgb(52 105 220 / 0.55), transparent 70%), radial-gradient(20rem 16rem at 100% 100%, rgb(232 169 42 / 0.16), transparent 70%), linear-gradient(160deg, #11307a, #0a1b45 60%, #06102e)',
          }}
        >
          {/* A fine dot grid, as on the page behind. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgb(255 255 255 / 0.14) 1px, transparent 1.3px)',
              backgroundSize: '24px 24px',
              maskImage: 'linear-gradient(to bottom, black, transparent 80%)',
            }}
          />
          <div className="relative space-y-6">
            <Link href="/" className="inline-flex items-center gap-3 text-lg font-semibold">
              <Logo size={48} className="shadow-lg shadow-black/30" />
              {SITE_NAME}
            </Link>
            <p className="text-2xl leading-snug font-semibold tracking-tight text-balance lg:text-[1.7rem]">
              Learn medicine from sources you can check.
            </p>
          </div>
          <ul className="relative space-y-3.5 text-sm text-blue-100/90">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-3">
                <svg
                  viewBox="0 0 20 20"
                  className="mt-0.5 size-5 shrink-0 text-accent-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="8" opacity="0.35" />
                  <path d="m6.5 10.2 2.4 2.4 4.6-4.9" />
                </svg>
                {perk}
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-6 p-6 sm:p-8 lg:p-10">
          <div className="space-y-3">
            <Link href="/" aria-label={`${SITE_NAME} home`} className="inline-block md:hidden">
              <Logo size={44} className="shadow-md shadow-brand-950/20" />
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {description ? (
              <p className="text-slate-600 dark:text-slate-300">{description}</p>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

/** A full-width link styled as a button. Navigates the whole page: the flow starts with a redirect. */
export function GoogleButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className={`flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 sm:py-2.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${pressable}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"
        />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
        <path
          fill="#EA4335"
          d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 7 8.9 4.8 12 4.8z"
        />
      </svg>
      {label}
    </a>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      or
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}

export const linkClass =
  'font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300'
