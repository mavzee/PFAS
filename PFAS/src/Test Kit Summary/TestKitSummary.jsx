import { useMemo } from 'react'
import { buildSummaryRecords } from '../utils/status.js'
import { useSheetData } from '../utils/useSheetData.js'
import './TestKitSummary.css'

function TestKitSummary() {
  const { counts, sheetState } = useSheetData()
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
