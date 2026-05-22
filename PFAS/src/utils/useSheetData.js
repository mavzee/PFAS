import { useSyncExternalStore } from 'react'
import { formatSheetStatus, getSheetSnapshot, subscribeSheet } from './sheetCache.js'

export function useSheetData() {
  const snapshot = useSyncExternalStore(subscribeSheet, getSheetSnapshot, getSheetSnapshot)

  return {
    ...snapshot,
    sheetState: formatSheetStatus(snapshot),
  }
}
