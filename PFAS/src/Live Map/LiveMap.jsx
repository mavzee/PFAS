import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildPinsFromCache,
  ensureGeocodeCacheHydrated,
  mapCompanyNames,
  resolveCompanyPins,
} from '../utils/companyLocations.js'
import { loadMapLibraries, onGoogleMapsAuthFailure } from '../utils/googleMapsLoader.js'
import { useSheetData } from '../utils/useSheetData.js'
import './LiveMap.css'

const DEFAULT_CENTER = { lat: 40.75, lng: -73.965 }
const DEFAULT_ZOOM = 12
const FOCUS_ZOOM = 16
const OVERVIEW_MAX_ZOOM = 15
const PAUSE_AT_PIN_MS = 4_200
const PAUSE_AFTER_OVERVIEW_MS = 3_500
const PRE_FLIGHT_MS = 200
const POST_FLIGHT_MS = 150
const MARKER_FADE_MS = 450

function statusMessage({ companies, geocodeStatus, pins, failedCount, tour, mapError, mapLoading }) {
  if (mapLoading) {
    return 'Loading Google Maps…'
  }

  if (mapError) {
    return mapError
  }

  if (!companies.length) {
    return 'No company names found in sheet'
  }

  if (tour.touring && pins.length) {
    return `Viewing ${Math.min(tour.activeIndex + 1, pins.length)} of ${pins.length}…`
  }

  if (geocodeStatus === 'loading') {
    return `Plotting ${companies.length} ${companies.length === 1 ? 'company' : 'companies'}…`
  }

  if (!pins.length) {
    return geocodeStatus === 'ready' ? 'No locations could be resolved' : ''
  }

  if (failedCount > 0) {
    return `${pins.length} of ${companies.length} located`
  }

  return `${pins.length} ${pins.length === 1 ? 'company' : 'companies'} on map`
}

function buildPopupElement(pin) {
  const root = document.createElement('div')
  root.className = 'live-map-popup'

  const title = document.createElement('div')
  title.className = 'live-map-popup-title'
  title.textContent = pin.name || 'Company'
  root.appendChild(title)

  if (pin.displayName && pin.displayName !== pin.name) {
    const place = document.createElement('div')
    place.className = 'live-map-popup-place'
    place.textContent = pin.displayName
    root.appendChild(place)
  }

  return root
}

function openPinInfo(infoWindow, map, pin, marker) {
  infoWindow.setContent(buildPopupElement(pin))
  infoWindow.open({ map, anchor: marker })
}

function fadeMarkerIn(marker, durationMs = MARKER_FADE_MS) {
  marker.setOpacity(0)

  const start = performance.now()

  const step = (now) => {
    const progress = Math.min((now - start) / durationMs, 1)
    const eased = 1 - (1 - progress) ** 2
    marker.setOpacity(eased)

    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

function setMarkerActive(entry, isActive) {
  entry.marker.setZIndex(isActive ? 1000 : 1)
}

function upsertMarker(libs, map, markersById, pin, infoWindow) {
  let entry = markersById.get(pin.id)

  if (!entry) {
    const marker = new libs.Marker({
      map,
      position: { lat: pin.lat, lng: pin.lng },
      title: pin.name,
      opacity: 0,
      zIndex: 1,
    })

    fadeMarkerIn(marker)

    entry = {
      marker,
      listener: marker.addListener('click', () => {
        openPinInfo(infoWindow, map, pin, marker)
      }),
    }
    markersById.set(pin.id, entry)
  } else {
    entry.marker.setPosition({ lat: pin.lat, lng: pin.lng })
    entry.marker.setTitle(pin.name)
    entry.marker.setMap(map)
  }

  return entry
}

function delay(ms, shouldContinue) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(shouldContinue())
    }, ms)
  })
}

function waitForMapIdle(map) {
  return new Promise((resolve) => {
    const listener = map.addListener('idle', () => {
      listener.remove()
      resolve()
    })
  })
}

async function smoothFlyTo(map, pin, zoom = FOCUS_ZOOM) {
  const center = { lat: pin.lat, lng: pin.lng }

  if (typeof map.moveCamera === 'function') {
    map.moveCamera({ center, zoom })
    await waitForMapIdle(map)
    return
  }

  map.panTo(center)

  const currentZoom = map.getZoom() ?? DEFAULT_ZOOM

  if (Math.abs(currentZoom - zoom) > 0.4) {
    map.setZoom(zoom)
  }

  await waitForMapIdle(map)
}

async function smoothFitAllPins(map, pins, LatLngBounds) {
  if (!pins.length) {
    return
  }

  if (pins.length === 1) {
    await smoothFlyTo(map, pins[0], FOCUS_ZOOM)
    return
  }

  const bounds = new LatLngBounds()

  pins.forEach((pin) => {
    bounds.extend({ lat: pin.lat, lng: pin.lng })
  })

  map.fitBounds(bounds, {
    top: 56,
    right: 56,
    bottom: 56,
    left: 56,
    maxZoom: OVERVIEW_MAX_ZOOM,
  })
  await waitForMapIdle(map)
}

function clearMarkers(markersById, infoWindowRef) {
  for (const entry of markersById.values()) {
    entry.listener?.remove()
    entry.marker.setMap(null)
  }

  markersById.clear()
  infoWindowRef.current?.close()
}

function LiveMap({ embedded = false, active = true }) {
  const { csvText } = useSheetData()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const mapsLibRef = useRef(null)
  const markersByIdRef = useRef(new Map())
  const infoWindowRef = useRef(null)
  const tourRef = useRef({ generation: 0, revealed: 0 })
  const [tourDisplay, setTourDisplay] = useState({ activeIndex: -1, touring: false })
  const [mapError, setMapError] = useState('')
  const [mapsReady, setMapsReady] = useState(false)
  const [mapLoading, setMapLoading] = useState(true)

  const companies = useMemo(() => mapCompanyNames(csvText), [csvText])
  const companyKey = useMemo(
    () => companies.map((company) => company.key).join('\0'),
    [companies],
  )
  const [pins, setPins] = useState([])
  const [geocodeStatus, setGeocodeStatus] = useState('idle')
  const [failedCount, setFailedCount] = useState(0)
  const effectivePins = useMemo(
    () => (companies.length ? pins : []),
    [companies.length, pins],
  )
  const effectiveFailed = companies.length ? failedCount : 0
  const effectiveStatus = companies.length ? geocodeStatus : 'ready'

  useEffect(() => {
    let cancelled = false

    onGoogleMapsAuthFailure((error) => {
      if (!cancelled) {
        setMapError(error.message)
        setMapsReady(false)
      }
    })

    setMapLoading(true)

    loadMapLibraries()
      .then((libs) => {
        if (cancelled) {
          return
        }

        mapsLibRef.current = libs
        setMapError('')
        setMapsReady(true)
      })
      .catch((error) => {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Google Maps failed to load')
          setMapsReady(false)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMapLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const libs = mapsLibRef.current

    if (!mapsReady || !libs || !mapContainerRef.current || mapRef.current) {
      return undefined
    }

    if (embedded && !active) {
      return undefined
    }

    try {
      const map = new libs.Map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: !embedded,
      })

      infoWindowRef.current = new libs.InfoWindow()
      mapRef.current = map

      requestAnimationFrame(() => {
        libs.event.trigger(map, 'resize')
      })
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'Could not create Google Map')
    }

    return () => {
      tourRef.current.generation += 1
      clearMarkers(markersByIdRef.current, infoWindowRef)
      infoWindowRef.current = null
      mapRef.current = null
    }
  }, [mapsReady, embedded, active])

  useEffect(() => {
    if (!active || !mapRef.current) {
      return undefined
    }

    const map = mapRef.current
    const frameId = requestAnimationFrame(() => {
      mapsLibRef.current?.event.trigger(map, 'resize')
      map.setCenter(DEFAULT_CENTER)
      map.setZoom(DEFAULT_ZOOM)
    })

    return () => cancelAnimationFrame(frameId)
  }, [active, embedded, mapsReady])

  useEffect(() => {
    if (!companies.length) {
      return undefined
    }

    const controller = new AbortController()
    let cancelled = false

    ;(async () => {
      await ensureGeocodeCacheHydrated()

      if (cancelled) {
        return
      }

      const cached = buildPinsFromCache(companies)

      if (cached.pins.length || cached.failedCount) {
        setPins(cached.pins)
        setFailedCount(cached.failedCount)
      }

      if (cached.pendingCount === 0) {
        setGeocodeStatus('ready')
        return
      }

      setGeocodeStatus('loading')

      try {
        const { pins: resolvedPins, failedCount: resolvedFailed } = await resolveCompanyPins(
          companies,
          {
            signal: controller.signal,
            onProgress: ({ pins: nextPins, failedCount: nextFailed }) => {
              if (!cancelled) {
                setPins(nextPins)
                setFailedCount(nextFailed)
              }
            },
          },
        )

        if (!cancelled) {
          setPins(resolvedPins)
          setFailedCount(resolvedFailed)
          setGeocodeStatus('ready')
        }
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setGeocodeStatus('ready')
        }
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [companyKey, companies])

  useEffect(() => {
    tourRef.current.generation += 1
    tourRef.current.revealed = 0

    const map = mapRef.current

    clearMarkers(markersByIdRef.current, infoWindowRef)

    if (map) {
      map.setCenter(DEFAULT_CENTER)
      map.setZoom(DEFAULT_ZOOM)
    }

    queueMicrotask(() => setTourDisplay({ activeIndex: -1, touring: false }))
  }, [companyKey])

  useEffect(() => {
    const map = mapRef.current
    const infoWindow = infoWindowRef.current
    const libs = mapsLibRef.current

    if (!map || !infoWindow || !libs || !mapsReady || !active) {
      return undefined
    }

    const pinIds = new Set(effectivePins.map((pin) => pin.id))

    for (const [id, entry] of markersByIdRef.current.entries()) {
      if (!pinIds.has(id)) {
        entry.listener?.remove()
        entry.marker.setMap(null)
        markersByIdRef.current.delete(id)
      }
    }

    effectivePins.forEach((pin) => {
      upsertMarker(libs, map, markersByIdRef.current, pin, infoWindow)
    })

    if (effectivePins.length === 1) {
      const pin = effectivePins[0]
      const entry = markersByIdRef.current.get(pin.id)

      if (entry) {
        setMarkerActive(entry, true)
        void smoothFlyTo(map, pin, FOCUS_ZOOM).then(() => {
          if (mapRef.current === map) {
            openPinInfo(infoWindow, map, pin, entry.marker)
          }
        })
      }
    }
  }, [effectivePins, mapsReady, active])

  useEffect(() => {
    const map = mapRef.current
    const infoWindow = infoWindowRef.current
    const libs = mapsLibRef.current

    if (!map || !infoWindow || !libs || !mapsReady || !active) {
      return undefined
    }

    if (effectivePins.length < 2) {
      return undefined
    }

    const generation = tourRef.current.generation
    const shouldContinue = () => tourRef.current.generation === generation

    let cancelled = false

    ;(async () => {
      setTourDisplay({ activeIndex: 0, touring: true })

      for (const entry of markersByIdRef.current.values()) {
        setMarkerActive(entry, false)
      }

      while (!cancelled && shouldContinue()) {
        await smoothFitAllPins(map, effectivePins, libs.LatLngBounds)

        if (cancelled || !shouldContinue()) {
          return
        }

        await delay(PAUSE_AFTER_OVERVIEW_MS, shouldContinue)

        for (let index = 0; index < effectivePins.length; index += 1) {
          if (cancelled || !shouldContinue()) {
            return
          }

          const pin = effectivePins[index]
          const entry = upsertMarker(libs, map, markersByIdRef.current, pin, infoWindow)

          for (const markerEntry of markersByIdRef.current.values()) {
            setMarkerActive(markerEntry, markerEntry === entry)
          }

          tourRef.current.revealed = index + 1
          setTourDisplay({ activeIndex: index, touring: true })

          infoWindow.close()
          await delay(PRE_FLIGHT_MS, shouldContinue)

          if (cancelled || !shouldContinue()) {
            return
          }

          await smoothFlyTo(map, pin, FOCUS_ZOOM)

          if (cancelled || !shouldContinue()) {
            return
          }

          await delay(POST_FLIGHT_MS, shouldContinue)

          if (cancelled || !shouldContinue()) {
            return
          }

          openPinInfo(infoWindow, map, pin, entry.marker)

          const keepGoing = await delay(PAUSE_AT_PIN_MS, shouldContinue)

          if (!keepGoing) {
            return
          }
        }

        if (cancelled || !shouldContinue()) {
          return
        }

        infoWindow.close()
        await delay(PRE_FLIGHT_MS, shouldContinue)

        tourRef.current.revealed = 0
      }
    })()

    return () => {
      cancelled = true
      tourRef.current.generation += 1
      infoWindow.close()
    }
  }, [effectivePins, mapsReady, active])

  const overlayText = statusMessage({
    companies,
    geocodeStatus: effectiveStatus,
    pins: effectivePins,
    failedCount: effectiveFailed,
    tour: tourDisplay,
    mapError,
    mapLoading,
  })

  return (
    <section
      className={embedded ? 'live-map live-map--embedded' : 'live-map'}
      aria-labelledby={embedded ? undefined : 'live-map-title'}
    >
      {embedded ? null : <h2 id="live-map-title">Live Map - Company Locations</h2>}
      <div className="live-map-canvas">
        <div ref={mapContainerRef} className="live-map-google" aria-hidden={!csvText && !mapsReady} />
        {overlayText ? (
          <p className="live-map-status" role="status">
            {overlayText}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default LiveMap
