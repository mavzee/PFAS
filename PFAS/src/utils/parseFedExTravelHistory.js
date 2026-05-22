function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Parse FedEx travel-history markup in the browser (tbody, table fragment, or full page HTML).
 */
export function parseFedExTravelHistoryHtml(html) {
  if (!html?.trim()) {
    return []
  }

  const wrapped = html.includes('<html') ? html : `<!DOCTYPE html><html><body>${html}</body></html>`
  const doc = new DOMParser().parseFromString(wrapped, 'text/html')
  const tbody =
    doc.querySelector('tbody.fdx-c-table__tbody--zebra') ||
    doc.querySelector('tbody.fdx-c-table__tbody')
  const rows = tbody
    ? tbody.querySelectorAll('tr.travel-history-table__row')
    : doc.querySelectorAll('tr.travel-history-table__row')
  const events = []
  let lastDate = ''

  rows.forEach((row, rowIndex) => {
    const dateCell = compactText(
      row.querySelector('.travel-history-table__scan-event-date')?.textContent,
    )

    if (dateCell) {
      lastDate = dateCell
    }

    const date = lastDate
    const scanEvents = row.querySelectorAll('.travel-history__scan-event')

    scanEvents.forEach((scanEvent, eventIndex) => {
      const status = compactText(
        scanEvent.querySelector('#status')?.textContent ||
          scanEvent.querySelector('.fdx-u-fontweight--medium')?.textContent,
      )

      let time = ''

      for (const span of scanEvent.querySelectorAll('span')) {
        const candidate = compactText(span.textContent)

        if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(candidate)) {
          time = candidate
          break
        }
      }

      let location = ''

      for (const item of scanEvent.querySelectorAll('.fdx-o-grid__item')) {
        const candidate = compactText(item.textContent)

        if (
          candidate &&
          candidate !== time &&
          candidate !== status &&
          candidate.includes(',') &&
          /[A-Z]{2}$/.test(candidate)
        ) {
          location = candidate
          break
        }
      }

      if (!status && !time) {
        return
      }

      events.push({
        id: `event-${rowIndex}-${eventIndex}`,
        date,
        time,
        description: status,
        location,
        isLatest: false,
      })
    })
  })

  if (events.length) {
    events[events.length - 1].isLatest = true
  }

  return events
}
