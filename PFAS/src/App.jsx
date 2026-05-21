import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase.js'
import Dashboard from './Dashboard.jsx'
import Login from './Login/Login.jsx'
import './Login/Login.css'

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthReady(true)
    })
  }, [])

  if (!authReady) {
    return (
      <main className="auth-loading" aria-live="polite">
        <p>Loading…</p>
      </main>
    )
  }

  if (!user) {
    return <Login />
  }

  return <Dashboard />
}

export default App
