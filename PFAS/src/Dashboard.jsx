import Header from './Header/Header.jsx'
import TestKitSummary from './Test Kit Summary/TestKitSummary.jsx'
import StatusBreakdown from './Status Breakdown/StatusBreakdown.jsx'
import TestKitFlow from './Test Kit Flow/TestKitFlow.jsx'
import TesterActivity from './Tester Activity/TesterActivity.jsx'
import LiveMap from './Live Map/LiveMap.jsx'
import RecentActivity from './Recent Activity/RecentActivity.jsx'
import AlertAndReminder from './Alerts And Remindes/AlertAndReminder.jsx'
import './Dashboard.css'

function Dashboard() {
  return (
    <main className="dashboard-page">
      <Header />
      <div className="dashboard-top-row">
        <TestKitSummary />
        <StatusBreakdown />
      </div>
      <div className="dashboard-middle-row">
        <TestKitFlow />
        <TesterActivity />
      </div>
      <div className="dashboard-lower-row">
        <LiveMap />
        <RecentActivity />
        <AlertAndReminder />
      </div>
    </main>
  )
}

export default Dashboard
