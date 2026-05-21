import { useEffect, useMemo, useState } from 'react'
import './TesterActivity.css'

const sheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL

const columnAliases = {
  tester: ['tester', 'name', 'agent', 'tester name'],
  status: ['status', 'tester status', 'activity status'],
  location: ['current location', 'location', 'current_location', 'site', 'pws'],
  lastActivity: ['last activity', 'last activity time', 'last_activity', 'updated', 'last updated'],
}

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

function findColumnIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(header))
}

function mapSheetRows(csvText) {
  const rows = parseCsvRows(csvText)
  const [headers = [], ...records] = rows
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const indexes = {
    tester: findColumnIndex(normalizedHeaders, columnAliases.tester),
    status: findColumnIndex(normalizedHeaders, columnAliases.status),
    location: findColumnIndex(normalizedHeaders, columnAliases.location),
    lastActivity: findColumnIndex(normalizedHeaders, columnAliases.lastActivity),
  }

  if (indexes.tester === -1 && indexes.status === -1 && indexes.location === -1) {
    return []
  }

  return records
    .map((row, index) => ({
      id: `${row[indexes.tester] || 'tester'}-${index}`,
      tester: row[indexes.tester] || 'Unassigned',
      status: row[indexes.status] || 'Available',
      location: row[indexes.location] || 'No location',
      lastActivity: row[indexes.lastActivity] || '-',
    }))
    .filter((record) => record.tester !== 'Unassigned' || record.location !== 'No location')
}

function statusClassName(status) {
  const value = status.toLowerCase()

  if (value.includes('return')) return 'returning'
  if (value.includes('available') || value.includes('standby')) return 'available'
  if (value.includes('field') || value.includes('testing') || value.includes('active')) return 'field'

  return 'default'
}

function TesterActivity() {
  const [rows, setRows] = useState([])
  const [sheetState, setSheetState] = useState(sheetCsvUrl ? 'Loading sheet...' : 'No sheet connected yet')

  useEffect(() => {
    if (!sheetCsvUrl) {
      return
    }

    const controller = new AbortController()

    async function fetchTesterActivity() {
      try {
        const response = await fetch(sheetCsvUrl, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Sheet request failed: ${response.status}`)
        }

        const csvText = await response.text()
        setRows(mapSheetRows(csvText))
        setSheetState('Google Sheet connected')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSheetState('Unable to load Google Sheet')
        }
      }
    }

    fetchTesterActivity()

    return () => controller.abort()
  }, [])

  const visibleRows = useMemo(() => rows.slice(0, 8), [rows])

  return (
    <section className="tester-activity" aria-labelledby="tester-activity-title">
      <div className="ta-heading">
        <h2 id="tester-activity-title">Tester Activity  (Pure Green)</h2>
        <small>{sheetState}</small>
      </div>

      <div className="ta-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tester</th>
              <th>Status</th>
              <th>Current Location</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? (
              visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.tester}</td>
                  <td>
                    <span className={`ta-pill ${statusClassName(row.status)}`}>{row.status}</span>
                  </td>
                  <td>{row.location}</td>
                  <td>{row.lastActivity}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="ta-empty">No tester activity found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default TesterActivity
