import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import {
  getRecentActivityDocId,
  isFirestorePermissionsDenied,
  markFirestorePermissionsDenied,
} from './recentActivityStore.js'

const COLLECTION = 'companyLocationCaches'

let hydratePromise = null

export function isCompanyLocationsStoreEnabled() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      getRecentActivityDocId() &&
      auth.currentUser,
  )
}

function locationsDocRef() {
  const docId = getRecentActivityDocId()

  if (!docId) {
    return null
  }

  return doc(db, COLLECTION, docId)
}

function sanitizeEntry(value) {
  if (value === null) {
    return null
  }

  if (!value || typeof value !== 'object') {
    return undefined
  }

  const lat = Number(value.lat)
  const lng = Number(value.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined
  }

  return {
    lat,
    lng,
    displayName: String(value.displayName ?? '').trim(),
  }
}

export function sanitizeLocationEntries(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const entries = {}

  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = String(key).trim().toLowerCase()

    if (!normalizedKey) {
      continue
    }

    const entry = sanitizeEntry(value)

    if (entry === undefined) {
      continue
    }

    entries[normalizedKey] = entry
  }

  return entries
}

export async function loadCompanyLocationCache() {
  if (!isCompanyLocationsStoreEnabled()) {
    return {}
  }

  const ref = locationsDocRef()

  if (!ref) {
    return {}
  }

  try {
    const snapshot = await getDoc(ref)

    if (!snapshot.exists()) {
      return {}
    }

    return sanitizeLocationEntries(snapshot.data()?.entries)
  } catch (error) {
    markFirestorePermissionsDenied(error)

    if (error?.code === 'permission-denied') {
      console.warn(
        '[companyLocations] Firestore permission denied. Allow authenticated access to companyLocationCaches (see PFAS/firestore.rules).',
      )
    } else {
      console.warn('[companyLocations] Failed to load cache from Firestore', error)
    }

    return {}
  }
}

export async function saveCompanyLocationCache(entries) {
  if (!isCompanyLocationsStoreEnabled() || isFirestorePermissionsDenied()) {
    return
  }

  const ref = locationsDocRef()

  if (!ref) {
    return
  }

  const payload = sanitizeLocationEntries(entries)

  try {
    await setDoc(
      ref,
      {
        entries: payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (error) {
    markFirestorePermissionsDenied(error)

    if (error?.code === 'permission-denied') {
      console.warn(
        '[companyLocations] Firestore permission denied on save. Update Firestore rules (see PFAS/firestore.rules).',
      )
    } else {
      console.warn('[companyLocations] Failed to save cache to Firestore', error)
    }
  }
}

export function resetCompanyLocationCacheHydration() {
  hydratePromise = null
}

export function hydrateCompanyLocationCache(applyEntries) {
  if (!hydratePromise) {
    hydratePromise = loadCompanyLocationCache().then((entries) => {
      if (Object.keys(entries).length) {
        applyEntries(entries)
      }

      return entries
    })
  }

  return hydratePromise
}
