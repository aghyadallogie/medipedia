'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'

import { AUTH_CHANGE_EVENT, hasSessionHint } from '@/lib/web-api'

function subscribe(onChange: () => void) {
  window.addEventListener(AUTH_CHANGE_EVENT, onChange)
  // Another tab may have signed in or out.
  window.addEventListener('focus', onChange)
  window.addEventListener('pageshow', onChange)
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange)
    window.removeEventListener('focus', onChange)
    window.removeEventListener('pageshow', onChange)
  }
}

/**
 * "Sign in" or "Account" in the header. The page itself stays static and cacheable: whether
 * someone is signed in is read in the browser from a hint cookie (no request, no secret in it).
 * The server snapshot says "signed out", so there is no hydration mismatch.
 */
export function AuthNav() {
  const signedIn = useSyncExternalStore(subscribe, hasSessionHint, () => false)
  return (
    <Link
      href={signedIn ? '/account' : '/sign-in'}
      // /account redirects through the refresh endpoint when the session needs renewing, which
      // must not happen as a background prefetch.
      prefetch={false}
      className={
        signedIn
          ? 'rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
          : 'rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-700'
      }
    >
      {signedIn ? 'Account' : 'Sign in'}
    </Link>
  )
}
