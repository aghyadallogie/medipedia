'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import {
  OrDivider,
  Field,
  GoogleButton,
  linkClass,
  Message,
  SubmitButton,
} from '@/components/auth/ui'
import { authErrorMessage } from '@/lib/auth-errors'
import { notifyAuthChange, webApi } from '@/lib/web-api'

type Props = {
  /** A path on this site, already checked by the page. */
  next: string
  googleEnabled: boolean
  /** From `?error=` after a failed Google sign-in, or a notice such as "email confirmed". */
  error?: string
  notice?: string
}

export function SignInForm({ next, googleEnabled, error: initialError, notice }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await webApi().auth.login({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      notifyAuthChange()
      router.replace(next)
      router.refresh()
    } catch (caught) {
      setError(authErrorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {notice ? <Message tone="success">{notice}</Message> : null}
      {error ? <Message tone="error">{error}</Message> : null}

      {googleEnabled ? (
        <>
          <GoogleButton
            href={`/api/v1/auth/google?returnTo=${encodeURIComponent(next)}`}
            label="Continue with Google"
          />
          <OrDivider />
        </>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
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
          autoComplete="current-password"
          required
        />
        <SubmitButton busy={busy} busyLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
        <Link href="/forgot-password" className={linkClass}>
          Forgot your password?
        </Link>
        <span>
          New here?{' '}
          <Link href="/sign-up" className={linkClass}>
            Create an account
          </Link>
        </span>
      </div>
    </div>
  )
}
