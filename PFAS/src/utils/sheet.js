export const sheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL
export const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID
export const sheetsApiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY
export const sheetRange = import.meta.env.VITE_GOOGLE_SHEET_RANGE
export const sheetGid = import.meta.env.VITE_GOOGLE_SHEET_GID || '0'
export const testerTabName = import.meta.env.VITE_GOOGLE_SHEET_TESTER_TAB || 'Tester Activity'
export const testerSheetGid = import.meta.env.VITE_GOOGLE_SHEET_TESTER_GID || ''
export const testerSheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_TESTER_CSV_URL || ''
let resolvedMainSheetTitle = null

export function hasSheetConnection() {
  return Boolean((sheetsApiKey && sheetId) || sheetCsvUrl || testerSheetCsvUrl)
}

export function getSheetSourceLabel() {
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

function publishedCsvUrl(gid = sheetGid) {
  if (!sheetCsvUrl) {
    return ''
  }

  const url = new URL(sheetCsvUrl)
  url.searchParams.set('gid', gid)
  url.searchParams.set('single', 'true')
  url.searchParams.set('output', 'csv')
  url.searchParams.set('_', String(Date.now()))

  return url.toString()
}

async function resolveMainSheetRange(signal) {
  if (sheetRange) {
    return sheetRange
  }

  if (resolvedMainSheetTitle) {
    return `'${resolvedMainSheetTitle}'!A:Z`
  }

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${sheetsApiKey}&fields=sheets.properties.title`,
    { signal, cache: 'no-store' },
  )

  if (!response.ok) {
    throw new Error(`Sheet metadata request failed: ${response.status}`)
  }

  const data = await response.json()
  resolvedMainSheetTitle = data.sheets?.[0]?.properties?.title || 'Sheet1'

  return `'${resolvedMainSheetTitle}'!A:Z`
}

function testerSheetRange() {
  return `'${testerTabName.replace(/'/g, "''")}'!A:Z`
}

async function fetchValuesRange(range, signal) {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
  )
  url.searchParams.set('key', sheetsApiKey)
  url.searchParams.set('majorDimension', 'ROWS')
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE')

  const response = await fetch(url, { signal, cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Sheets API request failed: ${response.status}`)
  }

  const data = await response.json()
  return valuesToCsvText(data.values || [])
}

async function fetchViaSheetsApi(signal) {
  const mainRange = await resolveMainSheetRange(signal)
  const [main, tester] = await Promise.all([
    fetchValuesRange(mainRange, signal),
    fetchValuesRange(testerSheetRange(), signal).catch(() => ''),
  ])

  return { main, tester }
}

function withCacheBust(url) {
  const nextUrl = new URL(url)
  nextUrl.searchParams.set('_', String(Date.now()))
  return nextUrl.toString()
}

async function readPublishedCsvText(url, signal) {
  const response = await fetch(withCacheBust(url), { signal, cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Published CSV request failed: ${response.status}`)
  }

  const text = await response.text()
  const trimmed = text.trimStart()

  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    throw new Error('Published CSV is not available')
  }

  return text
}

async function fetchPublishedCsv(gid, signal) {
  return readPublishedCsvText(publishedCsvUrl(gid), signal)
}

async function fetchTesterPublishedCsv(signal) {
  if (testerSheetCsvUrl) {
    return readPublishedCsvText(testerSheetCsvUrl, signal)
  }

  if (testerSheetGid && sheetCsvUrl) {
    return fetchPublishedCsv(testerSheetGid, signal)
  }

  return ''
}

async function fetchViaPublishedCsv(signal) {
  const fetches = []

  if (sheetCsvUrl) {
    fetches.push(
      fetchPublishedCsv(sheetGid, signal).catch(() => ''),
    )
  } else {
    fetches.push(Promise.resolve(''))
  }

  fetches.push(fetchTesterPublishedCsv(signal).catch(() => ''))

  const [main, tester] = await Promise.all(fetches)

  return { main, tester }
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
  const data = await fetchSheetData(signal)
  return typeof data === 'string' ? data : data.main
}
