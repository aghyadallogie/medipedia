import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/components/auth/password-forms'
import { AuthCard } from '@/components/auth/ui'
import { Container } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false },
}

export default function ForgotPasswordPage() {
  return (
    <Container>
      <AuthCard
        title="Reset your password"
        description="Enter your email address and we will send you a link to choose a new password."
      >
        <ForgotPasswordForm />
      </AuthCard>
    </Container>
  )
}
