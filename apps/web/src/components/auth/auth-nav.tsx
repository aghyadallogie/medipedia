'use client'

import Link from 'next/link'

import { useSignedInHint } from '@/lib/use-signed-in'

/**
 * "Sign in" or "Account" in the header. The page itself stays static and cacheable: whether
 * someone is signed in is read in the browser from a hint cookie (no request, no secret in it).
 */
export function AuthNav() {
  const signedIn = useSignedInHint()
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
