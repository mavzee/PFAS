import { useEffect, useMemo, useState } from 'react'
import './AlertAndReminder.css'

const sheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL

const columnAliases = {
  alert: ['alert', 'reminder', 'notification', 'message', 'notes'],
  type: ['type', 'priority', 'severity', 'alert type'],
  time: ['time', 'date', 'updated', 'last updated'],
}

const fallbackAlerts = [
  {
    id: 'overdue',
    type: 'warning',
    message: '3 locations have test kits overdue for return.',
    time: 'Now',
  },
  {
    id: 'approval',
    type: 'info',
    message: 'Order pending approval for 2 locations.',
    time: 'Today',
  },
  {
    id: 'results',
    type: 'reminder',
    message: '5 test kits need results update.',
    time: 'Today',
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

function normalizeType(value) {
  const type = value.toLowerCase()

  if (type.includes('warn') || type.includes('overdue') || type.includes('urgent')) return 'warning'
  if (type.includes('remind') || type.includes('follow')) return 'reminder'

  return 'info'
}

function mapAlerts(csvText) {
  const rows = parseCsvRows(csvText)
  const [headers = [], ...records] = rows
  const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())
  const indexes = {
    alert: findColumnIndex(normalizedHeaders, columnAliases.alert),
    type: findColumnIndex(normalizedHeaders, columnAliases.type),
    time: findColumnIndex(normalizedHeaders, columnAliases.time),
  }

  if (indexes.alert === -1) {
    return []
  }

  return records
    .map((row, index) => {
      const message = row[indexes.alert] || ''
      const typeText = row[indexes.type] || message

      return {
        id: `${message || 'alert'}-${index}`,
        type: normalizeType(typeText),
        message,
        time: row[indexes.time] || '',
      }
    })
    .filter((alert) => alert.message)
}

function AlertAndReminder() {
  const [alerts, setAlerts] = useState([])
  const [sheetState, setSheetState] = useState(sheetCsvUrl ? 'Loading sheet...' : 'No sheet connected yet')

  useEffect(() => {
    if (!sheetCsvUrl) {
      return
    }

    const controller = new AbortController()

    async function fetchAlerts() {
      try {
        const response = await fetch(sheetCsvUrl, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Sheet request failed: ${response.status}`)
        }

        const csvText = await response.text()
        setAlerts(mapAlerts(csvText))
        setSheetState('Google Sheet connected')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSheetState('Unable to load Google Sheet')
        }
      }
    }

    fetchAlerts()

    return () => controller.abort()
  }, [])

  const visibleAlerts = useMemo(
    () => (alerts.length ? alerts : fallbackAlerts).slice(0, 5),
    [alerts],
  )

  return (
    <section className="alert-reminder" aria-labelledby="alert-reminder-title">
      <div className="ar-heading">
        <h2 id="alert-reminder-title">Alerts &amp; Reminders</h2>
        <small>{sheetState}</small>
      </div>

      <ul className="ar-list">
        {visibleAlerts.map((alert) => (
          <li className={alert.type} key={alert.id}>
            <span className="ar-icon" aria-hidden="true" />
            <p>
              {alert.message}
              {alert.time && <time>{alert.time}</time>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default AlertAndReminder
