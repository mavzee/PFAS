import { findColumnIndex, parseCsvRows } from './csv.js'
import {
  isCheckedValue,
  mapHeaderToStatus,
  normalizeStatus,
  parseEurofinsCell,
  STATUS_ORDER,
} from './status.js'

export const ACTIVITY_FEED_LIMIT = 50

const labelAliases = [
  'company name',
  'company',
  'utility',
  'pws',
  'water system',
  'site',
  'location',
]

const recordIdAliases = ['record id', 'record_id', 'id']

const statusColumns = ['status', 'stage', 'test kit status', 'test_kit_status', 'test kit flow', 'flow']

const manualColumnAliases = {
  activity: ['activity', 'recent activity', 'event', 'description', 'notes', 'update'],
  status: ['status', 'stage', 'test kit status', 'flow'],
  location: ['location', 'current location', 'site', 'pws'],
  time: ['time', 'last activity', 'last activity time', 'updated', 'last updated', 'date'],
}

function formatNow() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function activityType(value) {
  const text = value.toLowerCase()

  if (text.includes('ship') || text.includes('outbound') || text.includes('inbound')) return 'shipping'
  if (text.includes('order')) return 'order'
  if (text.includes('result') || text.includes('report')) return 'results'
  if (text.includes('invoice') || text.includes('payment')) return 'invoice'

  return 'update'
}

function parseActivityTime(timeStr) {
  if (!timeStr?.trim()) {
    return 0
  }

  const parsed = Date.parse(`${new Date().toDateString()} ${timeStr.trim()}`)

  return Number.isNaN(parsed) ? 0 : parsed
}

function resolveColumnIndices(normalizedHeaders) {
  const statusColumnIndices = {}

  normalizedHeaders.forEach((header, index) => {
    const status = mapHeaderToStatus(header)

    if (status) {
      statusColumnIndices[status] = index
    }
  })

  return {
    label: findColumnIndex(normalizedHeaders, labelAliases),
    recordId: findColumnIndex(normalizedHeaders, recordIdAliases),
    status: findColumnIndex(normalizedHeaders, statusColumns),
    statusColumnIndices,
    hasCheckboxColumns: Object.keys(statusColumnIndices).length > 0,
  }
}

export function buildRowSnapshots(headers, rows) {
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const columns = resolveColumnIndices(normalizedHeaders)
  const snapshots = new Map()

  rows.forEach((row, rowIndex) => {
    const recordId = columns.recordId >= 0 ? (row[columns.recordId] || '').trim() : ''
    const companyName = columns.label >= 0 ? (row[columns.label] || '').trim() : ''
    const key = recordId || `${companyName || `Row ${rowIndex + 1}`}::${rowIndex}`
    const label = companyName || recordId || `Row ${rowIndex + 1}`
    const checks = Object.fromEntries(STATUS_ORDER.map((stage) => [stage, false]))
    let eurofins = ''

    if (columns.hasCheckboxColumns) {
      for (const [stage, index] of Object.entries(columns.statusColumnIndices)) {
        if (stage === 'Eurofins') {
          eurofins = parseEurofinsCell(row[index])
        } else {
          checks[stage] = isCheckedValue(row[index])
        }
      }
    }

    let status = ''

    if (columns.status >= 0) {
      status = normalizeStatus(row[columns.status] || '')
    }

    snapshots.set(key, {
      key,
      label,
      checks,
      eurofins,
      status,
      hasCheckboxColumns: columns.hasCheckboxColumns,
      rowIndex,
    })
  })

  return snapshots
}

function pushEurofinsEvents(events, label, key, was, now, at, time) {
  if (was === now) {
    return
  }

  const text = now
    ? `${label} updated Eurofins to ${now}`
    : `${label} cleared Eurofins`

  events.push({
    id: `${key}-eurofins-${at}-${events.length}`,
    text,
    time,
    type: activityType(`eurofins ${now}`),
    at,
  })
}

function pushCheckboxEvents(events, label, key, stage, was, now, at, time) {
  if (was === now) {
    return
  }

  const verb = now ? 'checked' : 'unchecked'
  const text = `${label} ${verb} ${stage}`

  events.push({
    id: `${key}-${stage}-${verb}-${at}-${events.length}`,
    text,
    time,
    type: activityType(`${verb} ${stage}`),
    at,
  })
}

export function diffRowSnapshots(previous, next) {
  const events = []
  const at = Date.now()
  const time = formatNow()
  const keys = new Set([...previous.keys(), ...next.keys()])

  for (const key of keys) {
    const prev = previous.get(key)
    const curr = next.get(key)
    const label = curr?.label || prev?.label || key

    if (prev && curr) {
      if (curr.hasCheckboxColumns) {
        pushEurofinsEvents(events, label, key, prev.eurofins ?? '', curr.eurofins ?? '', at, time)

        for (const stage of STATUS_ORDER) {
          if (stage === 'Eurofins') {
            continue
          }

          pushCheckboxEvents(
            events,
            label,
            key,
            stage,
            prev.checks[stage] ?? false,
            curr.checks[stage] ?? false,
            at,
            time,
          )
        }
      } else if (prev.status !== curr.status && curr.status) {
        const text = `${label} updated to ${curr.status}`

        events.push({
          id: `${key}-status-${at}-${events.length}`,
          text,
          time,
          type: activityType(curr.status),
          at,
        })
      }

      continue
    }

    if (!curr || prev) {
      continue
    }

    if (curr.hasCheckboxColumns) {
      if (curr.eurofins) {
        pushEurofinsEvents(events, label, key, '', curr.eurofins, at, time)
      }

      for (const stage of STATUS_ORDER) {
        if (stage === 'Eurofins') {
          continue
        }

        if (curr.checks[stage]) {
          pushCheckboxEvents(events, label, key, stage, false, true, at, time)
        }
      }
    } else if (curr.status) {
      const text = `${label} updated to ${curr.status}`

      events.push({
        id: `${key}-status-new-${at}-${events.length}`,
        text,
        time,
        type: activityType(curr.status),
        at,
      })
    }
  }

  return events
}

export function mapManualActivities(csvText) {
  if (!csvText) {
    return []
  }

  const rows = parseCsvRows(csvText)
  const [headers = [], ...records] = rows
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const indexes = {
    activity: findColumnIndex(normalizedHeaders, manualColumnAliases.activity),
    status: findColumnIndex(normalizedHeaders, manualColumnAliases.status),
    location: findColumnIndex(normalizedHeaders, manualColumnAliases.location),
    time: findColumnIndex(normalizedHeaders, manualColumnAliases.time),
  }

  return records
    .map((row, index) => {
      const activity = row[indexes.activity] || ''
      const status = row[indexes.status] || ''
      const location = row[indexes.location] || ''
      const text = activity || [status, location].filter(Boolean).join(' update for ')
      const time = row[indexes.time] || ''

      if (!text) {
        return null
      }

      return {
        id: `manual-${text}-${index}`,
        text,
        time,
        type: activityType(`${activity} ${status}`),
        at: parseActivityTime(time),
        source: 'manual',
      }
    })
    .filter(Boolean)
}

export function mergeActivities(detectedFeed, manual, limit = ACTIVITY_FEED_LIMIT) {
  const merged = [...detectedFeed, ...manual]
  merged.sort((left, right) => right.at - left.at)

  return merged.slice(0, limit)
}

export function prependActivityFeed(feed, events, limit = ACTIVITY_FEED_LIMIT) {
  if (!events.length) {
    return feed
  }

  return [...events, ...feed].slice(0, limit)
}
