import type { VideoProvider } from './enums'

export type ParsedVideo = {
  provider: Exclude<VideoProvider, 'other'>
  /** The provider's own ID for the video. */
  videoId: string
  /** Canonical, privacy-friendly embed URL that is safe to put in an iframe `src`. */
  embedUrl: string
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])
const YOUTUBE_SHORT_HOST = 'youtu.be'
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_PATH_PREFIXES = new Set(['embed', 'shorts', 'live', 'v'])

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])
const VIMEO_ID = /^\d{1,12}$/
const VIMEO_HASH = /^[A-Za-z0-9]{6,20}$/

function parseYouTube(url: URL): ParsedVideo | null {
  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)
  let id: string | undefined

  if (host === YOUTUBE_SHORT_HOST) {
    id = segments[0]
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === 'watch') {
      id = url.searchParams.get('v') ?? undefined
    } else if (segments[0] !== undefined && YOUTUBE_PATH_PREFIXES.has(segments[0])) {
      id = segments[1]
    }
  } else {
    return null
  }

  if (id === undefined || !YOUTUBE_ID.test(id)) return null
  return {
    provider: 'youtube',
    videoId: id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  }
}

function parseVimeo(url: URL): ParsedVideo | null {
  if (!VIMEO_HOSTS.has(url.hostname.toLowerCase())) return null
  const segments = url.pathname.split('/').filter(Boolean)
  const isPlayer = url.hostname.toLowerCase() === 'player.vimeo.com'

  let id: string | undefined
  let hash: string | undefined
  if (isPlayer) {
    if (segments[0] !== 'video') return null
    id = segments[1]
    hash = url.searchParams.get('h') ?? undefined
  } else {
    // vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (unlisted), vimeo.com/channels/x/123456789
    const numeric = segments.findIndex((segment) => VIMEO_ID.test(segment))
    if (numeric === -1) return null
    id = segments[numeric]
    hash = segments[numeric + 1]
  }

  if (id === undefined || !VIMEO_ID.test(id)) return null
  const query = hash !== undefined && VIMEO_HASH.test(hash) ? `?h=${hash}` : ''
  return {
    provider: 'vimeo',
    videoId: id,
    embedUrl: `https://player.vimeo.com/video/${id}${query}`,
  }
}

/**
 * Accepts the common YouTube and Vimeo URL shapes and returns the canonical embed URL.
 * Returns null for anything else, including other hosts, so only vetted providers are embedded.
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username !== '' || url.password !== '') return null
  return parseYouTube(url) ?? parseVimeo(url)
}

/** YouTube serves thumbnails for any video. Vimeo needs an API call, so it has no derived thumbnail. */
export function providerThumbnailUrl(provider: VideoProvider, videoId: string): string | null {
  return provider === 'youtube' ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null
}
