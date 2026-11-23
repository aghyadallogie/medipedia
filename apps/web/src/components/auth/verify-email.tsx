'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { linkClass, Message, Spinner } from '@/components/auth/ui'
import { authErrorMessage } from '@/lib/auth-errors'
import { webApi } from '@/lib/web-api'

type State = { kind: 'working' } | { kind: 'done' } | { kind: 'failed'; message: string }

/**
 * Confirms the address as soon as the page opens. A token works once, so the request must not be
 * sent twice (React runs effects twice in development): `started` guards it.
 */
export function VerifyEmail({ token }: { token: string | null }) {
  const started = useRef(false)
  const [state, setState] = useState<State>(
    token ? { kind: 'working' } : { kind: 'failed', message: authErrorMessage(null) },
  )

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    webApi()
      .auth.verifyEmail(token)
      .then(
        () => setState({ kind: 'done' }),
        (error: unknown) => setState({ kind: 'failed', message: authErrorMessage(error) }),
      )
  }, [token])

  if (state.kind === 'working') {
    return (
      <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300" role="status">
        <Spinner /> Confirming your email address…
      </p>
    )
  }

  if (state.kind === 'done') {
    return (
      <div className="space-y-4 animate-fade-up">
        <Message tone="success">Your email address is confirmed. You can sign in now.</Message>
        <Link
          href="/sign-in"
          className="inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Message tone="error">
        {token ? state.message : 'This link is incomplete. Use the link from the email.'}
      </Message>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        If you already confirmed your address,{' '}
        <Link href="/sign-in" className={linkClass}>
          sign in
        </Link>
        . Otherwise sign up again with the same address and we will send a new link.
      </p>
    </div>
  )
}
