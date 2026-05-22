const RECENT_KEY = 'pfas-fedex-recent-tracking-v1'
const MAX_RECENT = 12

function normalizeTrackingNumber(value) {
  return String(value ?? '').replace(/\s+/g, '').trim()
}

export function isLikelyTrackingNumber(value) {
  const normalized = normalizeTrackingNumber(value)
  return /^\d{10,22}$/.test(normalized)
}

export function loadRecentTrackingIds() {
  if (typeof localStorage === 'undefined') {
    return []
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeTrackingNumber).filter(Boolean) : []
  } catch {
    return []
  }
}

export function saveRecentTrackingId(trackingNumber) {
  const normalized = normalizeTrackingNumber(trackingNumber)

  if (!normalized || typeof localStorage === 'undefined') {
    return
  }

  const next = [normalized, ...loadRecentTrackingIds().filter((id) => id !== normalized)].slice(
    0,
    MAX_RECENT,
  )

  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

export function buildTrackingSuggestions(query) {
  const normalizedQuery = normalizeTrackingNumber(query).toLowerCase()
  const pool = new Set(loadRecentTrackingIds())

  if (normalizeTrackingNumber(query)) {
    pool.add(normalizeTrackingNumber(query))
  }

  const matches = [...pool].filter((id) => {
    if (!normalizedQuery) {
      return true
    }

    return id.toLowerCase().includes(normalizedQuery)
  })

  matches.sort((left, right) => {
    const leftExact = left.toLowerCase() === normalizedQuery
    const rightExact = right.toLowerCase() === normalizedQuery

    if (leftExact !== rightExact) {
      return leftExact ? -1 : 1
    }

    return left.localeCompare(right)
  })

  return matches.slice(0, 8)
}
