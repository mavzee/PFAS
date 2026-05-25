import './TravelHistory.css'

function formatDateLabel(rawDate) {
  if (!rawDate?.trim()) {
    return ''
  }

  const parsed = Date.parse(rawDate)

  if (Number.isNaN(parsed)) {
    return rawDate
  }

  return new Date(parsed).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  })
}

function formatTimeLabel(rawTime) {
  if (!rawTime?.trim()) {
    return ''
  }

  if (/am|pm/i.test(rawTime)) {
    return rawTime
  }

  const match = rawTime.match(/^(\d{1,2}):(\d{2})/)

  if (!match) {
    return rawTime
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = match[2]
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12

  return `${hour12}:${minutes} ${period}`
}

function groupEventsByDate(events) {
  const groups = []
  let current = null

  events.forEach((event) => {
    const dateLabel = formatDateLabel(event.date) || event.date || 'Unknown date'

    if (!current || current.dateLabel !== dateLabel) {
      current = { dateLabel, events: [] }
      groups.push(current)
    }

    current.events.push(event)
  })

  return groups
}

function TravelHistory({ trackingNumber, status = '', events = [] }) {
  if (!events.length) {
    return (
      <div className="travel-history-status-wrap">
        <p className="travel-history-status travel-history-pending">
          Travel history will appear here.
        </p>
      </div>
    )
  }

  const groups = groupEventsByDate(events)

  return (
    <div className="travel-history">
      <div className="travel-history-meta">
        <span className="travel-history-tracking">{trackingNumber}</span>
        {status ? <span className="travel-history-status-pill">{status}</span> : null}
      </div>
      <div className="travel-history-table" role="table" aria-label={`Travel history for ${trackingNumber}`}>
        {groups.map((group, groupIndex) => (
          <div
            className={`travel-history-day ${groupIndex % 2 === 1 ? 'is-alt' : ''}`}
            key={group.dateLabel}
          >
            {group.events.map((event, eventIndex) => (
              <div className="travel-history-row" role="row" key={event.id || `${group.dateLabel}-${eventIndex}`}>
                <div className="travel-history-date" role="cell">
                  {eventIndex === 0 ? group.dateLabel : ''}
                </div>
                <div className="travel-history-time" role="cell">
                  {formatTimeLabel(event.time) || event.time}
                </div>
                <div className="travel-history-rail" role="cell" aria-hidden="true">
                  <span
                    className={
                      event.isLatest ? 'travel-history-marker is-latest' : 'travel-history-marker'
                    }
                  />
                </div>
                <div className="travel-history-copy" role="cell">
                  <strong>{event.description}</strong>
                  {event.location ? <span>{event.location}</span> : null}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default TravelHistory
