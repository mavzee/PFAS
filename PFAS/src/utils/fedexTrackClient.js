export function buildFedExTrackPageUrl(trackingNumber) {
  const normalized = String(trackingNumber ?? '').replace(/\s+/g, '').trim()

  if (!normalized) {
    return ''
  }

  return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(normalized)}`
}

export function formatDateLabel(rawDate) {
  if (!rawDate?.trim()) {
    return ''
  }

  const parsed = Date.parse(rawDate)

  if (Number.isNaN(parsed)) {
    return rawDate
  }

  return new Date(parsed).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  })
}

export function formatTimeLabel(rawTime) {
  if (!rawTime?.trim()) {
    return ''
  }

  if (/am|pm/i.test(rawTime)) {
    return rawTime
  }

  const match = rawTime.match(/^(\d{1,2}):(\d{2})/)

  if (!match) {
    return rawTime
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = match[2]
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12

  return `${hour12}:${minutes} ${period}`
}
