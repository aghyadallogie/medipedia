import type { ReactNode } from 'react'

import { Container, PageHeading } from '@/components/site-chrome'
import { publicEnv } from '@/env'

/** Shared frame for the Terms and Privacy pages. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string
  /** When the text last changed, as a readable date. Bump it with every edit to the wording. */
  updated: string
  intro: string
  children: ReactNode
}) {
  return (
    <Container>
      <PageHeading eyebrow="Legal" title={title} description={intro} />
      <div className="max-w-2xl space-y-8 pb-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Last updated {updated}</p>
        {children}
      </div>
    </Container>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 text-slate-700 dark:text-slate-300">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>
}

/** The address for privacy requests, or an honest note when none has been configured yet. */
export function ContactAddress() {
  const email = publicEnv.NEXT_PUBLIC_CONTACT_EMAIL
  return email ? (
    <a
      href={`mailto:${email}`}
      className="text-brand-700 underline underline-offset-2 dark:text-brand-300"
    >
      {email}
    </a>
  ) : (
    <span>the contact address for this site (not published yet)</span>
  )
}
