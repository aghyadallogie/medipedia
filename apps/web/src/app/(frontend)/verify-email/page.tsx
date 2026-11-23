import type { Metadata } from 'next'

import { VerifyEmail } from '@/components/auth/verify-email'
import { AuthCard } from '@/components/auth/ui'
import { Container } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false },
  referrer: 'no-referrer',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams
  return (
    <Container>
      <AuthCard title="Confirm your email">
        <VerifyEmail token={typeof token === 'string' && token !== '' ? token : null} />
      </AuthCard>
    </Container>
  )
}
