import { useMemo } from 'react'
import { findColumnIndex, parseCsvRows } from '../utils/csv.js'
import { useSheetData } from '../utils/useSheetData.js'
import './TesterActivity.css'

const columnAliases = {
  tester: ['tester', 'name', 'agent', 'tester name'],
  status: ['status', 'tester status', 'activity status'],
  location: ['current location', 'location', 'current_location', 'site', 'pws'],
  lastActivity: ['last activity', 'last activity time', 'last_activity', 'updated', 'last updated'],
}

function mapSheetRows(csvText) {
  if (!csvText) {
    return []
  }

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
      tester: row[indexes.tester] || '',
      status: row[indexes.status] || '',
      location: row[indexes.location] || '',
      lastActivity: row[indexes.lastActivity] || '',
    }))
    .filter((record) => record.tester || record.status || record.location || record.lastActivity)
}

function statusClassName(status) {
  const value = status.toLowerCase()

  if (value.includes('return')) return 'returning'
  if (value.includes('available') || value.includes('standby')) return 'available'
  if (value.includes('field') || value.includes('testing') || value.includes('active')) return 'field'

  return 'default'
}

function TesterActivity() {
  const { csvText, sheetState } = useSheetData()
  const rows = useMemo(() => mapSheetRows(csvText), [csvText])
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
                  <td>{row.tester || '-'}</td>
                  <td>
                    {row.status ? (
                      <span className={`ta-pill ${statusClassName(row.status)}`}>{row.status}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{row.location || '-'}</td>
                  <td>{row.lastActivity || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="ta-empty">
                  No tester activity found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default TesterActivity
