import { useEffect, useMemo, useState } from 'react'
import { findColumnIndex, parseCsvRows } from '../utils/csv.js'
import { fetchSheetCsv, sheetCsvUrl } from '../utils/sheet.js'
import './RecentActivity.css'

const columnAliases = {
  activity: ['activity', 'recent activity', 'event', 'description', 'notes', 'update'],
  status: ['status', 'stage', 'test kit status', 'flow'],
  location: ['location', 'current location', 'site', 'pws'],
  time: ['time', 'last activity', 'last activity time', 'updated', 'last updated', 'date'],
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
  if (!csvText) {
    return []
  }

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
        time: row[indexes.time] || '',
      }
    })
    .filter((record) => record.text)
}

function RecentActivity() {
  const [activities, setActivities] = useState([])
  const [sheetState, setSheetState] = useState(sheetCsvUrl ? 'Loading sheet...' : 'No sheet connected yet')

  useEffect(() => {
    if (!sheetCsvUrl) {
      return undefined
    }

    const controller = new AbortController()

    async function fetchRecentActivity() {
      try {
        const csvText = await fetchSheetCsv(controller.signal)
        setActivities(mapActivities(csvText))
        setSheetState('Google Sheet connected')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setActivities([])
          setSheetState('Unable to load Google Sheet')
        }
      }
    }

    fetchRecentActivity()

    return () => controller.abort()
  }, [])

  const visibleActivities = useMemo(() => activities.slice(0, 7), [activities])

  return (
    <section className="recent-activity" aria-labelledby="recent-activity-title">
      <div className="ra-heading">
        <h2 id="recent-activity-title">Recent Activity</h2>
        <small>{sheetState}</small>
      </div>

      <ul className="ra-list">
        {visibleActivities.length ? (
          visibleActivities.map((activity) => (
            <li key={activity.id}>
              <span className={`ra-icon ${activity.type}`} aria-hidden="true" />
              <p>{activity.text}</p>
              <time>{activity.time || '-'}</time>
            </li>
          ))
        ) : (
          <li className="ra-empty">
            <p>No recent activity available</p>
          </li>
        )}
      </ul>
    </section>
  )
}

export default RecentActivity
