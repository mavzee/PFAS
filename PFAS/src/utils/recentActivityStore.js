import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { sheetCsvUrl, sheetId } from './sheet.js'
import { ACTIVITY_FEED_LIMIT } from './recentActivity.js'

const COLLECTION = 'recentActivityFeeds'

let firestorePermissionsDenied = false

export function isFirestorePermissionsDenied() {
  return firestorePermissionsDenied
}

function markFirestoreError(error) {
  if (error?.code === 'permission-denied') {
    firestorePermissionsDenied = true
  }
}

function hashString(text) {
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }

  return `csv-${Math.abs(hash)}`
}

export function getRecentActivityDocId() {
  if (sheetId) {
    return sheetId
  }

  if (sheetCsvUrl) {
    return hashString(sheetCsvUrl)
  }

  return ''
}

export function isRecentActivityStoreEnabled() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      getRecentActivityDocId() &&
      auth.currentUser,
  )
}

function sanitizeActivityItem(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const id = String(item.id ?? '').trim()
  const text = String(item.text ?? '').trim()
  const at = Number(item.at)

  if (!id || !text || !Number.isFinite(at)) {
    return null
  }

  return {
    id,
    text,
    time: String(item.time ?? '').trim(),
    type: String(item.type ?? 'update').trim() || 'update',
    at,
  }
}

export function sanitizeActivityFeed(items) {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map(sanitizeActivityItem)
    .filter(Boolean)
    .slice(0, ACTIVITY_FEED_LIMIT)
}

function activityDocRef() {
  const docId = getRecentActivityDocId()

  if (!docId) {
    return null
  }

  return doc(db, COLLECTION, docId)
}

export async function loadRecentActivityFeed() {
  if (!isRecentActivityStoreEnabled()) {
    return []
  }

  const ref = activityDocRef()

  if (!ref) {
    return []
  }

  try {
    const snapshot = await getDoc(ref)

    if (!snapshot.exists()) {
      return []
    }

    return sanitizeActivityFeed(snapshot.data()?.items)
  } catch (error) {
    markFirestoreError(error)

    if (error?.code === 'permission-denied') {
      console.warn(
        '[recentActivity] Firestore permission denied. In Firebase Console → Firestore → Rules, allow authenticated access to recentActivityFeeds (see PFAS/firestore.rules).',
      )
    } else {
      console.warn('[recentActivity] Failed to load feed from Firestore', error)
    }

    return []
  }
}

export async function saveRecentActivityFeed(items) {
  if (!isRecentActivityStoreEnabled()) {
    return
  }

  const ref = activityDocRef()

  if (!ref) {
    return
  }

  const payload = sanitizeActivityFeed(items)

  try {
    await setDoc(
      ref,
      {
        items: payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (error) {
    markFirestoreError(error)

    if (error?.code === 'permission-denied') {
      console.warn(
        '[recentActivity] Firestore permission denied on save. Update Firestore rules (see PFAS/firestore.rules).',
      )
    } else {
      console.warn('[recentActivity] Failed to save feed to Firestore', error)
    }
  }
}
