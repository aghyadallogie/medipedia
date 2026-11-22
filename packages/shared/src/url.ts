const DOI_PREFIX = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/

/** "https://doi.org/10.1000/xyz123", "doi:10.1000/xyz123" -> "10.1000/xyz123" */
export function normalizeDoi(input: string): string {
  return input.trim().replace(DOI_PREFIX, '')
}

export function isValidDoi(value: string): boolean {
  return DOI_PATTERN.test(value)
}

/** True for absolute http(s) URLs. Used for citations, DOI/PubMed links and similar. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
