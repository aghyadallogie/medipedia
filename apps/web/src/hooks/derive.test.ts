import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  PayloadRequest,
} from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  deriveVideoFields,
  labelQuestionChoices,
  setDomainFromTopic,
  stampPublishedAt,
} from './derive'

type ChangeArgs = Parameters<CollectionBeforeChangeHook>[0]
type ValidateArgs = Parameters<CollectionBeforeValidateHook>[0]

const change = (args: Record<string, unknown>) => args as unknown as ChangeArgs
const validate = (args: Record<string, unknown>) => args as unknown as ValidateArgs

describe('setDomainFromTopic', () => {
  const reqWith = (findByID: ReturnType<typeof vi.fn>) =>
    ({ payload: { findByID } }) as unknown as PayloadRequest

  it('copies the topic domain onto the document', async () => {
    const findByID = vi.fn().mockResolvedValue({ id: 't1', domain: 'd1' })
    const result = await setDomainFromTopic(
      change({ data: { topic: 't1', front: 'x' }, originalDoc: undefined, req: reqWith(findByID) }),
    )
    expect(result).toEqual({ topic: 't1', front: 'x', domain: 'd1' })
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'topics', id: 't1' }),
    )
  })

  it('handles a populated domain on the topic', async () => {
    const findByID = vi.fn().mockResolvedValue({ id: 't1', domain: { id: 'd9' } })
    const result = await setDomainFromTopic(
      change({ data: { topic: { id: 't1' } }, req: reqWith(findByID) }),
    )
    expect(result).toMatchObject({ domain: 'd9' })
  })

  it('falls back to the existing topic on partial updates', async () => {
    const findByID = vi.fn().mockResolvedValue({ id: 't1', domain: 'd1' })
    const result = await setDomainFromTopic(
      change({ data: { front: 'edited' }, originalDoc: { topic: 't1' }, req: reqWith(findByID) }),
    )
    expect(result).toMatchObject({ front: 'edited', domain: 'd1' })
  })

  it('does nothing without a topic', async () => {
    const findByID = vi.fn()
    const data = { front: 'draft with no topic yet' }
    await expect(setDomainFromTopic(change({ data, req: reqWith(findByID) }))).resolves.toBe(data)
    expect(findByID).not.toHaveBeenCalled()
  })

  it('leaves data alone when the topic does not exist', async () => {
    const findByID = vi.fn().mockRejectedValue(new Error('Not Found'))
    const data = { topic: 'missing' }
    await expect(setDomainFromTopic(change({ data, req: reqWith(findByID) }))).resolves.toBe(data)
  })
})

describe('stampPublishedAt', () => {
  it('stamps the first publish', () => {
    const result = stampPublishedAt(change({ data: { _status: 'published' } })) as {
      publishedAt: string
    }
    expect(Date.parse(result.publishedAt)).not.toBeNaN()
  })

  it('does not overwrite an existing date or stamp drafts', () => {
    const withDate = { _status: 'published', publishedAt: '2020-01-01T00:00:00.000Z' }
    expect(stampPublishedAt(change({ data: withDate }))).toBe(withDate)
    const onOriginal = { _status: 'published' }
    expect(
      stampPublishedAt(
        change({ data: onOriginal, originalDoc: { publishedAt: '2020-01-01T00:00:00.000Z' } }),
      ),
    ).toBe(onOriginal)
    const draft = { _status: 'draft' }
    expect(stampPublishedAt(change({ data: draft }))).toBe(draft)
  })
})

describe('labelQuestionChoices', () => {
  it('labels choices A, B, C by position, replacing whatever was sent', () => {
    const result = labelQuestionChoices(
      validate({ data: { choices: [{ text: 'x', label: 'Z' }, { text: 'y' }, { text: 'w' }] } }),
    ) as { choices: { label: string }[] }
    expect(result.choices.map((c) => c.label)).toEqual(['A', 'B', 'C'])
  })

  it('passes through data without choices', () => {
    const data = { stem: 'x' }
    expect(labelQuestionChoices(validate({ data }))).toBe(data)
    expect(labelQuestionChoices(validate({ data: undefined }))).toBeUndefined()
  })
})

describe('deriveVideoFields', () => {
  it('normalizes a YouTube URL and derives provider fields', () => {
    expect(
      deriveVideoFields(change({ data: { embedUrl: 'https://youtu.be/jNQXAC9IVRw?si=abc' } })),
    ).toEqual({
      embedUrl: 'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw',
      provider: 'youtube',
      providerVideoId: 'jNQXAC9IVRw',
    })
  })

  it('normalizes Vimeo and uses the existing URL on partial updates', () => {
    expect(
      deriveVideoFields(
        change({ data: { title: 'x' }, originalDoc: { embedUrl: 'https://vimeo.com/76979871' } }),
      ),
    ).toEqual({
      title: 'x',
      embedUrl: 'https://player.vimeo.com/video/76979871',
      provider: 'vimeo',
      providerVideoId: '76979871',
    })
  })

  it('leaves unrecognised URLs untouched for the validator to reject', () => {
    const data = { embedUrl: 'https://example.com/video' }
    expect(deriveVideoFields(change({ data }))).toBe(data)
    const empty = { title: 'draft' }
    expect(deriveVideoFields(change({ data: empty }))).toBe(empty)
  })
})
