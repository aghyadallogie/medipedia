'use client'

import { PASSWORD_MIN_LENGTH } from '@medipedia/shared'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import {
  Field,
  GoogleButton,
  linkClass,
  Message,
  OrDivider,
  SubmitButton,
} from '@/components/auth/ui'
import { authErrorMessage } from '@/lib/auth-errors'
import { webApi } from '@/lib/web-api'

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const name = String(form.get('name') ?? '').trim()
    setBusy(true)
    setError(null)
    try {
      await webApi().auth.register({
        email,
        password: String(form.get('password') ?? ''),
        ...(name ? { name } : {}),
      })
      setSentTo(email)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  // The same message whether or not the address already had an account: the page must not
  // reveal who is registered.
  if (sentTo) {
    return (
      <div className="space-y-4 animate-fade-up">
        <Message tone="success">
          Check <strong className="break-all">{sentTo}</strong> for a confirmation link. It can take
          a minute to arrive.
        </Message>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Once you have confirmed your address you can{' '}
          <Link href="/sign-in" className={linkClass}>
            sign in
          </Link>
          . If you already have an account, sign in or{' '}
          <Link href="/forgot-password" className={linkClass}>
            reset your password
          </Link>{' '}
          instead.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error ? <Message tone="error">{error}</Message> : null}

      {googleEnabled ? (
        <>
          <GoogleButton href="/api/v1/auth/google" label="Sign up with Google" />
          <OrDivider />
        </>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="name" name="name" label="Name (optional)" autoComplete="name" maxLength={80} />
        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
        <Field
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={128}
          required
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A few random words make a strong one.`}
        />
        <SubmitButton busy={busy} busyLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{' '}
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
