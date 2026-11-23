import type { Metadata } from 'next'

import { ResetPasswordForm } from '@/components/auth/password-forms'
import { AuthCard } from '@/components/auth/ui'
import { Container } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Choose a new password',
  // The link carries a secret token: keep it out of search results and out of Referer headers.
  robots: { index: false },
  referrer: 'no-referrer',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams
  return (
    <Container>
      <AuthCard title="Choose a new password">
        <ResetPasswordForm token={typeof token === 'string' && token !== '' ? token : null} />
      </AuthCard>
    </Container>
  )
}
