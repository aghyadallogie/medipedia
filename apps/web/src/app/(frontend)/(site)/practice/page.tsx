import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { Practice } from '@/components/practice/practice'
import { Container, PageHeading } from '@/components/site-chrome'
import { buildPracticeOptions } from '@/lib/practice'
import { authenticateHeaders } from '@/server/auth/session'
import { getQuestionStats, listDomains } from '@/server/public-queries'

export const metadata: Metadata = {
  title: 'Practice questions',
  // Questions need a signed-in reader, so there is nothing here for a search engine.
  robots: { index: false },
}

export default async function PracticePage() {
  // proxy.ts has already renewed an expired session. If there is still no user here, the session
  // is gone (signed out elsewhere, or the account was deleted).
  const user = await authenticateHeaders(await headers())
  if (!user) redirect('/sign-in?next=/practice')

  const [domains, stats] = await Promise.all([listDomains(), getQuestionStats()])

  return (
    <Container>
      <PageHeading
        eyebrow="Practice"
        title="Practice questions"
        description="Exam-style vignettes. Answer one, then read why every choice is right or wrong."
      />
      <Practice options={buildPracticeOptions(domains, stats)} />
    </Container>
  )
}
