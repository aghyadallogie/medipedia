import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { revalidateTag } from 'next/cache'

import { createRevalidateHooks, revalidateTags } from './revalidate'

const SLUGS: Record<string, string> = { d1: 'cardiology', d2: 'pharmacology', t1: 'acs' }

function fakeReq() {
  const warn = vi.fn()
  const find = vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => ({
    docs: where.id.in.map((id) => ({ slug: SLUGS[id] })),
  }))
  return { req: { payload: { find, logger: { warn } } } as unknown as PayloadRequest, find, warn }
}

type ChangeArgs = Parameters<CollectionAfterChangeHook>[0]
type DeleteArgs = Parameters<CollectionAfterDeleteHook>[0]

const change = (args: Record<string, unknown>) => args as unknown as ChangeArgs
const del = (args: Record<string, unknown>) => args as unknown as DeleteArgs

const sorted = (tags: readonly string[]) => [...tags].sort()
const lastCall = (fn: ReturnType<typeof vi.fn>): string[] => {
  const call = fn.mock.calls.at(-1)
  return sorted((call?.[0] as string[] | undefined) ?? [])
}

describe('createRevalidateHooks (drafts collection)', () => {
  const revalidate = vi.fn()
  const { afterChange, afterDelete } = createRevalidateHooks('lectures', {
    drafts: true,
    revalidate,
  })

  beforeEach(() => {
    revalidate.mockClear()
  })

  it('invalidates item, collection, content and domain tags when a lecture is published', async () => {
    const { req } = fakeReq()
    await afterChange(
      change({
        req,
        context: {},
        doc: { id: 'a', slug: 'chest-pain', domains: ['d1', { id: 'd2' }], _status: 'published' },
        previousDoc: { id: 'a', slug: 'chest-pain', domains: ['d1'], _status: 'draft' },
      }),
    )
    expect(revalidate).toHaveBeenCalledTimes(1)
    expect(lastCall(revalidate)).toEqual(
      sorted([
        'content',
        'lectures',
        'lecture:chest-pain',
        'domain:cardiology',
        'domain:pharmacology',
      ]),
    )
  })

  it('does nothing for a draft that was never published', async () => {
    const { req, find } = fakeReq()
    await afterChange(
      change({
        req,
        context: {},
        doc: { id: 'a', slug: 'x', domains: ['d1'], _status: 'draft' },
        previousDoc: {},
      }),
    )
    expect(revalidate).not.toHaveBeenCalled()
    expect(find).not.toHaveBeenCalled()
  })

  it('invalidates when a published lecture is unpublished', async () => {
    const { req } = fakeReq()
    await afterChange(
      change({
        req,
        context: {},
        doc: { id: 'a', slug: 'x', domains: ['d1'], _status: 'draft' },
        previousDoc: { id: 'a', slug: 'x', domains: ['d1'], _status: 'published' },
      }),
    )
    expect(lastCall(revalidate)).toContain('lecture:x')
  })

  it('invalidates both the old and the new slug and domain when they change', async () => {
    const { req } = fakeReq()
    await afterChange(
      change({
        req,
        context: {},
        doc: { id: 'a', slug: 'new-slug', domains: ['d2'], _status: 'published' },
        previousDoc: { id: 'a', slug: 'old-slug', domains: ['d1'], _status: 'published' },
      }),
    )
    expect(lastCall(revalidate)).toEqual(
      sorted([
        'content',
        'lectures',
        'lecture:new-slug',
        'lecture:old-slug',
        'domain:pharmacology',
        'domain:cardiology',
      ]),
    )
  })

  it('returns the document unchanged', async () => {
    const { req } = fakeReq()
    const doc = { id: 'a', slug: 'x', domains: [], _status: 'published' }
    await expect(afterChange(change({ req, context: {}, doc, previousDoc: {} }))).resolves.toBe(doc)
  })

  it('respects context.disableRevalidate (seed scripts, bulk jobs)', async () => {
    const { req } = fakeReq()
    await afterChange(
      change({
        req,
        context: { disableRevalidate: true },
        doc: { id: 'a', slug: 'x', domains: ['d1'], _status: 'published' },
        previousDoc: {},
      }),
    )
    await afterDelete(
      del({
        req,
        context: { disableRevalidate: true },
        doc: { id: 'a', slug: 'x', _status: 'published' },
      }),
    )
    expect(revalidate).not.toHaveBeenCalled()
  })

  it('invalidates when a published document is deleted but not a draft', async () => {
    const { req } = fakeReq()
    await afterDelete(
      del({
        req,
        context: {},
        doc: { id: 'a', slug: 'gone', domains: ['d1'], _status: 'published' },
      }),
    )
    expect(lastCall(revalidate)).toContain('lecture:gone')

    revalidate.mockClear()
    await afterDelete(
      del({ req, context: {}, doc: { id: 'b', slug: 'draft', domains: [], _status: 'draft' } }),
    )
    expect(revalidate).not.toHaveBeenCalled()
  })
})

describe('createRevalidateHooks (other collections)', () => {
  it('flashcards are tagged by id, topic and domain', async () => {
    const revalidate = vi.fn()
    const { afterChange } = createRevalidateHooks('flashcards', { drafts: true, revalidate })
    const { req } = fakeReq()
    await afterChange(
      change({
        req,
        context: {},
        doc: { id: 'card-1', slug: 'ignored', topic: 't1', domain: 'd1', _status: 'published' },
        previousDoc: {},
      }),
    )
    expect(lastCall(revalidate)).toEqual(
      sorted(['content', 'flashcards', 'flashcard:card-1', 'topic:acs', 'domain:cardiology']),
    )
  })

  it('questions only invalidate their collection, topic and domain tags', async () => {
    const revalidate = vi.fn()
    const { afterChange } = createRevalidateHooks('questions', { drafts: true, revalidate })
    const { req } = fakeReq()
    await afterChange(
      change({
        req,
        context: {},
        doc: { id: 'q1', topic: 't1', domain: 'd1', _status: 'published' },
        previousDoc: {},
      }),
    )
    expect(lastCall(revalidate)).toEqual(
      sorted(['content', 'questions', 'topic:acs', 'domain:cardiology']),
    )
  })

  it('taxonomy (no drafts) always invalidates, even without a _status', async () => {
    const revalidate = vi.fn()
    const { afterChange } = createRevalidateHooks('domains', { drafts: false, revalidate })
    const { req } = fakeReq()
    await afterChange(
      change({ req, context: {}, doc: { id: 'd1', slug: 'cardiology' }, previousDoc: {} }),
    )
    expect(lastCall(revalidate)).toContain('domain:cardiology')
  })
})

describe('revalidateTags (default implementation)', () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockReset()
  })

  it('expires each tag immediately', () => {
    const { req } = fakeReq()
    revalidateTags(['content', 'lectures'], req)
    expect(revalidateTag).toHaveBeenCalledWith('content', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('lectures', { expire: 0 })
  })

  it('logs and carries on when there is no Next.js runtime', () => {
    vi.mocked(revalidateTag).mockImplementation(() => {
      throw new Error('Invariant: static generation store missing')
    })
    const { req, warn } = fakeReq()
    expect(() => revalidateTags(['a', 'b'], req)).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
