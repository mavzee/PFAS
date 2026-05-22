import { useMemo } from 'react'
import { buildStatusBreakdownItems } from '../utils/status.js'
import { useSheetData } from '../utils/useSheetData.js'
import './StatusBreakdown.css'

function makeChartGradient(items, total) {
  if (!total) {
    return 'conic-gradient(#385369 0 100%)'
  }

  let start = 0
  const segments = items.map((item) => {
    const end = start + (item.count / total) * 100
    const segment = `${item.color} ${start}% ${end}%`
    start = end
    return segment
  })

  return `conic-gradient(${segments.join(', ')})`
}

function StatusBreakdown() {
  const { counts, sheetState } = useSheetData()
  const items = useMemo(() => buildStatusBreakdownItems(counts), [counts])
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const chartGradient = makeChartGradient(items, total)

  return (
    <section className="status-breakdown" aria-labelledby="status-breakdown-title">
      <div className="sb-heading">
        <h2 id="status-breakdown-title">Status Breakdown</h2>
        <small>{sheetState}</small>
      </div>

      <div className="sb-content">
        <div className="sb-donut" style={{ '--chart-gradient': chartGradient }}>
          <strong>{total}</strong>
          <span>Total</span>
        </div>

        <ul className="sb-legend">
          {items.map((item) => {
            const percentage = total ? Math.round((item.count / total) * 100) : 0

            return (
              <li key={item.key}>
                <span className="sb-dot" style={{ '--dot-color': item.color }} />
                <p>{item.label}</p>
                <strong>{item.count}</strong>
                <em>({percentage}%)</em>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default StatusBreakdown
