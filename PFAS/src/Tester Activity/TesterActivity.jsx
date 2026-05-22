import { useMemo } from 'react'
import { mapTesterActivityRows, statusClassName } from '../utils/testerActivity.js'
import { useSheetData } from '../utils/useSheetData.js'
import './TesterActivity.css'

function TesterActivity() {
  const { testerCsvText, sheetState, hasTesterData } = useSheetData()
  const rows = useMemo(() => mapTesterActivityRows(testerCsvText), [testerCsvText])
  const visibleRows = useMemo(() => rows.slice(0, 8), [rows])

  return (
    <section className="tester-activity" aria-labelledby="tester-activity-title">
      <div className="ta-heading">
        <h2 id="tester-activity-title">Tester Activity  (Pure Green)</h2>
          <small>{hasTesterData ? sheetState : 'Loading...'}</small>
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
                  No tester data — publish the &quot;Tester Activity&quot; tab and set
                  VITE_GOOGLE_SHEET_TESTER_CSV_URL in .env (or add a Sheets API key)
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
