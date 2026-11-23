import { beforeEach, describe, expect, it, vi } from 'vitest'

const unstableCache = vi.fn(
  (fn: (...args: never[]) => Promise<unknown>, _keyParts: string[], _options: unknown) => fn,
)
vi.mock('next/cache', () => ({
  unstable_cache: (...args: Parameters<typeof unstableCache>) => unstableCache(...args),
}))

import { cachedQuery } from './cache'

describe('cachedQuery', () => {
  beforeEach(() => {
    unstableCache.mockClear()
  })

  it('keys by name and arguments and tags by what the tag function returns', async () => {
    const query = vi.fn(async (slug: string, page: number) => `${slug}:${page}`)
    const cached = cachedQuery('lectures:get', query, (slug) => ['content', `lecture:${slug}`])

    expect(await cached('acs', 2)).toBe('acs:2')
    expect(query).toHaveBeenCalledWith('acs', 2)

    const [, keyParts, options] = unstableCache.mock.calls[0] ?? []
    expect(keyParts).toEqual(['lectures:get', JSON.stringify(['acs', 2])])
    expect(options).toMatchObject({ tags: ['content', 'lecture:acs'], revalidate: 3600 })
  })

  it('gives different arguments different cache keys', async () => {
    const cached = cachedQuery(
      'q',
      async (n: number) => n,
      () => [],
    )
    await cached(1)
    await cached(2)
    const keys = unstableCache.mock.calls.map((call) => call[1])
    expect(keys[0]).not.toEqual(keys[1])
  })

  it('does not swallow errors from the query', async () => {
    unstableCache.mockImplementationOnce((fn) => fn)
    const cached = cachedQuery(
      'boom',
      async () => Promise.reject(new Error('db down')),
      () => [],
    )
    await expect(cached()).rejects.toThrow('db down')
  })
})
