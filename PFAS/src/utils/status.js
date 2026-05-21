import { findColumnIndex, parseCsvRows } from './csv.js'

export const STATUS_ORDER = [
  'Retainer',
  'Ordered',
  'Eurofins',
  'Outbound',
  'Pure Green Testers',
  'Inbound',
  'Invoice',
  'Test Results',
]

const STATUS_META = {
  Retainer: {
    tone: 'blue',
    color: '#0d72cf',
    icon: 'file-text',
    label: 'Retainer',
    description: 'New retainer agreement has been sent to us.',
  },
  Ordered: {
    tone: 'purple',
    color: '#9b60d8',
    icon: 'clipboard',
    label: 'Ordered',
    description: 'We will then order the test kits.',
  },
  Eurofins: {
    tone: 'blue',
    color: '#1d8cff',
    icon: 'building',
    label: 'Eurofins',
    description: 'Test kits are being prepared and will be shipped from Eurofins.',
  },
  Outbound: {
    tone: 'blue',
    color: '#075db8',
    icon: 'truck',
    label: 'Outbound (In Transit)',
    subtitle: '(In Transit)',
    description: 'Test kits are sent out to the site/utility for use or distribution.',
  },
  'Pure Green Testers': {
    tone: 'green',
    color: '#76b82a',
    icon: 'tester',
    label: 'Pure Green Testers',
    description:
      'Pure Green testers go to the site/utility to collect water samples for testing.',
  },
  Inbound: {
    tone: 'green',
    color: '#f28b16',
    icon: 'van',
    label: 'Inbound (In Transit)',
    subtitle: '(In Transit)',
    description: 'After the testing, test kits will be send back to eurofins from the utility.',
  },
  Invoice: {
    tone: 'blue',
    color: '#6d7a82',
    icon: 'expenses',
    label: 'Invoice',
    description: 'Invoice from Eurofins will be sent to us via email.',
  },
  'Test Results': {
    tone: 'green',
    color: '#21a5b5',
    icon: 'flask',
    label: 'Test Results',
    description: 'Test results are received and recorded.',
  },
}

const statusColumns = ['status', 'stage', 'test kit status', 'test_kit_status', 'test kit flow', 'flow']

const COLUMN_HEADER_ALIASES = {
  retainer: 'Retainer',
  ordered: 'Ordered',
  eurofins: 'Eurofins',
  outbound: 'Outbound',
  'pure green testers': 'Pure Green Testers',
  'pure green tester': 'Pure Green Testers',
  inbound: 'Inbound',
  invoice: 'Invoice',
  'test results': 'Test Results',
}

export function isCheckedValue(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'x'
}

export function mapHeaderToStatus(header) {
  const normalized = header.toLowerCase().trim()

  return COLUMN_HEADER_ALIASES[normalized] ?? ''
}

export function countStatusesFromColumns(records, headers) {
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const columnIndices = {}

  normalizedHeaders.forEach((header, index) => {
    const status = mapHeaderToStatus(header)

    if (status) {
      columnIndices[status] = index
    }
  })

  if (!Object.keys(columnIndices).length) {
    return null
  }

  return records.reduce((counts, row) => {
    for (const [status, index] of Object.entries(columnIndices)) {
      if (isCheckedValue(row[index])) {
        counts[status] = (counts[status] || 0) + 1
      }
    }

    return counts
  }, {})
}

export function normalizeStatus(value) {
  const status = value.toLowerCase().replace(/\s+/g, ' ').trim()

  if (status.includes('retainer')) return 'Retainer'
  if (status.includes('ordered') || status.includes('order')) return 'Ordered'
  if (status.includes('outbound')) return 'Outbound'
  if (status.includes('pure green') || status.includes('puregreen') || status.includes('tester')) {
    return 'Pure Green Testers'
  }
  if (status.includes('inbound') || status.includes('returning')) return 'Inbound'
  if (status.includes('invoice') || status.includes('payment')) return 'Invoice'
  if (status.includes('result') || status.includes('report')) return 'Test Results'
  if (status.includes('eurofins')) return 'Eurofins'

  return ''
}

export function countStatusesFromCsv(csvText) {
  const rows = parseCsvRows(csvText)
  const [headers = [], ...records] = rows

  console.log('[TestKitSummary] CSV parsed', {
    rowCount: records.length,
    headers,
  })

  const columnCounts = countStatusesFromColumns(records, headers)

  if (columnCounts) {
    console.log('[TestKitSummary] Column checkbox counts', columnCounts)
    console.log('[TestKitSummary] Retainer TRUE count', columnCounts.Retainer ?? 0)
    return columnCounts
  }

  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const statusIndex = findColumnIndex(normalizedHeaders, statusColumns)

  if (statusIndex === -1) {
    return {}
  }

  return records.reduce((counts, row) => {
    const status = normalizeStatus(row[statusIndex] || '')

    if (status) {
      counts[status] = (counts[status] || 0) + 1
    }

    return counts
  }, {})
}

export function buildSummaryRecords(counts) {
  return STATUS_ORDER.map((title) => {
    const meta = STATUS_META[title]

    return {
      title,
      subtitle: meta?.subtitle ?? '',
      count: counts[title] ?? 0,
      tone: meta?.tone ?? 'blue',
    }
  })
}

export function buildStatusBreakdownItems(counts) {
  return STATUS_ORDER.map((key) => {
    const meta = STATUS_META[key]

    return {
      key,
      label: meta?.label ?? key,
      color: meta?.color ?? '#385369',
      count: counts[key] ?? 0,
    }
  })
}

export function buildFlowSteps() {
  return STATUS_ORDER.map((title) => {
    const meta = STATUS_META[title]

    return {
      icon: meta?.icon ?? 'file-text',
      title,
      subtitle: meta?.subtitle ?? '',
      description: meta?.description ?? '',
      tone: meta?.tone ?? 'blue',
    }
  })
}
