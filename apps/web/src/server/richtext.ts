/**
 * Rich text leaves the server as HTML, never raw Lexical JSON (AGENTS.md §6). Payload's
 * converter escapes text and sanitizes link and image URLs, so the result is safe to render.
 */
import {
  convertLexicalToHTML,
  defaultHTMLConverters,
  LinkHTMLConverter,
  type HTMLConverters,
} from '@payloadcms/richtext-lexical/html'
import type { RichText } from '@medipedia/shared'

type EditorState = Parameters<typeof convertLexicalToHTML>[0]['data']

/** Public page for each collection an editor can link to from rich text. */
const LINKABLE_COLLECTIONS: Record<string, string> = {
  lectures: '/lectures',
  papers: '/papers',
  videos: '/videos',
  domains: '/domains',
}

/** `fields.doc` of an internal link node: `{ relationTo, value }` with the document populated. */
export function internalDocHref(doc: unknown): string {
  if (typeof doc !== 'object' || doc === null) return '#'
  const { relationTo, value } = doc as { relationTo?: unknown; value?: unknown }
  const base = typeof relationTo === 'string' ? LINKABLE_COLLECTIONS[relationTo] : undefined
  if (base === undefined || typeof value !== 'object' || value === null) return '#'
  const slug = (value as { slug?: unknown }).slug
  return typeof slug === 'string' && slug !== '' ? `${base}/${encodeURIComponent(slug)}` : '#'
}

const converters = {
  ...defaultHTMLConverters,
  ...LinkHTMLConverter({
    internalDocToHref: ({ linkNode }) => internalDocHref(linkNode.fields.doc),
  }),
} as HTMLConverters

function isEditorState(value: unknown): value is EditorState {
  if (typeof value !== 'object' || value === null || !('root' in value)) return false
  const root = (value as { root: unknown }).root
  return (
    typeof root === 'object' &&
    root !== null &&
    Array.isArray((root as { children?: unknown }).children)
  )
}

export function lexicalToRichText(state: unknown): RichText {
  if (!isEditorState(state)) return { html: '' }
  return { html: convertLexicalToHTML({ data: state, converters, disableContainer: true }) }
}
