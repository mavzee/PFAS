import { useEffect, useMemo, useState } from 'react'
import './RecentActivity.css'

const sheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL

const columnAliases = {
  activity: ['activity', 'recent activity', 'event', 'description', 'notes', 'update'],
  status: ['status', 'stage', 'test kit status', 'flow'],
  location: ['location', 'current location', 'site', 'pws'],
  time: ['time', 'last activity', 'last activity time', 'updated', 'last updated', 'date'],
}

const fallbackActivities = [
  {
    id: 'fallback-results',
    type: 'results',
    text: 'Test results activity will appear here after sheet sync',
    time: 'Pending sheet',
  },
]

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

function activityType(value) {
  const text = value.toLowerCase()

  if (text.includes('ship') || text.includes('outbound') || text.includes('inbound')) return 'shipping'
  if (text.includes('order')) return 'order'
  if (text.includes('result') || text.includes('report')) return 'results'
  if (text.includes('invoice') || text.includes('payment')) return 'invoice'

  return 'update'
}

function mapActivities(csvText) {
  const rows = parseCsvRows(csvText)
  const [headers = [], ...records] = rows
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const indexes = {
    activity: findColumnIndex(normalizedHeaders, columnAliases.activity),
    status: findColumnIndex(normalizedHeaders, columnAliases.status),
    location: findColumnIndex(normalizedHeaders, columnAliases.location),
    time: findColumnIndex(normalizedHeaders, columnAliases.time),
  }

  return records
    .map((row, index) => {
      const activity = row[indexes.activity] || ''
      const status = row[indexes.status] || ''
      const location = row[indexes.location] || ''
      const text = activity || [status, location].filter(Boolean).join(' update for ')

      return {
        id: `${text || 'activity'}-${index}`,
        type: activityType(`${activity} ${status}`),
        text,
        time: row[indexes.time] || '-',
      }
    })
    .filter((record) => record.text)
}

function RecentActivity() {
  const [activities, setActivities] = useState([])
  const [sheetState, setSheetState] = useState(sheetCsvUrl ? 'Loading sheet...' : 'No sheet connected yet')

  useEffect(() => {
    if (!sheetCsvUrl) {
      return
    }

    const controller = new AbortController()

    async function fetchRecentActivity() {
      try {
        const response = await fetch(sheetCsvUrl, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Sheet request failed: ${response.status}`)
        }

        const csvText = await response.text()
        setActivities(mapActivities(csvText))
        setSheetState('Google Sheet connected')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSheetState('Unable to load Google Sheet')
        }
      }
    }

    fetchRecentActivity()

    return () => controller.abort()
  }, [])

  const visibleActivities = useMemo(
    () => (activities.length ? activities : fallbackActivities).slice(0, 7),
    [activities],
  )

  return (
    <section className="recent-activity" aria-labelledby="recent-activity-title">
      <div className="ra-heading">
        <h2 id="recent-activity-title">Recent Activity</h2>
        <small>{sheetState}</small>
      </div>

      <ul className="ra-list">
        {visibleActivities.map((activity) => (
          <li key={activity.id}>
            <span className={`ra-icon ${activity.type}`} aria-hidden="true" />
            <p>{activity.text}</p>
            <time>{activity.time}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default RecentActivity
