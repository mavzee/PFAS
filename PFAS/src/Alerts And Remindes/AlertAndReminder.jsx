import { useMemo } from 'react'
import { findColumnIndex, parseCsvRows } from '../utils/csv.js'
import { buildStageReminders, MAX_VISIBLE_ALERTS } from '../utils/stageReminders.js'
import { countUncheckedFromCsv } from '../utils/status.js'
import { useSheetData } from '../utils/useSheetData.js'
import './AlertAndReminder.css'

const columnAliases = {
  alert: ['alert', 'reminder', 'notification', 'message', 'notes'],
  type: ['type', 'priority', 'severity', 'alert type'],
  time: ['time', 'date', 'updated', 'last updated'],
}

function normalizeType(value) {
  const type = value.toLowerCase()

  if (type.includes('warn') || type.includes('overdue') || type.includes('urgent')) return 'warning'
  if (type.includes('remind') || type.includes('follow')) return 'reminder'

  return 'info'
}

function mapAlerts(csvText) {
  if (!csvText) {
    return []
  }

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

function mergeAlerts(csvText) {
  const manual = mapAlerts(csvText)
  const unchecked = countUncheckedFromCsv(csvText)
  const auto = buildStageReminders(unchecked ?? {})
  const seen = new Set(manual.map((alert) => alert.message))
  const dedupedAuto = auto.filter((alert) => !seen.has(alert.message))

  return [...manual, ...dedupedAuto].slice(0, MAX_VISIBLE_ALERTS)
}

function AlertAndReminder() {
  const { csvText, sheetState } = useSheetData()
  const visibleAlerts = useMemo(() => mergeAlerts(csvText), [csvText])

  return (
    <section className="alert-reminder" aria-labelledby="alert-reminder-title">
      <div className="ar-heading">
        <h2 id="alert-reminder-title">Alerts &amp; Reminders</h2>
        <small>{sheetState}</small>
      </div>

      <ul className="ar-list">
        {visibleAlerts.length ? (
          visibleAlerts.map((alert) => (
            <li className={alert.type} key={alert.id}>
              <span className="ar-icon" aria-hidden="true" />
              <p>
                {alert.message}
                {alert.time && <time>{alert.time}</time>}
              </p>
            </li>
          ))
        ) : (
          <li className="ar-empty">
            <p>No alerts available</p>
          </li>
        )}
      </ul>
    </section>
  )
}

export default AlertAndReminder
