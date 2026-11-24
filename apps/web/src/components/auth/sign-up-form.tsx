'use client'

import { PASSWORD_MIN_LENGTH } from '@medipedia/shared'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { notifyAuthChange, webApi } from '@/lib/web-api'

/** Where a new account lands once it is signed in (the same default as `proxy.ts`). */
const AFTER_SIGN_UP = '/account'

type Props = {
  googleEnabled: boolean
  /** False when the site does not email confirmation links: the new account is signed in at once. */
  confirmationRequired: boolean
}

export function SignUpForm({ googleEnabled, confirmationRequired }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const name = String(form.get('name') ?? '').trim()
    const password = String(form.get('password') ?? '')
    setBusy(true)
    setError(null)
    try {
      await webApi().auth.register({ email, password, ...(name ? { name } : {}) })
      if (confirmationRequired) {
        setSentTo(email)
        return
      }
      // No confirmation step: sign in with what was just entered. If that fails the address may
      // already have an account with another password (register answers the same either way),
      // so fall back to the same neutral message instead of saying which.
      try {
        await webApi().auth.login({ email, password })
        notifyAuthChange()
        router.replace(AFTER_SIGN_UP)
        router.refresh()
        return
      } catch {
        setSentTo(email)
      }
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  // The same message whether or not the address already had an account: the page must not
  // reveal who is registered.
  if (sentTo && !confirmationRequired) {
    return (
      <div className="space-y-4 animate-fade-up">
        <Message tone="success">
          Your account is ready. Sign in with the email and password you just used.
        </Message>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <Link href="/sign-in" className={linkClass}>
            Sign in
          </Link>
          . If you already have an account with this address, use its password or{' '}
          <Link href="/forgot-password" className={linkClass}>
            reset it
          </Link>
          .
        </p>
      </div>
    )
  }

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

      <p className="text-xs text-slate-500 dark:text-slate-400">
        By creating an account you agree to our{' '}
        <Link href="/terms" className={linkClass}>
          terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className={linkClass}>
          privacy policy
        </Link>
        .
      </p>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{' '}
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
