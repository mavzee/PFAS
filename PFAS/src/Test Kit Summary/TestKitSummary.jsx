import { useEffect, useMemo, useState } from 'react'
import { buildSummaryRecords, countStatusesFromCsv } from '../utils/status.js'
import { fetchSheetCsv, sheetCsvUrl } from '../utils/sheet.js'
import './TestKitSummary.css'

function TestKitSummary() {
  const [counts, setCounts] = useState({})
  const [sheetState, setSheetState] = useState(sheetCsvUrl ? 'Loading sheet...' : 'No sheet connected yet')

  useEffect(() => {
    console.log('[TestKitSummary] sheetCsvUrl', sheetCsvUrl || '(empty — set VITE_GOOGLE_SHEET_CSV_URL in .env)')

    if (!sheetCsvUrl) {
      return undefined
    }

    const controller = new AbortController()

    async function fetchSheetRecords() {
      try {
        console.log('[TestKitSummary] Fetching sheet CSV...')
        const csvText = await fetchSheetCsv(controller.signal)
        console.log('[TestKitSummary] CSV received', {
          length: csvText.length,
          preview: csvText.slice(0, 200),
        })
        const nextCounts = countStatusesFromCsv(csvText)
        console.log('[TestKitSummary] Final counts for UI', nextCounts)
        setCounts(nextCounts)
        setSheetState('Google Sheet connected')
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('[TestKitSummary] Sheet load failed', error)
          setCounts({})
          setSheetState('Unable to load Google Sheet')
        }
      }
    }

    fetchSheetRecords()

    return () => controller.abort()
  }, [])

  const records = useMemo(() => buildSummaryRecords(counts), [counts])
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
          </article>
        ))}
      </div>
    </section>
  )
}

export default TestKitSummary
