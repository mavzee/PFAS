import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import icon from 'leaflet/dist/images/marker-icon.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import {
  buildPinsFromCache,
  ensureGeocodeCacheHydrated,
  mapCompanyNames,
  resolveCompanyPins,
} from '../utils/companyLocations.js'
import { useSheetData } from '../utils/useSheetData.js'
import './LiveMap.css'

const DEFAULT_CENTER = [40.75, -73.965]
const DEFAULT_ZOOM = 11
const FOCUS_ZOOM = 14
const FLY_DURATION = 1.35
const PAUSE_BETWEEN_MS = 5_000
const FINAL_BOUNDS_DURATION = 1.6

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: shadow,
})

function statusMessage({ companies, geocodeStatus, pins, failedCount, tour }) {
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
    return geocodeStatus === 'ready'
      ? 'No locations could be resolved'
      : ''
  }

  if (failedCount > 0) {
    return `${pins.length} of ${companies.length} located`
  }

  return `${pins.length} ${pins.length === 1 ? 'company' : 'companies'} on map`
}

function popupLabel(pin) {
  return pin.displayName && pin.displayName !== pin.name
    ? `<strong>${pin.name}</strong><br>${pin.displayName}`
    : `<strong>${pin.name}</strong>`
}

function delay(ms, shouldContinue) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(shouldContinue())
    }, ms)
  })
}

function flyToLatLng(map, latlng, zoom) {
  return new Promise((resolve) => {
    const onEnd = () => {
      map.off('moveend', onEnd)
      resolve()
    }

    map.on('moveend', onEnd)
    map.flyTo(latlng, zoom, { duration: FLY_DURATION })
  })
}

function flyToBounds(map, bounds) {
  return new Promise((resolve) => {
    const onEnd = () => {
      map.off('moveend', onEnd)
      resolve()
    }

    map.on('moveend', onEnd)
    map.flyToBounds(bounds, {
      padding: [24, 24],
      maxZoom: 12,
      duration: FINAL_BOUNDS_DURATION,
    })
  })
}

function LiveMap() {
  const { csvText } = useSheetData()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markersLayerRef = useRef(null)
  const markersByIdRef = useRef(new Map())
  const tourRef = useRef({ generation: 0, revealed: 0 })
  const [tourDisplay, setTourDisplay] = useState({ activeIndex: -1, touring: false })

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
    if (!mapContainerRef.current || mapRef.current) {
      return undefined
    }

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    markersLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersLayerRef.current = null
    }
  }, [])

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
    const layer = markersLayerRef.current
    const markersById = markersByIdRef.current

    if (layer) {
      layer.clearLayers()
    }

    markersById.clear()

    if (map) {
      map.stop()
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false })
    }

    queueMicrotask(() => setTourDisplay({ activeIndex: -1, touring: false }))
  }, [companyKey])

  useEffect(() => {
    const map = mapRef.current
    const layer = markersLayerRef.current

    if (!map || !layer) {
      return undefined
    }

    const generation = tourRef.current.generation
    const shouldContinue = () => tourRef.current.generation === generation

    const pinIds = new Set(effectivePins.map((pin) => pin.id))

    for (const [id, marker] of markersByIdRef.current.entries()) {
      if (!pinIds.has(id)) {
        layer.removeLayer(marker)
        markersByIdRef.current.delete(id)
      }
    }

    if (!effectivePins.length) {
      map.stop()
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false })
      tourRef.current.revealed = 0
      queueMicrotask(() => setTourDisplay({ activeIndex: -1, touring: false }))
      return undefined
    }

    let cancelled = false

    ;(async () => {
      setTourDisplay({ activeIndex: 0, touring: true })

      while (!cancelled && shouldContinue()) {
        for (let index = 0; index < effectivePins.length; index += 1) {
          if (cancelled || !shouldContinue()) {
            return
          }

          const pin = effectivePins[index]
          let marker = markersByIdRef.current.get(pin.id)

          if (!marker) {
            marker = L.marker([pin.lat, pin.lng], {
              opacity: 0,
            })
            marker.bindPopup(popupLabel(pin))
            marker.addTo(layer)
            markersByIdRef.current.set(pin.id, marker)

            requestAnimationFrame(() => {
              marker.setOpacity(1)
            })
          }

          tourRef.current.revealed = index + 1
          setTourDisplay({ activeIndex: index, touring: true })

          map.stop()
          await flyToLatLng(map, [pin.lat, pin.lng], FOCUS_ZOOM)

          if (cancelled || !shouldContinue()) {
            return
          }

          marker.openPopup()

          const keepGoing = await delay(PAUSE_BETWEEN_MS, shouldContinue)

          if (!keepGoing) {
            return
          }
        }

        if (cancelled || !shouldContinue()) {
          return
        }

        if (effectivePins.length > 1) {
          const bounds = L.latLngBounds(effectivePins.map((pin) => [pin.lat, pin.lng]))
          map.stop()
          await flyToBounds(map, bounds)

          if (cancelled || !shouldContinue()) {
            return
          }

          const keepGoing = await delay(PAUSE_BETWEEN_MS, shouldContinue)

          if (!keepGoing) {
            return
          }
        }

        tourRef.current.revealed = 0
      }
    })()

    return () => {
      cancelled = true
      map.stop()
    }
  }, [effectivePins])

  const overlayText = statusMessage({
    companies,
    geocodeStatus: effectiveStatus,
    pins: effectivePins,
    failedCount: effectiveFailed,
    tour: tourDisplay,
  })

  return (
    <section className="live-map" aria-labelledby="live-map-title">
      <h2 id="live-map-title">Live Map - Company Locations</h2>
      <div className="live-map-canvas">
        <div ref={mapContainerRef} className="live-map-leaflet" aria-hidden={!csvText} />
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
