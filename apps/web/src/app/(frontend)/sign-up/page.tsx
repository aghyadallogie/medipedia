import type { Metadata } from 'next'

import { SignUpForm } from '@/components/auth/sign-up-form'
import { AuthCard } from '@/components/auth/ui'
import { Container } from '@/components/site-chrome'
import { googleDeps } from '@/server/auth/google'

export const metadata: Metadata = {
  title: 'Create an account',
  robots: { index: false },
}

// Reads configuration at request time, so the page is rendered per request.
export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  return (
    <Container>
      <AuthCard
        title="Create an account"
        description="Free. Lectures, papers and videos stay open to everyone; an account unlocks the question bank."
      >
        <SignUpForm googleEnabled={googleDeps.getConfig() !== null} />
      </AuthCard>
    </Container>
  )
}
