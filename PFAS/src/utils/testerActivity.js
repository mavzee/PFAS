import { findColumnIndex, parseCsvRows } from './csv.js'

const columnAliases = {
  tester: ['tester', 'name', 'agent', 'tester name'],
  status: ['status', 'tester status', 'activity status'],
  location: ['current location', 'location', 'current_location', 'site', 'pws'],
  lastActivity: ['last activity', 'last activity time', 'last_activity', 'updated', 'last updated'],
}

export function isValidTesterActivityCsv(csvText) {
  const trimmed = csvText?.trim()

  if (!trimmed || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return false
  }

  const rows = parseCsvRows(trimmed)
  const [headers = []] = rows
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())

  return (
    normalizedHeaders.some((header) => header === 'tester' || header.startsWith('tester')) &&
    rows.length > 1
  )
}

export function mapTesterActivityRows(csvText) {
  if (!csvText) {
    return []
  }

  const rows = parseCsvRows(csvText)
  const [headers = [], ...records] = rows
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const indexes = {
    tester: findColumnIndex(
      normalizedHeaders,
      columnAliases.tester.map((alias) => alias.trim()),
    ),
    status: findColumnIndex(normalizedHeaders, columnAliases.status),
    location: findColumnIndex(normalizedHeaders, columnAliases.location),
    lastActivity: findColumnIndex(normalizedHeaders, columnAliases.lastActivity),
  }

  if (indexes.tester === -1) {
    return []
  }

  return records
    .map((row, index) => ({
      id: `${row[indexes.tester] || 'tester'}-${index}`,
      tester: row[indexes.tester] || '',
      status: row[indexes.status] || '',
      location: row[indexes.location] || '',
      lastActivity: row[indexes.lastActivity] || '',
    }))
    .filter((record) => record.tester || record.status || record.location || record.lastActivity)
}

export function statusClassName(status) {
  const value = status.toLowerCase()

  if (value.includes('return')) return 'returning'
  if (value.includes('available') || value.includes('standby')) return 'available'
  if (value.includes('field') || value.includes('testing') || value.includes('active')) return 'field'

  return 'default'
}
