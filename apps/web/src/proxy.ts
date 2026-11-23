import { AUTH_COOKIES } from '@medipedia/shared'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/env'
import { safeReturnTo } from '@/server/auth/google'
import { verifyAccessToken } from '@/server/auth/tokens'

/** Pages for visitors who are not signed in. Someone who already is has no use for them. */
const GUEST_PAGES = new Set(['/sign-in', '/sign-up', '/forgot-password'])

/** Where a signed-in visitor goes instead of a guest page when nothing else was asked for. */
const HOME_WHEN_SIGNED_IN = '/account'

/**
 * Two jobs, both decided from the access token's signature (not the database; pages and API routes
 * still load the user themselves):
 *
 * - Pages that need a signed-in user (`/account`). Visitors whose access token is missing or expired
 *   (they last 15 minutes) are sent through the refresh endpoint, which renews the session and
 *   brings them straight back, or sends them to the sign-in page when there is no session to renew.
 * - Guest pages (`/sign-in`, `/sign-up`, `/forgot-password`). A signed-in visitor is sent on to the
 *   page they were heading for (`?next=`) or to their account.
 *
 * The refresh cookie is scoped to /api/v1/auth (AGENTS.md §5) and is therefore invisible here, so
 * this cannot refresh by itself: it only decides who needs to go through the endpoint.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl
  const token = request.cookies.get(AUTH_COOKIES.access)?.value
  const signedIn = Boolean(token && (await verifyAccessToken(env.JWT_SECRET, token)))

  if (GUEST_PAGES.has(pathname)) {
    if (signedIn) {
      // `next` may carry a query string, and must not point back at a guest page (a redirect loop).
      let destination = safeReturnTo(searchParams.get('next'), HOME_WHEN_SIGNED_IN)
      const target = new URL(destination, request.url)
      if (GUEST_PAGES.has(target.pathname)) destination = HOME_WHEN_SIGNED_IN
      return NextResponse.redirect(new URL(destination, request.url), 307)
    }
    const url = request.nextUrl.clone()

    // The access token has expired but the browser still looks signed in (the hint cookie lives as
    // long as the refresh cookie): renew it, then come back here. A failed refresh lands on
    // /sign-in?next=..., and the missing `next` is what keeps this from looping, so a visit that
    // already carries one is left alone.
    if (request.cookies.has(AUTH_COOKIES.hint) && !searchParams.has('next')) {
      url.pathname = '/api/v1/auth/refresh'
      url.search = new URLSearchParams({ next: HOME_WHEN_SIGNED_IN }).toString()
      return NextResponse.redirect(url, 307)
    }
    return NextResponse.next()
  }

  if (signedIn) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/api/v1/auth/refresh'
  url.search = new URLSearchParams({ next: pathname + search }).toString()
  return NextResponse.redirect(url, 307)
}

export const config = {
  // Add the question bank and analytics pages here when they are built (Phase 5).
  matcher: ['/account/:path*', '/sign-in', '/sign-up', '/forgot-password'],
}
