import { getPayload } from 'payload'

import config from '@/payload.config'

/** The shared Payload instance for server code (route handlers, server components). */
export const getClient = () => getPayload({ config })
