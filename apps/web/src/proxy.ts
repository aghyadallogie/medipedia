import { AUTH_COOKIES } from '@medipedia/shared'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/env'
import { safeReturnTo } from '@/server/auth/google'
import { verifyAccessToken } from '@/server/auth/tokens'

/** Pages for visitors who are not signed in. Someone who already is has no use for them. */
const GUEST_PAGES = new Set(['/sign-in', '/sign-up', '/forgot-password'])

/**
 * Pages anyone may open, signed in or not. Everything else on the site is for signed-in learners
 * (AGENTS.md §15, "Members only"): the home page that explains the site, the pages a visitor needs
 * to get an account or recover one (the guest pages above, plus the links in emails), and the
 * legal pages the sign-up form points to. A new page is members-only unless it is listed here.
 */
const PUBLIC_PAGES = new Set(['/', '/reset-password', '/verify-email', '/terms', '/privacy'])

/** Where a signed-in visitor goes instead of a guest page when nothing else was asked for. */
const HOME_WHEN_SIGNED_IN = '/account'

/**
 * Two jobs, both decided from the access token's signature (not the database; pages and API routes
 * still load the user themselves):
 *
 * - Members-only pages (every page not in `PUBLIC_PAGES` or `GUEST_PAGES`). A visitor whose access
 *   token is missing or expired (they last 15 minutes) but who still has the `signed_in` hint
 *   cookie is sent through the refresh endpoint, which renews the session and brings them straight
 *   back, or sends them to the sign-in page when there is nothing to renew. A visitor with no hint
 *   has no session to renew and goes straight to the sign-in page.
 * - Guest pages (`/sign-in`, `/sign-up`, `/forgot-password`). A signed-in visitor is sent on to the
 *   page they were heading for (`?next=`) or to their account.
 *
 * The refresh cookie is scoped to /api/v1/auth (AGENTS.md §5) and is therefore invisible here, so
 * this cannot refresh by itself: it only decides who needs to go through the endpoint.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl
  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next()

  const token = request.cookies.get(AUTH_COOKIES.access)?.value
  const signedIn = Boolean(token && (await verifyAccessToken(env.JWT_SECRET, token)))
  const hasHint = request.cookies.has(AUTH_COOKIES.hint)

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
    if (hasHint && !searchParams.has('next')) {
      url.pathname = '/api/v1/auth/refresh'
      url.search = new URLSearchParams({ next: HOME_WHEN_SIGNED_IN }).toString()
      return NextResponse.redirect(url, 307)
    }
    return NextResponse.next()
  }

  if (signedIn) return NextResponse.next()

  const next = pathname + search
  const url = request.nextUrl.clone()
  if (hasHint) {
    url.pathname = '/api/v1/auth/refresh'
    url.search = new URLSearchParams({ next }).toString()
  } else {
    url.pathname = '/sign-in'
    url.search = new URLSearchParams({ next }).toString()
  }
  return NextResponse.redirect(url, 307)
}

export const config = {
  // Every page. Not the APIs (each route checks its own access), the admin panel (Payload has its
  // own login), Next's internals, or files with an extension (icons, images, robots.txt,
  // sitemap.xml, the manifest). Which pages are open is decided in `PUBLIC_PAGES` above.
  matcher: ['/((?!api/|admin(?:/|$)|_next/|.*\\..*).*)'],
}
