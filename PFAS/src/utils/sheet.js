export const sheetCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL

export async function fetchSheetCsv(signal) {
  const response = await fetch(sheetCsvUrl, { signal })

  console.log('[TestKitSummary] fetch response', {
    ok: response.ok,
    status: response.status,
    url: sheetCsvUrl,
  })

  if (!response.ok) {
    throw new Error(`Sheet request failed: ${response.status}`)
  }

  return response.text()
}
