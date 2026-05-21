import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import './Header.css'
import logo from "../assets/LOGO.png";

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  function closeLogoutConfirm() {
    if (!isLoggingOut) {
      setShowLogoutConfirm(false)
    }
  }

  async function confirmLogout() {
    setIsLoggingOut(true)

    try {
      await signOut(auth)
    } catch {
      setIsLoggingOut(false)
      setShowLogoutConfirm(false)
    }
  }

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    if (!showLogoutConfirm) {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        closeLogoutConfirm()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showLogoutConfirm, isLoggingOut])

  const date = formatHeaderDate(now)
  const time = formatHeaderTime(now)

  return (
    <>
    <header className="dashboard-header">
      <div className="header-brand">
    <img
      src={logo}
    alt="LawGroup Logo"
    className="header-logo"
    />
    LawGroup
  </div>

      <div className="header-title">
        <h1>PFAS TEST KIT OVERVIEW</h1>
        <p>Real-time summary of PFAS test kit activity</p>
      </div>

      <div className="header-actions">
        <div className="header-time">
          <strong>{date}</strong>
          <span>{time}</span>
          <small>Last updated: {time}</small>
        </div>
        <button
          type="button"
          className="header-logout"
          onClick={() => setShowLogoutConfirm(true)}
          disabled={isLoggingOut}
        >
          Logout
        </button>
      </div>
    </header>

    {showLogoutConfirm ? (
      <div
        className="logout-confirm-backdrop"
        onClick={closeLogoutConfirm}
        role="presentation"
      >
        <div
          className="logout-confirm-dialog"
          role="alertdialog"
          aria-labelledby="logout-confirm-title"
          aria-describedby="logout-confirm-message"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="logout-confirm-title">Log out?</h2>
          <p id="logout-confirm-message">
            You will be signed out and returned to the login page.
          </p>
          <div className="logout-confirm-actions">
            <button
              type="button"
              className="logout-confirm-cancel"
              onClick={closeLogoutConfirm}
              disabled={isLoggingOut}
            >
              Cancel
            </button>
            <button
              type="button"
              className="logout-confirm-submit"
              onClick={confirmLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Logging Out…' : 'Log Out'}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}

export default Header
