export const sheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL

function sheetRequestUrl() {
  if (!sheetCsvUrl) {
    return ''
  }

  const separator = sheetCsvUrl.includes('?') ? '&' : '?'
  return `${sheetCsvUrl}${separator}_=${Date.now()}`
}

export async function fetchSheetCsv(signal) {
  const response = await fetch(sheetRequestUrl(), {
    signal,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Sheet request failed: ${response.status}`)
  }

  return response.text()
}
