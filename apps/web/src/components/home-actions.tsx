'use client'

import Link from 'next/link'

import { pressable, sheen } from '@/components/motion'
import { useSignedInHint } from '@/lib/use-signed-in'

const primary = `rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 sm:py-2.5 ${pressable} ${sheen}`
const secondary = `rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 sm:py-2.5 dark:border-slate-700 dark:hover:bg-slate-800 ${pressable}`

/**
 * The buttons under the headline. A visitor is asked to join; a learner who is already signed in
 * is sent into the site. Read from the hint cookie so the home page stays static.
 */
export function HomeActions() {
  const signedIn = useSignedInHint()
  return (
    <div className="flex flex-wrap gap-3">
      {signedIn ? (
        <>
          <Link href="/lectures" prefetch={false} className={primary}>
            Browse lectures
          </Link>
          <Link href="/practice" prefetch={false} className={secondary}>
            Practice questions
          </Link>
        </>
      ) : (
        <>
          <Link href="/sign-up" className={primary}>
            Create a free account
          </Link>
          <Link href="/sign-in" className={secondary}>
            Sign in
          </Link>
        </>
      )}
    </div>
  )
}
