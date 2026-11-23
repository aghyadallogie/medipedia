'use client'

import { PASSWORD_MIN_LENGTH } from '@medipedia/shared'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { Field, linkClass, Message, SubmitButton } from '@/components/auth/ui'
import { authErrorMessage } from '@/lib/auth-errors'
import { notifyAuthChange, webApi } from '@/lib/web-api'

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await webApi().auth.forgotPassword({ email: String(form.get('email') ?? '').trim() })
      setSent(true)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 animate-fade-up">
        <Message tone="success">
          If that address has an account, we have sent a link to reset the password. It is valid for
          one hour.
        </Message>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <Link href="/sign-in" className={linkClass}>
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Message tone="error">{error}</Message> : null}
      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
      />
      <SubmitButton busy={busy} busyLabel="Sending…">
        Send reset link
      </SubmitButton>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <Link href="/sign-in" className={linkClass}>
          Back to sign in
        </Link>
      </p>
    </form>
  )
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="space-y-4">
        <Message tone="error">
          This link is incomplete. Use the link from the email, or ask for a new one.
        </Message>
        <Link href="/forgot-password" className={linkClass}>
          Send a new reset link
        </Link>
      </div>
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    if (password !== String(form.get('confirm') ?? '')) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await webApi().auth.resetPassword({ token: token as string, password })
      // Resetting signs the account out everywhere, this browser included.
      notifyAuthChange()
      router.replace('/sign-in?reset=1')
    } catch (caught) {
      setError(authErrorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Message tone="error">{error}</Message> : null}
      <Field
        id="password"
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        maxLength={128}
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
      />
      <Field
        id="confirm"
        name="confirm"
        label="Repeat the new password"
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton busy={busy} busyLabel="Saving…">
        Set new password
      </SubmitButton>
    </form>
  )
}
