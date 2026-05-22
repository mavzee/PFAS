let bootstrapPromise = null
let librariesPromise = null

function getApiKey() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY in .env')
  }

  return apiKey
}

function installBootstrap(apiKey) {
  if (globalThis.google?.maps?.importLibrary) {
    return
  }

  ;((params) => {
    let h
    let a
    let k
    const p = 'The Google Maps JavaScript API'
    const c = 'google'
    const l = 'importLibrary'
    const q = '__ib__'
    const m = document
    let b = window
    b = b[c] || (b[c] = {})
    const d = b.maps || (b.maps = {})
    const r = new Set()
    const e = new URLSearchParams()
    const u = () =>
      h ||
      (h = new Promise(async (resolve, reject) => {
        await (a = m.createElement('script'))
        e.set('libraries', [...r] + '')
        for (k in params) {
          e.set(k.replace(/[A-Z]/g, (t) => `_${t[0].toLowerCase()}`), params[k])
        }
        e.set('callback', `${c}.maps.${q}`)
        a.src = `https://maps.googleapis.com/maps/api/js?${e}`
        d[q] = resolve
        a.onerror = () => {
          h = reject(new Error(`${p} could not load.`))
        }
        a.nonce = m.querySelector('script[nonce]')?.nonce || ''
        m.head.append(a)
      }))
    d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n))
  })({ key: apiKey, v: 'weekly' })
}

async function ensureBootstrap() {
  if (globalThis.google?.maps?.importLibrary) {
    return
  }

  if (!bootstrapPromise) {
    const apiKey = getApiKey()
    installBootstrap(apiKey)
    bootstrapPromise = globalThis.google.maps.importLibrary('maps').then(() => undefined)
  }

  await bootstrapPromise
}

/**
 * Fired by Google when the API key is invalid or required APIs are not enabled.
 */
export function onGoogleMapsAuthFailure(handler) {
  globalThis.gm_authFailure = () => {
    handler(
      new Error(
        'Google Maps rejected this API key. Enable "Maps JavaScript API" (not only Map Tiles API) for the same project as the key, and allow localhost in key restrictions.',
      ),
    )
  }
}

/**
 * @returns {Promise<{
 *   Map: typeof google.maps.Map,
 *   Marker: typeof google.maps.Marker,
 *   InfoWindow: typeof google.maps.InfoWindow,
 *   LatLngBounds: typeof google.maps.LatLngBounds,
 *   event: typeof google.maps.event,
 * }>}
 */
export async function loadMapLibraries() {
  await ensureBootstrap()

  if (!librariesPromise) {
    librariesPromise = Promise.all([
      globalThis.google.maps.importLibrary('maps'),
      globalThis.google.maps.importLibrary('marker'),
      globalThis.google.maps.importLibrary('core'),
    ])
      .then(([mapsLib, markerLib, coreLib]) => {
        if (!mapsLib?.Map) {
          throw new Error('Google Maps maps library did not load')
        }

        return {
          Map: mapsLib.Map,
          Marker: markerLib.Marker,
          InfoWindow: mapsLib.InfoWindow,
          LatLngBounds: coreLib.LatLngBounds,
          event: globalThis.google.maps.event,
        }
      })
      .catch((error) => {
        librariesPromise = null
        bootstrapPromise = null
        throw error
      })
  }

  return librariesPromise
}
