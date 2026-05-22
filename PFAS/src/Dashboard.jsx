import { useEffect } from 'react'
import Header from './Header/Header.jsx'
import TestKitSummary from './Test Kit Summary/TestKitSummary.jsx'
import StatusBreakdown from './Status Breakdown/StatusBreakdown.jsx'
import FedExTracker from './Tracker/Tracker.jsx'
import TesterActivity from './Tester Activity/TesterActivity.jsx'
import RecentActivity from './Recent Activity/RecentActivity.jsx'
import AlertAndReminder from './Alerts And Remindes/AlertAndReminder.jsx'
import { startSheetSync } from './utils/sheetCache.js'
import './Dashboard.css'

function Dashboard() {
  useEffect(() => startSheetSync(), [])

  return (
    <main className="dashboard-page">
      <Header />
      <div className="dashboard-top-row">
        <TestKitSummary />
        <StatusBreakdown />
      </div>
      <div className="dashboard-body-row">
        <FedExTracker />
        <div className="dashboard-right-column">
          <TesterActivity />
          <div className="dashboard-bottom-right-row">
            <RecentActivity />
            <AlertAndReminder />
          </div>
        </div>
      </div>
    </main>
  )
}

export default Dashboard
