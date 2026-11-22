import { describe, expect, it } from 'vitest'

import { isHttpUrl, isValidDoi, normalizeDoi } from '../url'
import { isValidSlug, slugify } from '../slug'
import { parseVideoUrl, providerThumbnailUrl } from '../video'

describe('slugify', () => {
  it.each([
    ['Acute Coronary Syndromes', 'acute-coronary-syndromes'],
    ['  Cardiology & Vascular  ', 'cardiology-and-vascular'],
    ['Crème brûlée', 'creme-brulee'],
    ['Type 2 diabetes: first-line therapy', 'type-2-diabetes-first-line-therapy'],
    ['---', ''],
    ['日本語', ''],
  ])('%j -> %j', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('caps length without leaving a trailing hyphen', () => {
    const slug = slugify(`${'word '.repeat(40)}end`)
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
    expect(isValidSlug(slug)).toBe(true)
  })

  it('always produces a valid slug when it produces anything', () => {
    for (const input of ['A', 'a b', 'X--Y', 'foo_bar', 'Ünïcödé']) {
      const slug = slugify(input)
      expect(slug === '' || isValidSlug(slug)).toBe(true)
    }
  })
})

describe('isValidSlug', () => {
  it.each(['a', 'cardiology', 'type-2-diabetes'])('accepts %j', (slug) => {
    expect(isValidSlug(slug)).toBe(true)
  })
  it.each(['', 'Cardiology', 'a--b', '-a', 'a-', 'a b', 'a_b', 'x'.repeat(81)])(
    'rejects %j',
    (slug) => {
      expect(isValidSlug(slug)).toBe(false)
    },
  )
})

describe('isHttpUrl', () => {
  it('accepts http and https only', () => {
    expect(isHttpUrl('https://example.com/a')).toBe(true)
    expect(isHttpUrl('http://example.com')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('ftp://example.com')).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
  })
})

describe('DOI helpers', () => {
  it.each([
    ['10.1016/S0140-6736(94)90566-5', '10.1016/S0140-6736(94)90566-5'],
    ['https://doi.org/10.1000/xyz123', '10.1000/xyz123'],
    ['http://dx.doi.org/10.1000/xyz123', '10.1000/xyz123'],
    ['  doi: 10.1000/xyz123 ', '10.1000/xyz123'],
  ])('normalizes %j', (input, expected) => {
    expect(normalizeDoi(input)).toBe(expected)
  })

  it('validates the 10.<registrant>/<suffix> shape', () => {
    expect(isValidDoi('10.1000/xyz123')).toBe(true)
    expect(isValidDoi('11.1000/xyz123')).toBe(false)
    expect(isValidDoi('10.1/x')).toBe(false)
    expect(isValidDoi('10.1000/')).toBe(false)
    expect(isValidDoi('10.1000/has space')).toBe(false)
  })
})

describe('parseVideoUrl', () => {
  const youtube = (id: string) => ({
    provider: 'youtube',
    videoId: id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  })

  it.each([
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://youtube.com/watch?v=jNQXAC9IVRw&t=30s',
    'http://m.youtube.com/watch?v=jNQXAC9IVRw',
    'https://youtu.be/jNQXAC9IVRw?si=abc',
    'https://www.youtube.com/embed/jNQXAC9IVRw',
    'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw',
    'https://www.youtube.com/shorts/jNQXAC9IVRw',
    '  https://www.youtube.com/watch?v=jNQXAC9IVRw  ',
  ])('normalizes YouTube URL %s', (url) => {
    expect(parseVideoUrl(url)).toEqual(youtube('jNQXAC9IVRw'))
  })

  it.each([
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://player.vimeo.com/video/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://vimeo.com/channels/staffpicks/76979871', 'https://player.vimeo.com/video/76979871'],
    [
      'https://vimeo.com/76979871/abcdef1234',
      'https://player.vimeo.com/video/76979871?h=abcdef1234',
    ],
    [
      'https://player.vimeo.com/video/76979871?h=abcdef1234',
      'https://player.vimeo.com/video/76979871?h=abcdef1234',
    ],
  ])('normalizes Vimeo URL %s', (url, embedUrl) => {
    expect(parseVideoUrl(url)).toEqual({ provider: 'vimeo', videoId: '76979871', embedUrl })
  })

  it.each([
    '',
    'not a url',
    'javascript:alert(1)',
    'https://example.com/watch?v=jNQXAC9IVRw',
    'https://evil.com/youtube.com/watch?v=jNQXAC9IVRw',
    'https://www.youtube.com.evil.com/watch?v=jNQXAC9IVRw',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/channel/UC1234567890123',
    'https://vimeo.com/channels/staffpicks',
    'https://user:pass@www.youtube.com/watch?v=jNQXAC9IVRw',
    'ftp://youtu.be/jNQXAC9IVRw',
  ])('rejects %j', (url) => {
    expect(parseVideoUrl(url)).toBeNull()
  })
})

describe('providerThumbnailUrl', () => {
  it('derives a YouTube thumbnail and nothing for other providers', () => {
    expect(providerThumbnailUrl('youtube', 'jNQXAC9IVRw')).toBe(
      'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
    )
    expect(providerThumbnailUrl('vimeo', '76979871')).toBeNull()
    expect(providerThumbnailUrl('other', 'x')).toBeNull()
  })
})
