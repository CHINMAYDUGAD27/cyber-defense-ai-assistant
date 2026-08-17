import { useState } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE } from '../config/api'

function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(`${API_BASE}/auth/signup`, { email, password })
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('token', res.data.access_token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-main)',
      position: 'relative', // Added to position the absolute footer accurately
      paddingBottom: '50px', // Prevents footer overlapping elements on compact screens
      boxSizing: 'border-box'
    }}>
      <form onSubmit={handleSignup} style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '2.5rem',
        width: '340px'
      }}>
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>AI Cyber Defense</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '-0.5rem' }}>
          Create your account
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />

        {error && <p style={{ color: 'var(--risk-critical)', fontSize: '0.85rem' }}>{error}</p>}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Creating account...' : 'Sign up'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        </p>
      </form>

      {/* ==================== ADDED THIS FOOTER CODE HERE ==================== */}
      <footer style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        letterSpacing: '0.5px',
        opacity: 0.7,
        pointerEvents: 'none',
        padding: '0 1rem',
        boxSizing: 'border-box'
      }}>
        <p style={{ margin: 0 }}>&copy; 2026 AI Cyber Defense. All rights reserved. This platform is for educational purposes only.</p>
      </footer>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.6rem 0.8rem',
  marginBottom: '1rem',
  backgroundColor: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.9rem'
}

const buttonStyle = {
  width: '100%',
  padding: '0.65rem',
  backgroundColor: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
  marginBottom: '1rem'
}

export default Signup