import { useState } from 'react'
import LiveMap from '../Live Map/LiveMap.jsx'
import TravelHistory from './TravelHistory.jsx'
import './Tracker.css'

const TABS = [
  { id: 'tracker', label: 'Tracker' },
  { id: 'map', label: 'Map' },
]

function normalizeTrackingNumber(value) {
  return String(value ?? '').replace(/\s+/g, '').trim()
}

function TrackerSearchPanel({ trackingQuery, onQueryChange, onSubmit }) {
  return (
    <form className="tracker-search" onSubmit={onSubmit}>
      <label className="tracker-search-label" htmlFor="tracker-search-input">
        Tracking ID
      </label>
      <div className="tracker-search-field">
        <input
          id="tracker-search-input"
          type="search"
          placeholder="Tracking ID"
          autoComplete="off"
          spellCheck={false}
          value={trackingQuery}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <button className="tracker-search-submit" type="submit">
        Search
      </button>
    </form>
  )
}

function TrackerPanel() {
  const [trackingQuery, setTrackingQuery] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  function runLookup(rawTrackingNumber) {
    const normalized = normalizeTrackingNumber(rawTrackingNumber)

    if (!normalized) {
      setHasSearched(false)
      setTrackingNumber('')
      return
    }

    setHasSearched(true)
    setTrackingNumber(normalized)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const normalized = normalizeTrackingNumber(trackingQuery)
    setTrackingQuery(normalized)
    runLookup(normalized)
  }

  const shouldShowPrompt = !hasSearched && !trackingQuery.trim()

  return (
    <>
      <TrackerSearchPanel
        trackingQuery={trackingQuery}
        onQueryChange={setTrackingQuery}
        onSubmit={handleSubmit}
      />

      {shouldShowPrompt ? (
        <p className="tracker-empty">Enter a tracking ID to look up a shipment.</p>
      ) : (
        <TravelHistory trackingNumber={trackingNumber} status="" events={[]} />
      )}
    </>
  )
}

function FedExTracker() {
  const [activeTab, setActiveTab] = useState('tracker')

  return (
    <section className="tracker" aria-labelledby="tracker-title">
      <div className="tracker-heading">
        <h2 id="tracker-title">Tracker (FedEx)</h2>
        <div className="tracker-tabs" role="tablist" aria-label="Tracker views">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tracker-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tracker-panel-${tab.id}`}
              className={activeTab === tab.id ? 'tracker-tab is-active' : 'tracker-tab'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tracker-body">
        <div
          id="tracker-panel-tracker"
          role="tabpanel"
          aria-labelledby="tracker-tab-tracker"
          hidden={activeTab !== 'tracker'}
          className="tracker-panel"
        >
          <TrackerPanel />
        </div>

        <div
          id="tracker-panel-map"
          role="tabpanel"
          aria-labelledby="tracker-tab-map"
          hidden={activeTab !== 'map'}
          className="tracker-panel tracker-panel--map"
        >
          <LiveMap embedded active={activeTab === 'map'} />
        </div>
      </div>
    </section>
  )
}

export default FedExTracker
