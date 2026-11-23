import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { AccountPanel } from '@/components/auth/account-panel'
import { Container, PageHeading } from '@/components/site-chrome'
import { toUserDto } from '@/server/auth/http'
import { authenticateHeaders } from '@/server/auth/session'

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false },
}

export default async function AccountPage() {
  // proxy.ts has already renewed an expired session. If there is still no user here, the session
  // is gone (signed out elsewhere, or the account was deleted).
  const user = await authenticateHeaders(await headers())
  if (!user) redirect('/sign-in?next=/account')

  return (
    <Container>
      <div className="max-w-2xl">
        <PageHeading eyebrow="Account" title={user.name ?? 'Your account'} />
        <AccountPanel user={toUserDto(user)} />
      </div>
    </Container>
  )
}
