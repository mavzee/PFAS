import { useMemo } from 'react'
import { useSheetData } from '../utils/useSheetData.js'
import './RecentActivity.css'

function RecentActivity() {
  const { recentActivities, recentActivitiesLoading, recentActivityFirestoreBlocked, sheetState } =
    useSheetData()
  const visibleActivities = useMemo(() => recentActivities.slice(0, 7), [recentActivities])

  return (
    <section className="recent-activity" aria-labelledby="recent-activity-title">
      <div className="ra-heading">
        <h2 id="recent-activity-title">Recent Activity</h2>
        <small>{sheetState}</small>
      </div>

      <ul className="ra-list">
        {visibleActivities.length ? (
          visibleActivities.map((activity) => (
            <li key={activity.id}>
              <span className={`ra-icon ${activity.type}`} aria-hidden="true" />
              <p>{activity.text}</p>
              <time>{activity.time || '-'}</time>
            </li>
          ))
        ) : (
          <li className="ra-empty">
            <p>
              {recentActivitiesLoading
                ? 'Loading history…'
                : recentActivityFirestoreBlocked
                  ? 'Firestore access blocked — publish rules in Firebase Console (see sheets/README.md and firestore.rules).'
                  : 'No recent activity yet — updates appear when checkboxes change in the Test Kit Summary sheet'}
            </p>
          </li>
        )}
      </ul>
    </section>
  )
}

export default RecentActivity
