import type { RichText as RichTextDto } from '@medipedia/shared'

/**
 * Renders rich text that the server already converted to HTML. Payload's converter escapes
 * text and sanitizes link and image URLs, so this is the only place HTML is injected.
 */
export function RichText({
  content,
  className = '',
}: {
  content: RichTextDto
  className?: string
}) {
  if (content.html.trim() === '') return null
  return (
    <div className={`rich-text ${className}`} dangerouslySetInnerHTML={{ __html: content.html }} />
  )
}
