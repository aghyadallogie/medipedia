import type { ApiErrorCode } from '@medipedia/shared'

/** `network_error`: no response at all. `invalid_response`: a response we cannot trust or read. */
export type ApiClientErrorCode = ApiErrorCode | 'network_error' | 'invalid_response'

export class ApiClientError extends Error {
  readonly code: ApiClientErrorCode
  /** HTTP status, or 0 when there was no response. */
  readonly status: number
  readonly details?: unknown

  constructor(args: {
    code: ApiClientErrorCode
    message: string
    status: number
    details?: unknown
    cause?: unknown
  }) {
    super(args.message, args.cause === undefined ? undefined : { cause: args.cause })
    this.name = 'ApiClientError'
    this.code = args.code
    this.status = args.status
    this.details = args.details
  }

  get isNotFound(): boolean {
    return this.code === 'not_found'
  }
}
