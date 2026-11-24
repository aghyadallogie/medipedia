'use client'

import type { User } from '@medipedia/shared'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { Field, Message, SecondaryButton, Spinner, SubmitButton } from '@/components/auth/ui'
import { authErrorMessage } from '@/lib/auth-errors'
import { notifyAuthChange, webApi } from '@/lib/web-api'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-6 dark:border-slate-800">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function ProfileForm({ user }: { user: User }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
    setBusy(true)
    setMessage(null)
    try {
      await webApi().me.update({ name })
      setMessage({ tone: 'success', text: 'Saved.' })
      router.refresh()
    } catch (caught) {
      setMessage({ tone: 'error', text: authErrorMessage(caught) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message ? <Message tone={message.tone}>{message.text}</Message> : null}
      <Field
        id="name"
        name="name"
        label="Name"
        defaultValue={user.name ?? ''}
        autoComplete="name"
        maxLength={80}
        required
      />
      <div className="sm:max-w-40">
        <SubmitButton busy={busy} busyLabel="Saving…">
          Save
        </SubmitButton>
      </div>
    </form>
  )
}

function DeleteAccount({ user }: { user: User }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const needsPassword = user.provider === 'email'

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    setBusy(true)
    setError(null)
    try {
      await webApi().me.delete(needsPassword ? { password } : {})
      notifyAuthChange()
      router.replace('/')
      router.refresh()
    } catch (caught) {
      setError(authErrorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <Card title="Delete account">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        This permanently deletes your account, your question history and your sessions. It cannot be
        undone. Flashcard progress is stored in your browser and is not affected.
      </p>
      {open ? (
        <form onSubmit={onSubmit} className="space-y-4 animate-fade-up">
          {error ? <Message tone="error">{error}</Message> : null}
          {needsPassword ? (
            <Field
              id="delete-password"
              name="password"
              label="Enter your password to confirm"
              type="password"
              autoComplete="current-password"
              required
            />
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="sm:w-48">
              <SubmitButton busy={busy} busyLabel="Deleting…" tone="danger">
                Delete my account
              </SubmitButton>
            </div>
            <SecondaryButton onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </SecondaryButton>
          </div>
        </form>
      ) : (
        <SecondaryButton
          onClick={() => setOpen(true)}
          className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
        >
          Delete account
        </SecondaryButton>
      )}
    </Card>
  )
}

export function AccountPanel({
  user,
  showConfirmation = true,
}: {
  user: User
  /** False when the site does not ask for email confirmation, so "not confirmed" would mislead. */
  showConfirmation?: boolean
}) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      await webApi().auth.logout()
    } finally {
      notifyAuthChange()
      router.replace('/')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Profile">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-slate-500 dark:text-slate-400">Email</dt>
          <dd className="break-all font-medium">
            {user.email}{' '}
            {showConfirmation ? (
              <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                {user.emailVerified ? 'confirmed' : 'not confirmed'}
              </span>
            ) : null}
          </dd>
          <dt className="text-slate-500 dark:text-slate-400">Sign-in</dt>
          <dd className="font-medium">
            {user.provider === 'google' ? 'Google' : 'Email and password'}
          </dd>
        </dl>
        <ProfileForm user={user} />
      </Card>

      <Card title="Session">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Signing out ends the session on this device only.
        </p>
        <SecondaryButton onClick={signOut} disabled={signingOut}>
          {signingOut ? <Spinner /> : null}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </SecondaryButton>
      </Card>

      <DeleteAccount user={user} />
    </div>
  )
}
