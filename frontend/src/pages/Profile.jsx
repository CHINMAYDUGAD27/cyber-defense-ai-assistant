import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../config/api'

function Profile() {
  const [email, setEmail] = useState(null)
  const [error, setError] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token') || ''

    // Fetch profile
    axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => setEmail(res.data.email))
      .catch(() => setError('Could not load profile. Please log in again.'))

    // Fetch incidents for Phase 5 stats
    axios.get(`${API_BASE}/incidents`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      const incidents = res.data
      if (incidents.length === 0) {
        setStats({ totalScans: 0, mostCommon: 'N/A', memberSince: 'No activity yet' })
        return
      }

      const sorted = [...incidents].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const firstDate = new Date(sorted[0].created_at).toLocaleDateString()

      const typeCounts = {}
      incidents.forEach(i => {
        if (i.attack_type) {
          typeCounts[i.attack_type] = (typeCounts[i.attack_type] || 0) + 1
        }
      })
      
      let mostCommon = 'None'
      let maxCount = 0
      Object.entries(typeCounts).forEach(([type, count]) => {
        if (count > maxCount) {
          mostCommon = type
          maxCount = count
        }
      })

      setStats({
        totalScans: incidents.length,
        mostCommon,
        memberSince: firstDate
      })
    }).catch(() => {})
  }, [])

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`)
    } catch (e) {}
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('token') // for backward compat cleanup
    navigate('/login')
  }

  const handlePasswordChange = async (event) => {
    event.preventDefault()
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'The new passwords do not match.' })
      return
    }

    setPasswordLoading(true)
    try {
      const token = localStorage.getItem('token') || ''
      await axios.post(
        `${API_BASE}/auth/change-password`,
        { new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage({ type: 'success', text: 'Password updated. You can now use it to log in on your phone.' })
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Could not update password. Please sign in again.'
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '500px' }}>
      <h1 style={{ marginTop: 0 }}>Profile</h1>

      {error && <p style={{ color: 'var(--risk-critical)' }}>{error}</p>}

      {email && (
        <div style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              fontWeight: 'bold'
            }}>
              {email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{email}</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Security analyst account
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Change password</h2>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password (8+ characters)"
              minLength="8"
              required
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.6rem', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              minLength="8"
              required
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: '0.75rem', padding: '0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
            />
            {passwordMessage && (
              <p style={{ color: passwordMessage.type === 'success' ? 'var(--risk-low)' : 'var(--risk-critical)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                {passwordMessage.text}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordLoading}
              style={{ backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.2rem', fontWeight: 'bold', cursor: passwordLoading ? 'wait' : 'pointer' }}
            >
              {passwordLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <button
            onClick={handleLogout}
            style={{
              backgroundColor: 'var(--risk-critical)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.2rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Log out
          </button>
        </div>
      )}

      {/* Phase 5: Stats Section */}
      {stats && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Account Statistics</h2>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Member Since</span>
              <span style={{ fontWeight: 600 }}>{stats.memberSince}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Scans Run</span>
              <span style={{ fontWeight: 600 }}>{stats.totalScans}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Most Common Threat</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{stats.mostCommon}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
