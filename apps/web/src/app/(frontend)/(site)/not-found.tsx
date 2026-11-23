import Link from 'next/link'

import { Container } from '@/components/site-chrome'

export default function NotFound() {
  return (
    <Container className="space-y-4 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="text-slate-600 dark:text-slate-300">
        It may have moved, or it may not be published yet.
      </p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to the home page
      </Link>
    </Container>
  )
}
