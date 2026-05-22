import { useState } from 'react'
import LiveMap from '../Live Map/LiveMap.jsx'
import './Tracker.css'

const TABS = [
  { id: 'tracker', label: 'Tracker' },
  { id: 'map', label: 'Map' },
]

function TrackerSearchPanel() {
  return (
    <>
      <div className="tracker-search">
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
            disabled
          />
        </div>
      </div>
      <p className="tracker-empty">Enter a tracking ID to look up a shipment.</p>
    </>
  )
}

function FedExTracker() {
  const [activeTab, setActiveTab] = useState('map')

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
          <TrackerSearchPanel />
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
