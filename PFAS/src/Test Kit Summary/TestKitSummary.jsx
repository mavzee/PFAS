import { useEffect, useMemo, useState } from 'react'
import './TestKitSummary.css'

const summaryRecords = [
  {
    title: 'Retainer',
    subtitle: '',
    defaultCount: 1,
    note: 'Retainers',
    tone: 'blue',
  },
  {
    title: 'Ordered',
    subtitle: '',
    note: 'Test kits ordered',
    tone: 'purple',
  },
  {
    title: 'Eurofins',
    subtitle: '',
    note: 'Kits prepared & shipped.',
    tone: 'blue',
  },
  {
    title: 'Outbound',
    subtitle: '(In Transit)',
    note: 'Kits sent to site.',
    tone: 'blue',
  },
  {
    title: 'Pure Green Testers',
    subtitle: '',
    note: 'Sample collection by testers.',
    tone: 'green',
  },
  {
    title: 'Inbound',
    subtitle: '(In Transit)',
    note: 'Samples received.',
    tone: 'green',
  },
  {
    title: 'Invoice',
    subtitle: '',
    note: 'Invoice sent via email',
    tone: 'blue',
  },
  {
    title: 'Test Results',
    subtitle: '',
    note: ' ',
    tone: 'green',
  },
]

const sheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL
const statusColumns = ['status', 'stage', 'test kit status', 'test_kit_status', 'test kit flow', 'flow']

function parseCsvRows(csvText) {
  const rows = []
  let cell = ''
  let row = []
  let insideQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const nextChar = csvText[index + 1]

    if (char === '"' && nextChar === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      insideQuotes = !insideQuotes
    } else if (char === ',' && !insideQuotes) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }

      row.push(cell.trim())
      if (row.some(Boolean)) {
        rows.push(row)
      }
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell.trim())
  if (row.some(Boolean)) {
    rows.push(row)
  }

  return rows
}

function normalizeStatus(value) {
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

function countSheetStatuses(csvText) {
  const rows = parseCsvRows(csvText)
  const [headers = [], ...records] = rows
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const statusIndex = normalizedHeaders.findIndex((header) => statusColumns.includes(header))

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

function TestKitSummary() {
  const [counts, setCounts] = useState({})
  const [sheetState, setSheetState] = useState(sheetCsvUrl ? 'Loading sheet...' : 'No sheet connected yet')

  useEffect(() => {
    if (!sheetCsvUrl) {
      return
    }

    const controller = new AbortController()

    async function fetchSheetRecords() {
      try {
        const response = await fetch(sheetCsvUrl, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Sheet request failed: ${response.status}`)
        }

        const csvText = await response.text()
        setCounts(countSheetStatuses(csvText))
        setSheetState('Google Sheet connected')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSheetState('Unable to load Google Sheet')
        }
      }
    }

    fetchSheetRecords()

    return () => controller.abort()
  }, [])

  const records = useMemo(
    () =>
      summaryRecords.map((record) => ({
        ...record,
        count: counts[record.title] ?? record.defaultCount ?? 0,
      })),
    [counts],
  )

  const total = records.reduce((sum, record) => sum + record.count, 0)

  return (
    <section className="test-kit-summary" aria-labelledby="test-kit-summary-title">
      <div className="tks-heading">
        <h2 id="test-kit-summary-title">Test Kit Summary</h2>
        <div>
          <span>{total} total records</span>
          <small>{sheetState}</small>
        </div>
      </div>

      <div className="tks-grid">
        {records.map((record) => (
          <article className={`tks-card tks-${record.tone}`} key={record.title}>
            <span className="tks-label">
              {record.title}
              {record.subtitle && <small>{record.subtitle}</small>}
            </span>
            <strong>{record.count}</strong>
            <p>{record.note}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default TestKitSummary
