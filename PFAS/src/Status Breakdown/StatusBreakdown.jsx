import { useEffect, useMemo, useState } from 'react'
import './StatusBreakdown.css'

const statuses = [
  {
    key: 'Retainer',
    label: 'Retainer',
    color: '#0d72cf',
  },
  {
    key: 'Ordered',
    label: 'Ordered',
    color: '#9b60d8',
  },
  {
    key: 'Eurofins',
    label: 'Eurofins',
    color: '#1d8cff',
  },
  {
    key: 'Outbound',
    label: 'Outbound (In Transit)',
    color: '#075db8',
  },
  {
    key: 'Pure Green Testers',
    label: 'Pure Green Testers',
    color: '#76b82a',
  },
  {
    key: 'Inbound',
    label: 'Inbound (In Transit)',
    color: '#f28b16',
  },
  {
    key: 'Invoice',
    label: 'Invoice',
    color: '#6d7a82',
  },
  {
    key: 'Test Results',
    label: 'Test Results',
    color: '#21a5b5',
  },
]

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

function readSummaryCounts() {
  const summaryCards = document.querySelectorAll('.test-kit-summary .tks-card')

  return Array.from(summaryCards).reduce((nextCounts, card) => {
    const label = card.querySelector('.tks-label')
    const title = label?.childNodes[0]?.textContent?.trim()
    const count = Number.parseInt(card.querySelector('strong')?.textContent || '0', 10)

    if (title) {
      nextCounts[title] = Number.isNaN(count) ? 0 : count
    }

    return nextCounts
  }, {})
}

function StatusBreakdown() {
  const [counts, setCounts] = useState({})
  const [sheetState, setSheetState] = useState('Syncing with Test Kit Summary')

  useEffect(() => {
    function syncFromSummary() {
      const nextCounts = readSummaryCounts()
      setCounts(nextCounts)
      setSheetState(
        Object.keys(nextCounts).length ? 'Synced with Test Kit Summary' : 'Waiting for Test Kit Summary',
      )
    }

    syncFromSummary()

    const summary = document.querySelector('.test-kit-summary')
    if (!summary) {
      const timeoutId = window.setTimeout(syncFromSummary, 0)
      return () => window.clearTimeout(timeoutId)
    }

    const observer = new MutationObserver(syncFromSummary)
    observer.observe(summary, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  const items = useMemo(
    () =>
      statuses.map((status) => ({
        ...status,
        count: counts[status.key] || 0,
      })),
    [counts],
  )

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
