import { parseCsvRows } from './csv.js'
import { fetchSheetCsv, sheetCsvUrl } from './sheet.js'
import { countStatusesFromCsv } from './status.js'

const STORAGE_KEY = 'pfas-sheet-csv-cache'
const DEFAULT_POLL_MS = 30_000

let cache = {
  csvText: '',
  counts: {},
  rows: [],
  headers: [],
  hash: '',
  lastUpdated: null,
  status: 'idle',
  error: null,
  isRefreshing: false,
}

const subscribers = new Set()
let pollTimer = null
let syncStarted = false
let inflightFetch = null

function hashCsv(text) {
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }

  return String(hash)
}

function applyCsv(csvText, { fromCache = false, updatedAt = null } = {}) {
  const parsed = parseCsvRows(csvText)
  const [headers = [], ...rows] = parsed

  cache.csvText = csvText
  cache.hash = hashCsv(csvText)
  cache.headers = headers
  cache.rows = rows
  cache.counts = countStatusesFromCsv(csvText)
  cache.lastUpdated = updatedAt ?? new Date()
  cache.status = fromCache ? 'cached' : 'connected'
}

function persistCache() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        csvText: cache.csvText,
        hash: cache.hash,
        updatedAt: cache.lastUpdated?.getTime?.() ?? Date.now(),
      }),
    )
  } catch {
    // Ignore quota or private-mode errors.
  }
}

function loadPersistedCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return false
    }

    const saved = JSON.parse(raw)
    if (!saved?.csvText) {
      return false
    }

    applyCsv(saved.csvText, {
      fromCache: true,
      updatedAt: saved.updatedAt ? new Date(saved.updatedAt) : null,
    })
    cache.hash = saved.hash || cache.hash

    return true
  } catch {
    return false
  }
}

function buildSnapshot() {
  return {
    csvText: cache.csvText,
    counts: cache.counts,
    rows: cache.rows,
    headers: cache.headers,
    lastUpdated: cache.lastUpdated,
    status: cache.status,
    error: cache.error,
    isRefreshing: cache.isRefreshing,
    hasData: Boolean(cache.csvText),
  }
}

let cachedSnapshot = buildSnapshot()

export function getSheetSnapshot() {
  return cachedSnapshot
}

function notifySubscribers() {
  cachedSnapshot = buildSnapshot()
  subscribers.forEach((listener) => listener(cachedSnapshot))
}

export function subscribeSheet(listener) {
  subscribers.add(listener)
  listener(cachedSnapshot)

  return () => {
    subscribers.delete(listener)
  }
}

export async function refreshSheet({ silent = false } = {}) {
  if (!sheetCsvUrl) {
    return
  }

  if (inflightFetch) {
    return inflightFetch
  }

  if (!silent && !cache.csvText) {
    cache.status = 'loading'
    notifySubscribers()
  } else if (cache.csvText) {
    cache.isRefreshing = true
    notifySubscribers()
  }

  inflightFetch = (async () => {
    try {
      const csvText = await fetchSheetCsv()
      const nextHash = hashCsv(csvText)
      const changed = nextHash !== cache.hash || !cache.csvText

      if (changed) {
        applyCsv(csvText)
        persistCache()
      } else {
        cache.status = 'connected'
        cache.lastUpdated = new Date()
      }

      cache.error = null
    } catch (error) {
      cache.error = error
      cache.status = cache.csvText ? 'cached' : 'error'
    } finally {
      cache.isRefreshing = false
      inflightFetch = null
      notifySubscribers()
    }
  })()

  return inflightFetch
}

export function startSheetSync() {
  if (!sheetCsvUrl || syncStarted) {
    return () => {}
  }

  syncStarted = true
  const hadPersistedCache = loadPersistedCache()

  if (hadPersistedCache) {
    notifySubscribers()
  }

  refreshSheet({ silent: hadPersistedCache })

  const pollMs = Number.parseInt(import.meta.env.VITE_GOOGLE_SHEET_POLL_MS, 10) || DEFAULT_POLL_MS
  pollTimer = window.setInterval(() => {
    refreshSheet({ silent: true })
  }, pollMs)

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      refreshSheet({ silent: true })
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    syncStarted = false
    window.clearInterval(pollTimer)
    pollTimer = null
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

export function formatSheetStatus(snapshot) {
  if (!sheetCsvUrl) {
    return 'No sheet connected yet'
  }

  if (snapshot.status === 'loading') {
    return 'Loading sheet...'
  }

  if (snapshot.status === 'error' && !snapshot.hasData) {
    return 'Unable to load Google Sheet'
  }

  const updatedLabel = snapshot.lastUpdated
    ? `Updated ${snapshot.lastUpdated.toLocaleTimeString()}`
    : ''

  if (snapshot.isRefreshing) {
    return updatedLabel ? `Syncing... · ${updatedLabel}` : 'Syncing...'
  }

  if (snapshot.status === 'cached') {
    return updatedLabel ? `Cached · ${updatedLabel}` : 'Showing cached data'
  }

  if (snapshot.status === 'error') {
    return updatedLabel ? `Offline · ${updatedLabel}` : 'Unable to refresh · showing cached data'
  }

  return updatedLabel ? `Live · ${updatedLabel}` : 'Google Sheet connected'
}
