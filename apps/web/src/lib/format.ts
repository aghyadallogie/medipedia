/** Formatting helpers. Dates use UTC so server and browser render the same text. */

const dateFormat = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

/** 125 -> "2:05", 3725 -> "1:02:05" */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

/** "Smith J, Jones K" style list, shortened to the first few authors. */
export function formatAuthors(authors: readonly string[], max = 3): string {
  if (authors.length <= max) return authors.join(', ')
  return `${authors.slice(0, max).join(', ')} et al.`
}
