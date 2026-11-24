import type { Metadata } from 'next'

import { SignInForm } from '@/components/auth/sign-in-form'
import { AuthCard } from '@/components/auth/ui'
import { Container } from '@/components/site-chrome'
import { GOOGLE_ERRORS } from '@/lib/auth-errors'
import { googleDeps, safeReturnTo } from '@/server/auth/google'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const errorKey = first(params.error)
  const notice =
    first(params.reset) === '1'
      ? 'Your password was changed. Sign in with the new one.'
      : first(params.verified) === '1'
        ? 'Your email address is confirmed. Sign in to continue.'
        : undefined

  return (
    <Container>
      <AuthCard title="Sign in" description="Sign in to pick up where you left off.">
        <SignInForm
          next={safeReturnTo(first(params.next))}
          googleEnabled={googleDeps.getConfig() !== null}
          error={errorKey ? GOOGLE_ERRORS[errorKey] : undefined}
          notice={notice}
        />
      </AuthCard>
    </Container>
  )
}
