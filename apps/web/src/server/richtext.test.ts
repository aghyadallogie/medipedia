import { describe, expect, it } from 'vitest'

import { internalDocHref, lexicalToRichText } from './richtext'
import { paragraphsToLexical } from './lexical'

type Node = Record<string, unknown>

const text = (value: string, format = 0): Node => ({
  type: 'text',
  version: 1,
  text: value,
  detail: 0,
  format,
  mode: 'normal',
  style: '',
})

const state = (...children: Node[]) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        children,
      },
    ],
  },
})

const link = (fields: Record<string, unknown>, ...children: Node[]): Node => ({
  type: 'link',
  version: 3,
  direction: 'ltr',
  format: '',
  indent: 0,
  fields,
  children,
})

describe('lexicalToRichText', () => {
  it('renders paragraphs without a container wrapper', () => {
    expect(lexicalToRichText(paragraphsToLexical(['One', 'Two'])).html).toBe('<p>One</p><p>Two</p>')
  })

  it('applies inline formatting', () => {
    const { html } = lexicalToRichText(state(text('bold', 1), text(' and '), text('italic', 2)))
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('escapes HTML in text', () => {
    const { html } = lexicalToRichText(state(text('<script>alert(1)</script> & "quotes"')))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
  })

  it('keeps ordinary links and sanitizes dangerous ones', () => {
    const ok = lexicalToRichText(
      state(
        link(
          { linkType: 'custom', url: 'https://example.com/a?b=1&c=2', newTab: true },
          text('go'),
        ),
      ),
    )
    expect(ok.html).toContain('href="https://example.com/a?b=1&amp;c=2"')
    expect(ok.html).toContain('rel="noopener noreferrer"')

    const bad = lexicalToRichText(
      state(link({ linkType: 'custom', url: 'javascript:alert(document.cookie)' }, text('click'))),
    )
    expect(bad.html.toLowerCase()).not.toContain('javascript:')
  })

  it('points internal links at the public page of the target', () => {
    const { html } = lexicalToRichText(
      state(
        link(
          {
            linkType: 'internal',
            doc: { relationTo: 'lectures', value: { id: 'x', slug: 'acs' } },
          },
          text('ACS lecture'),
        ),
      ),
    )
    expect(html).toContain('href="/lectures/acs"')
  })

  it.each([
    null,
    undefined,
    'text',
    42,
    {},
    { root: null },
    { root: {} },
    { root: { children: 'x' } },
  ])('returns empty HTML for %j', (value) => {
    expect(lexicalToRichText(value)).toEqual({ html: '' })
  })
})

describe('internalDocHref', () => {
  it.each([
    [{ relationTo: 'lectures', value: { slug: 'a-b' } }, '/lectures/a-b'],
    [{ relationTo: 'papers', value: { slug: 'p' } }, '/papers/p'],
    [{ relationTo: 'videos', value: { slug: 'v' } }, '/videos/v'],
    [{ relationTo: 'domains', value: { slug: 'cardiology' } }, '/domains/cardiology'],
    [
      { relationTo: 'lectures', value: { slug: 'needs encoding/here' } },
      '/lectures/needs%20encoding%2Fhere',
    ],
  ])('%j -> %s', (doc, href) => {
    expect(internalDocHref(doc)).toBe(href)
  })

  it.each([
    ['not an object', 'x'],
    ['null', null],
    ['unlinkable collection', { relationTo: 'questions', value: { slug: 'q' } }],
    ['unpopulated target', { relationTo: 'lectures', value: 'some-id' }],
    ['no slug', { relationTo: 'lectures', value: { id: 'a' } }],
    ['empty slug', { relationTo: 'lectures', value: { slug: '' } }],
  ])('falls back to "#" for %s', (_name, doc) => {
    expect(internalDocHref(doc)).toBe('#')
  })
})
