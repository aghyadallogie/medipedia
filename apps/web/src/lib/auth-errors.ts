import { ApiClientError } from '@medipedia/api-client'

const REASONS: Record<string, string> = {
  invalid_credentials: 'The email or password is not right.',
  email_not_verified: 'Confirm your email address first. We sent you a link when you signed up.',
  account_locked: 'Too many failed attempts. Wait a few minutes, or reset your password.',
  invalid_token: 'This link is invalid, has expired, or has already been used.',
  token_reused: 'Your session ended for security reasons. Sign in again.',
}

/** Turns anything thrown by the API client into a sentence for a form. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const reason = (error.details as { reason?: unknown } | undefined)?.reason
    if (typeof reason === 'string' && reason in REASONS) return REASONS[reason]!
    if (error.code === 'network_error') return 'Could not reach the server. Check your connection.'
    if (error.code === 'rate_limited') return 'Too many attempts. Wait a moment and try again.'
    if (error.code === 'validation_error') return 'Check the details you entered and try again.'
  }
  return 'Something went wrong. Try again.'
}

/** Messages for `/sign-in?error=...`, set by the Google callback. */
export const GOOGLE_ERRORS: Record<string, string> = {
  google: 'Google sign-in did not complete. Try again, or use your email and password.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_unavailable: 'Sign in with Google is not available right now.',
}
