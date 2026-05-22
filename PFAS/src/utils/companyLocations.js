import { findColumnIndex, parseCsvRows } from './csv.js'
import {
  hydrateCompanyLocationCache,
  saveCompanyLocationCache,
} from './companyLocationsStore.js'
import { labelAliases } from './recentActivity.js'

const GEOCODE_CACHE_KEY = 'pfas-geocode-cache-v1'
const GEOCODE_DELAY_MS = 1_100
const FIRESTORE_SAVE_DEBOUNCE_MS = 1_500
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'PFAS-Dashboard/1.0'

const geocodeCountry = import.meta.env.VITE_GEOCODE_COUNTRY?.trim().toLowerCase() || ''

const memoryCache = new Map()
let firestoreSaveTimer = null

function normalizeName(name) {
  return name.trim().toLowerCase()
}

function loadPersistedCache() {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY)

    if (!raw) {
      return
    }

    const parsed = JSON.parse(raw)

    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        memoryCache.set(key, value ?? null)
      }
    }
  } catch {
    // ignore corrupt cache
  }
}

function persistLocalCache() {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    const payload = Object.fromEntries(memoryCache.entries())
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

function cacheEntriesObject() {
  return Object.fromEntries(memoryCache.entries())
}

function scheduleFirestoreSave() {
  if (firestoreSaveTimer) {
    clearTimeout(firestoreSaveTimer)
  }

  firestoreSaveTimer = setTimeout(() => {
    firestoreSaveTimer = null
    void saveCompanyLocationCache(cacheEntriesObject())
  }, FIRESTORE_SAVE_DEBOUNCE_MS)
}

function persistCache() {
  persistLocalCache()
  scheduleFirestoreSave()
}

export function applyGeocodeCacheEntries(entries) {
  if (!entries || typeof entries !== 'object') {
    return
  }

  for (const [key, value] of Object.entries(entries)) {
    const normalizedKey = normalizeName(key)

    if (!normalizedKey) {
      continue
    }

    memoryCache.set(normalizedKey, value ?? null)
  }

  persistLocalCache()
}

loadPersistedCache()

export async function ensureGeocodeCacheHydrated() {
  return hydrateCompanyLocationCache(applyGeocodeCacheEntries)
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timer = setTimeout(resolve, ms)

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

export function mapCompanyNames(csvText) {
  if (!csvText?.trim()) {
    return []
  }

  const rows = parseCsvRows(csvText)
  const [headers = [], ...dataRows] = rows

  if (!headers.length) {
    return []
  }

  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const labelIndex = findColumnIndex(normalizedHeaders, labelAliases)

  if (labelIndex < 0) {
    return []
  }

  const seen = new Set()
  const companies = []

  dataRows.forEach((row, rowIndex) => {
    const name = (row[labelIndex] || '').trim()

    if (!name) {
      return
    }

    const key = normalizeName(name)

    if (seen.has(key)) {
      return
    }

    seen.add(key)
    companies.push({
      id: `${key}-${rowIndex}`,
      name,
      key,
    })
  })

  return companies
}

function companyToPin(company, coords) {
  return {
    id: company.id,
    name: company.name,
    lat: coords.lat,
    lng: coords.lng,
    displayName: coords.displayName,
  }
}

export function buildPinsFromCache(companies) {
  const pins = []
  let failedCount = 0
  let pendingCount = 0

  for (const company of companies) {
    if (!memoryCache.has(company.key)) {
      pendingCount += 1
      continue
    }

    const coords = memoryCache.get(company.key)

    if (coords) {
      pins.push(companyToPin(company, coords))
    } else {
      failedCount += 1
    }
  }

  return { pins, failedCount, pendingCount }
}

export async function geocodeCompanyName(name, signal) {
  const key = normalizeName(name)

  if (memoryCache.has(key)) {
    return memoryCache.get(key)
  }

  const params = new URLSearchParams({
    format: 'json',
    limit: '1',
    q: name,
  })

  if (geocodeCountry) {
    params.set('countrycodes', geocodeCountry)
  }

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  })

  if (!response.ok) {
    throw new Error(`Geocode failed (${response.status})`)
  }

  const results = await response.json()
  const hit = results[0]

  const result = hit
    ? {
        lat: Number.parseFloat(hit.lat),
        lng: Number.parseFloat(hit.lon),
        displayName: hit.display_name || name,
      }
    : null

  memoryCache.set(key, result)
  persistCache()

  return result
}

export async function resolveCompanyPins(companies, { signal, onProgress } = {}) {
  await ensureGeocodeCacheHydrated()

  const pins = []
  let failedCount = 0
  let needsDelay = false

  for (let index = 0; index < companies.length; index += 1) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const company = companies[index]
    const cached = memoryCache.get(company.key)

    if (needsDelay && cached === undefined) {
      await delay(GEOCODE_DELAY_MS, signal)
    }

    let coords = cached

    if (coords === undefined) {
      try {
        coords = await geocodeCompanyName(company.name, signal)
        needsDelay = true
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw error
        }

        coords = null
        memoryCache.set(company.key, null)
        persistCache()
        needsDelay = true
      }
    }

    if (coords) {
      pins.push(companyToPin(company, coords))
    } else {
      failedCount += 1
    }

    onProgress?.({
      completed: index + 1,
      total: companies.length,
      pins: [...pins],
      failedCount,
    })
  }

  void saveCompanyLocationCache(cacheEntriesObject())

  return { pins, failedCount }
}
