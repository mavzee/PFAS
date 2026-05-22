import { parseCsvRows } from './csv.js'
import {
  fetchSheetData,
  getSheetSourceLabel,
  hasSheetConnection,
  sheetsApiKey,
} from './sheet.js'
import { isValidTesterActivityCsv } from './testerActivity.js'
import { countStatusesFromCsv } from './status.js'
import {
  ACTIVITY_FEED_LIMIT,
  buildRowSnapshots,
  diffRowSnapshots,
  mapManualActivities,
  mergeActivities,
  prependActivityFeed,
} from './recentActivity.js'
import {
  isFirestorePermissionsDenied,
  isRecentActivityStoreEnabled,
  loadRecentActivityFeed,
  saveRecentActivityFeed,
} from './recentActivityStore.js'

const DEFAULT_POLL_MS = 1_000
const PUBLISHED_CSV_POLL_MS = 5_000
const UPLOAD_DEBOUNCE_MS = 1_500

let state = {
  csvText: '',
  testerCsvText: '',
  counts: {},
  rows: [],
  headers: [],
  hash: '',
  testerHash: '',
  lastUpdated: null,
  testerLastUpdated: null,
  status: 'idle',
  error: null,
  isRefreshing: false,
  source: '',
}

let rowSnapshots = new Map()
let activityFeed = []
let hasBaseline = false
let recentActivitiesLoading = false
let isHydrating = false
let uploadTimer = null
let lastUploadedFeedKey = ''
let hydrateAttempted = false

const subscribers = new Set()
let pollTimer = null
let syncStarted = false
let inflightFetch = null
let fetchGeneration = 0

function hashCsv(text) {
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }

  return String(hash)
}

function isValidMainSheetCsv(csvText) {
  const trimmed = csvText.trim()

  if (!trimmed || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return false
  }

  const rows = parseCsvRows(trimmed)
  const [headers = []] = rows
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())

  return normalizedHeaders.includes('retainer') && rows.length > 1
}

function getMergedRecentActivities() {
  return mergeActivities(activityFeed, mapManualActivities(state.csvText))
}

function feedUploadKey(feed) {
  return feed.map((item) => item.id).join('|')
}

function scheduleRecentActivityUpload(feed) {
  if (!isRecentActivityStoreEnabled() || !feed.length || isFirestorePermissionsDenied()) {
    return
  }

  const key = feedUploadKey(feed)

  if (key === lastUploadedFeedKey) {
    return
  }

  window.clearTimeout(uploadTimer)
  uploadTimer = window.setTimeout(() => {
    uploadTimer = null

    saveRecentActivityFeed(feed).then(() => {
      lastUploadedFeedKey = feedUploadKey(feed)
    })
  }, UPLOAD_DEBOUNCE_MS)
}

async function hydrateRecentActivityIfEmpty() {
  if (
    getMergedRecentActivities().length > 0 ||
    isHydrating ||
    hydrateAttempted ||
    isFirestorePermissionsDenied()
  ) {
    return
  }

  if (!isRecentActivityStoreEnabled()) {
    return
  }

  hydrateAttempted = true
  isHydrating = true
  recentActivitiesLoading = true
  notifySubscribers()

  try {
    const remote = await loadRecentActivityFeed()

    if (remote.length && getMergedRecentActivities().length === 0) {
      activityFeed = remote
      lastUploadedFeedKey = feedUploadKey(activityFeed)
      notifySubscribers()
    }
  } finally {
    isHydrating = false
    recentActivitiesLoading = false
    notifySubscribers()
  }
}

function applyMainCsv(main) {
  const parsed = parseCsvRows(main)
  const [headers = [], ...rows] = parsed
  const nextSnapshots = buildRowSnapshots(headers, rows)

  if (hasBaseline) {
    const newEvents = diffRowSnapshots(rowSnapshots, nextSnapshots)

    if (newEvents.length) {
      activityFeed = prependActivityFeed(activityFeed, newEvents, ACTIVITY_FEED_LIMIT)
      scheduleRecentActivityUpload(activityFeed)
    }
  }

  rowSnapshots = nextSnapshots
  hasBaseline = true

  state.csvText = main
  state.hash = hashCsv(main)
  state.headers = headers
  state.rows = rows
  state.counts = countStatusesFromCsv(main)
  state.lastUpdated = new Date()
  state.status = 'connected'
  state.source = getSheetSourceLabel()

  if (getMergedRecentActivities().length === 0) {
    hydrateRecentActivityIfEmpty()
  }
}

function applyTesterCsv(tester) {
  if (!isValidTesterActivityCsv(tester)) {
    return false
  }

  const nextHash = hashCsv(tester)

  if (nextHash === state.testerHash && state.testerCsvText) {
    state.testerLastUpdated = new Date()
    return false
  }

  state.testerCsvText = tester
  state.testerHash = nextHash
  state.testerLastUpdated = new Date()

  if (!state.status || state.status === 'idle') {
    state.status = 'connected'
  }

  return true
}

function buildSnapshot() {
  return {
    csvText: state.csvText,
    testerCsvText: state.testerCsvText,
    counts: state.counts,
    rows: state.rows,
    headers: state.headers,
    lastUpdated: state.lastUpdated,
    testerLastUpdated: state.testerLastUpdated,
    status: state.status,
    error: state.error,
    isRefreshing: state.isRefreshing,
    hasData: Boolean(state.csvText),
    hasTesterData: Boolean(state.testerCsvText),
    source: state.source,
    recentActivities: getMergedRecentActivities(),
    recentActivitiesLoading,
    recentActivityFirestoreBlocked: isFirestorePermissionsDenied(),
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

  if (inflightFetch) {
    return inflightFetch
  }

  const generation = fetchGeneration + 1
  fetchGeneration = generation

  state.isRefreshing = Boolean(state.csvText || state.testerCsvText)
  if (!state.csvText && !state.testerCsvText) {
    state.status = 'loading'
  }
  notifySubscribers()

  inflightFetch = fetchSheetData()
    .then((payload) => {
      if (generation !== fetchGeneration) {
        return
      }

      const main = typeof payload === 'string' ? payload : payload.main || ''
      const tester = typeof payload === 'string' ? '' : payload.tester || ''
      const mainValid = main ? isValidMainSheetCsv(main) : false
      const testerValid = tester ? isValidTesterActivityCsv(tester) : false

      if (!mainValid && !testerValid) {
        throw new Error('Sheet response was incomplete — keeping last good data')
      }

      let changed = false

      if (mainValid) {
        const nextMainHash = hashCsv(main)

        if (nextMainHash !== state.hash || !state.csvText) {
          applyMainCsv(main)
          changed = true
        } else {
          state.lastUpdated = new Date()
        }
      }

      if (testerValid && applyTesterCsv(tester)) {
        changed = true
      }

      if (!changed && (state.csvText || state.testerCsvText)) {
        state.lastUpdated = new Date()
        if (state.testerCsvText) {
          state.testerLastUpdated = new Date()
        }
      }

      state.error = null
    })
    .catch((error) => {
      if (generation !== fetchGeneration) {
        return
      }

      state.error = error
      if (!state.csvText && !state.testerCsvText) {
        state.status = 'error'
      }
    })
    .finally(() => {
      if (generation === fetchGeneration) {
        state.isRefreshing = false
        inflightFetch = null
        notifySubscribers()
      }
    })

  return inflightFetch
}

export function getDefaultPollMs() {
  if (sheetsApiKey) {
    return DEFAULT_POLL_MS
  }

  return PUBLISHED_CSV_POLL_MS
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

  hydrateRecentActivityIfEmpty()
  refreshSheet()

  const pollMs = Number.parseInt(import.meta.env.VITE_GOOGLE_SHEET_POLL_MS, 10) || getDefaultPollMs()
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
    window.clearTimeout(uploadTimer)
    uploadTimer = null
    fetchGeneration += 1
    inflightFetch = null
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

  if (snapshot.status === 'error' && !snapshot.hasData && !snapshot.hasTesterData) {
    return 'Unable to load Google Sheet'
  }

  if (snapshot.status === 'error') {
    return 'Offline'
  }

  return 'Live'
}
