import { parseCsvRows } from './csv.js'
import { fetchSheetCsv, sheetCsvUrl } from './sheet.js'
import { countStatusesFromCsv } from './status.js'

const DEFAULT_POLL_MS = 5_000

let state = {
  csvText: '',
  counts: {},
  rows: [],
  headers: [],
  lastUpdated: null,
  status: 'idle',
  error: null,
  isRefreshing: false,
}

const subscribers = new Set()
let pollTimer = null
let syncStarted = false
let inflightFetch = null

function applyCsv(csvText) {
  const parsed = parseCsvRows(csvText)
  const [headers = [], ...rows] = parsed

  state.csvText = csvText
  state.headers = headers
  state.rows = rows
  state.counts = countStatusesFromCsv(csvText)
  state.lastUpdated = new Date()
  state.status = 'connected'
}

function buildSnapshot() {
  return {
    csvText: state.csvText,
    counts: state.counts,
    rows: state.rows,
    headers: state.headers,
    lastUpdated: state.lastUpdated,
    status: state.status,
    error: state.error,
    isRefreshing: state.isRefreshing,
    hasData: Boolean(state.csvText),
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

export async function refreshSheet() {
  if (!sheetCsvUrl) {
    return
  }

  if (inflightFetch) {
    return inflightFetch
  }

  state.isRefreshing = Boolean(state.csvText)
  if (!state.csvText) {
    state.status = 'loading'
  }
  notifySubscribers()

  inflightFetch = (async () => {
    try {
      const csvText = await fetchSheetCsv()
      applyCsv(csvText)
      state.error = null
    } catch (error) {
      state.error = error
      if (!state.csvText) {
        state.status = 'error'
      }
    } finally {
      state.isRefreshing = false
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

  try {
    localStorage.removeItem('pfas-sheet-csv-cache')
  } catch {
    // Ignore.
  }

  refreshSheet()

  const pollMs = Number.parseInt(import.meta.env.VITE_GOOGLE_SHEET_POLL_MS, 10) || DEFAULT_POLL_MS
  pollTimer = window.setInterval(refreshSheet, pollMs)

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      refreshSheet()
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

  if (snapshot.status === 'error') {
    return updatedLabel ? `Refresh failed · ${updatedLabel}` : 'Unable to refresh Google Sheet'
  }

  return updatedLabel ? `Live · ${updatedLabel}` : 'Google Sheet connected'
}
