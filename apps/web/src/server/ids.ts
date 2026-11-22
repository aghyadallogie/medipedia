/**
 * Relationship values are an id at depth 0 and a populated document at greater depth.
 * Hooks see both, so normalise to an id string.
 */
export function idOf(value: unknown): string | null {
  if (typeof value === 'string' && value !== '') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'string' && id !== '' ? id : null
  }
  return null
}

export function idsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(idOf).filter((id): id is string => id !== null)
}
