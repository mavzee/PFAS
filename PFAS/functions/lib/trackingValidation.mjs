export function normalizeTrackingNumber(value) {
  return String(value ?? '').replace(/\s+/g, '').trim()
}

export function isLikelyTrackingNumber(value) {
  const normalized = normalizeTrackingNumber(value)
  return /^\d{10,22}$/.test(normalized)
}
