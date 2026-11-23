/**
 * Transactional email content. Plain, table-free HTML that renders everywhere, with the action
 * link also printed as text so it works when buttons are blocked. Links point at our own pages,
 * not at Payload's admin routes.
 */
import { publicEnv } from '@/env'

export const EMAIL_FROM_NAME = 'Medipedia'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

function link(path: string, token: string): string {
  const url = new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL)
  url.searchParams.set('token', token)
  return url.toString()
}

function layout(args: {
  heading: string
  paragraphs: string[]
  action?: { label: string; url: string }
}) {
  const paragraphs = args.paragraphs
    .map((text) => `<p style="margin:0 0 16px">${text}</p>`)
    .join('')
  const action = args.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(args.action.url)}" style="background:#1f4fc0;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(args.action.label)}</a></p>
<p style="margin:0 0 16px;color:#475569;font-size:14px">Or paste this link into your browser:<br><a href="${escapeHtml(args.action.url)}" style="color:#1f4fc0;word-break:break-all">${escapeHtml(args.action.url)}</a></p>`
    : ''
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.55">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(args.heading)}</h1>
${paragraphs}${action}
<p style="margin:24px 0 0;color:#64748b;font-size:13px">${EMAIL_FROM_NAME} is for education only and is not medical advice.</p>
</div>`
}

type EmailUser = { name?: unknown; _verified?: unknown }

const greeting = (user: EmailUser): string =>
  typeof user.name === 'string' && user.name.trim() !== ''
    ? `Hi ${escapeHtml(user.name.trim())},`
    : 'Hi,'

export function verifyEmailSubject(): string {
  return `Confirm your ${EMAIL_FROM_NAME} account`
}

/**
 * Payload sends this for every account it creates. Accounts that are already verified (the
 * first admin, or one an admin created) get a plain welcome instead of a pointless link.
 */
export function verifyEmailHtml(args: { token?: string | null; user: EmailUser }): string {
  if (!args.token || args.user._verified === true) {
    return layout({
      heading: `Welcome to ${EMAIL_FROM_NAME}`,
      paragraphs: [greeting(args.user), 'Your account is ready. You can sign in now.'],
    })
  }
  return layout({
    heading: 'Confirm your email address',
    paragraphs: [
      greeting(args.user),
      `Thanks for signing up for ${EMAIL_FROM_NAME}. Confirm your email address to finish creating your account.`,
      'The link works once. If you did not sign up, you can ignore this email.',
    ],
    action: { label: 'Confirm email address', url: link('/verify-email', args.token) },
  })
}

export function resetPasswordSubject(): string {
  return `Reset your ${EMAIL_FROM_NAME} password`
}

export function resetPasswordHtml(args: { token: string; user: EmailUser }): string {
  return layout({
    heading: 'Reset your password',
    paragraphs: [
      greeting(args.user),
      'Someone asked to reset the password for this account. Use the button below to choose a new one. The link expires in one hour and works once.',
      'If this was not you, ignore this email. Your password stays the same.',
    ],
    action: { label: 'Choose a new password', url: link('/reset-password', args.token) },
  })
}
