export function parseCsvRows(csvText) {
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

export function findColumnIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(header))
}
