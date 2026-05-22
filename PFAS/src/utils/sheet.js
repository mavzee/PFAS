export const sheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL
export const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID
export const sheetsApiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY
export const sheetRange = import.meta.env.VITE_GOOGLE_SHEET_RANGE
export const sheetGid = import.meta.env.VITE_GOOGLE_SHEET_GID || '0'

let resolvedSheetTitle = null

export function hasSheetConnection() {
  return Boolean((sheetsApiKey && sheetId) || sheetCsvUrl)
}

export function getSheetSourceLabel() {
  if (sheetsApiKey && sheetId) {
    return 'live'
  }

  return 'live'
}

function cellToString(cell) {
  if (cell === true) {
    return 'TRUE'
  }

  if (cell === false) {
    return 'FALSE'
  }

  return String(cell ?? '')
}

function escapeCsvCell(value) {
  const text = cellToString(value)

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

export function valuesToCsvText(values = []) {
  return values.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

function publishedCsvUrl() {
  if (!sheetCsvUrl) {
    return ''
  }

  const separator = sheetCsvUrl.includes('?') ? '&' : '?'
  return `${sheetCsvUrl}${separator}_=${Date.now()}`
}

async function resolveSheetRange(signal) {
  if (sheetRange) {
    return sheetRange
  }

  if (resolvedSheetTitle) {
    return `'${resolvedSheetTitle}'!A:Z`
  }

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${sheetsApiKey}&fields=sheets.properties.title`,
    { signal, cache: 'no-store' },
  )

  if (!response.ok) {
    throw new Error(`Sheet metadata request failed: ${response.status}`)
  }

  const data = await response.json()
  resolvedSheetTitle = data.sheets?.[0]?.properties?.title || 'Sheet1'

  return `'${resolvedSheetTitle}'!A:Z`
}

async function fetchViaSheetsApi(signal) {
  const range = await resolveSheetRange(signal)
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
  )
  url.searchParams.set('key', sheetsApiKey)
  url.searchParams.set('majorDimension', 'ROWS')

  const response = await fetch(url, { signal, cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Sheets API request failed: ${response.status}`)
  }

  const data = await response.json()
  return valuesToCsvText(data.values || [])
}

async function fetchViaPublishedCsv(signal) {
  const response = await fetch(publishedCsvUrl(), { signal, cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Published CSV request failed: ${response.status}`)
  }

  return response.text()
}

export async function fetchSheetData(signal) {
  if (sheetsApiKey && sheetId) {
    try {
      return await fetchViaSheetsApi(signal)
    } catch (error) {
      if (!sheetCsvUrl) {
        throw error
      }
    }
  }

  if (sheetCsvUrl) {
    return fetchViaPublishedCsv(signal)
  }

  throw new Error('Set VITE_GOOGLE_SHEETS_API_KEY + VITE_GOOGLE_SHEET_ID or VITE_GOOGLE_SHEET_CSV_URL')
}

/** @deprecated Use fetchSheetData */
export async function fetchSheetCsv(signal) {
  return fetchSheetData(signal)
}
