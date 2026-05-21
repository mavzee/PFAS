import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase.js'
import { getAuthErrorMessage } from '../authErrors.js'
import './Login.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (signInError) {
      setError(getAuthErrorMessage(signInError.code))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <img src="/logo.png" alt="LawGroup Logo" className="login-logo" />
          <span>LawGroup</span>
        </div>

        <div className="login-heading">
          <h1 id="login-title">PFAS Test Kit Portal</h1>
          <p>Sign in to access the test kit overview dashboard</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="you@lawgroup.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        <p className="login-footer">
          <a href="#forgot">Forgot password?</a>
        </p>
      </section>
    </main>
  )
}

export default Login
