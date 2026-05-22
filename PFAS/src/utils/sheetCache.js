import { parseCsvRows } from './csv.js'
import {
  fetchSheetData,
  getSheetSourceLabel,
  hasSheetConnection,
} from './sheet.js'
import { countStatusesFromCsv } from './status.js'

const DEFAULT_POLL_MS = 1_000

let state = {
  csvText: '',
  counts: {},
  rows: [],
  headers: [],
  lastUpdated: null,
  status: 'idle',
  error: null,
  isRefreshing: false,
  source: '',
}

const subscribers = new Set()
let pollTimer = null
let syncStarted = false
let refreshController = null

function applyCsv(csvText) {
  const parsed = parseCsvRows(csvText)
  const [headers = [], ...rows] = parsed

  state.csvText = csvText
  state.headers = headers
  state.rows = rows
  state.counts = countStatusesFromCsv(csvText)
  state.lastUpdated = new Date()
  state.status = 'connected'
  state.source = getSheetSourceLabel()
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
    source: state.source,
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

export function refreshSheet() {
  if (!hasSheetConnection()) {
    return Promise.resolve()
  }

  if (refreshController) {
    refreshController.abort()
  }

  refreshController = new AbortController()
  const { signal } = refreshController

  state.isRefreshing = Boolean(state.csvText)
  if (!state.csvText) {
    state.status = 'loading'
  }
  notifySubscribers()

  return fetchSheetData(signal)
    .then((csvText) => {
      if (signal.aborted) {
        return
      }

      applyCsv(csvText)
      state.error = null
    })
    .catch((error) => {
      if (signal.aborted || error.name === 'AbortError') {
        return
      }

      state.error = error
      if (!state.csvText) {
        state.status = 'error'
      }
    })
    .finally(() => {
      if (!signal.aborted) {
        state.isRefreshing = false
        notifySubscribers()
      }
    })
}

export function startSheetSync() {
  if (!hasSheetConnection() || syncStarted) {
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

  function handleWindowFocus() {
    refreshSheet()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleWindowFocus)

  return () => {
    syncStarted = false
    window.clearInterval(pollTimer)
    pollTimer = null
    refreshController?.abort()
    refreshController = null
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleWindowFocus)
  }
}

export function formatSheetStatus(snapshot) {
  if (!hasSheetConnection()) {
    return 'No sheet connected yet'
  }

  if (snapshot.status === 'loading') {
    return 'Loading...'
  }

  if (snapshot.status === 'error' && !snapshot.hasData) {
    return 'Unable to load Google Sheet'
  }

  if (snapshot.status === 'error') {
    return 'Offline'
  }

  return 'Live'
}
