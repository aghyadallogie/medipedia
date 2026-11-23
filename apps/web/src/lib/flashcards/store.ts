import type { ReviewState } from './sm2'

/**
 * Where this browser keeps flashcard review state (AGENTS.md §9: client-side only in v1).
 * Everything is keyed by the card's permanent id, so a future server sync can reuse it.
 */
export interface ReviewStore {
  /** False when the browser would not give us IndexedDB: progress then lasts until the tab closes. */
  readonly persistent: boolean
  getMany(cardIds: readonly string[]): Promise<Map<string, ReviewState>>
  put(state: ReviewState): Promise<void>
  deleteMany(cardIds: readonly string[]): Promise<void>
}

export function createMemoryStore(persistent = false): ReviewStore {
  const states = new Map<string, ReviewState>()
  return {
    persistent,
    async getMany(cardIds) {
      const found = new Map<string, ReviewState>()
      for (const id of cardIds) {
        const state = states.get(id)
        if (state) found.set(id, state)
      }
      return found
    },
    async put(state) {
      states.set(state.cardId, { ...state })
    },
    async deleteMany(cardIds) {
      for (const id of cardIds) states.delete(id)
    },
  }
}

const DB_NAME = 'medipedia'
const DB_VERSION = 1
const STORE = 'flashcard-reviews'

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })

const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, DB_VERSION)
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(STORE, { keyPath: 'cardId' })
    }
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error ?? new Error('Could not open IndexedDB'))
    opening.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'))
  })
}

function indexedDbStore(db: IDBDatabase): ReviewStore {
  return {
    persistent: true,
    async getMany(cardIds) {
      const tx = db.transaction(STORE, 'readonly')
      const objects = tx.objectStore(STORE)
      const rows = await Promise.all(
        cardIds.map((id) => request(objects.get(id) as IDBRequest<ReviewState | undefined>)),
      )
      const found = new Map<string, ReviewState>()
      for (const row of rows) if (row) found.set(row.cardId, row)
      return found
    },
    async put(state) {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(state)
      await finished(tx)
    },
    async deleteMany(cardIds) {
      const tx = db.transaction(STORE, 'readwrite')
      for (const id of cardIds) tx.objectStore(STORE).delete(id)
      await finished(tx)
    },
  }
}

/**
 * Opens the browser database, or an in-memory stand-in when it is unavailable (some private
 * windows, blocked site data). Browser only.
 */
export async function openReviewStore(): Promise<ReviewStore> {
  try {
    if (typeof indexedDB === 'undefined') return createMemoryStore()
    return indexedDbStore(await openDatabase())
  } catch {
    return createMemoryStore()
  }
}
