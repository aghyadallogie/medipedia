'use client'

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
 * Whether this browser looks signed in, read from the non-secret hint cookie. Pages stay static
 * and cacheable because nothing is asked of the server. The server snapshot says "signed out",
 * so there is no hydration mismatch; a signed-in browser flips right after hydration.
 *
 * It is a display hint only. `proxy.ts` and the API decide who may see or do anything.
 */
export function useSignedInHint(): boolean {
  return useSyncExternalStore(subscribe, hasSessionHint, () => false)
}
