import { createApiClient, type ApiClient } from '@medipedia/api-client'
import { AUTH_COOKIES } from '@medipedia/shared'

/** Browser only. Fires after signing in or out so the header can update without a reload. */
export const AUTH_CHANGE_EVENT = 'medipedia:auth-change'

let client: ApiClient | undefined

/**
 * The typed API client for client components. Tokens live in httpOnly cookies, so there is
 * nothing to configure: cookies go along with same-origin requests, and when an access token has
 * expired the client renews the session once (shared between concurrent requests) and retries.
 */
export function webApi(): ApiClient {
  client ??= createApiClient({
    baseUrl: window.location.origin,
    refresh: () =>
      client!.auth.refresh().then(
        () => true,
        () => false,
      ),
  })
  return client
}

export function notifyAuthChange(): void {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

/** Whether this browser has a login, judged by the non-secret hint cookie. */
export function hasSessionHint(): boolean {
  return document.cookie.split('; ').includes(`${AUTH_COOKIES.hint}=1`)
}
