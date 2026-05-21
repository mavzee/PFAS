import { useEffect, useState } from 'react'
import './Header.css'

function formatHeaderDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatHeaderTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function Header() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [])

  const date = formatHeaderDate(now)
  const time = formatHeaderTime(now)

  return (
    <header className="dashboard-header">
      <div className="header-brand">LawGroup</div>

      <div className="header-title">
        <h1>PFAS TEST KIT OVERVIEW</h1>
        <p>Real-time summary of PFAS test kit activity</p>
      </div>

      <div className="header-time">
        <strong>{date}</strong>
        <span>{time}</span>
        <small>Last updated: {time}</small>
      </div>
    </header>
  )
}

export default Header
