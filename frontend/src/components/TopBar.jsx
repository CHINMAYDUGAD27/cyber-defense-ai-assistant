import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config/api'
import { FiBell, FiSearch, FiCheck, FiCheckCircle } from 'react-icons/fi'
import RiskBadge from './RiskBadge'

function TopBar() {
  const [initial, setInitial] = useState('?')
  const [notifications, setNotifications] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const dropRef = useRef(null)

  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const fetchNotifications = useCallback(() => {
    if (!token) return
    axios.get(`${API_BASE}/notifications`, { headers })
      .then(res => setNotifications(res.data))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    axios.get(`${API_BASE}/auth/me`, { headers })
      .then(res => setInitial(res.data.email.charAt(0).toUpperCase()))
      .catch(() => setInitial('?'))

    fetchNotifications()

    // Poll every 30 s for new notifications
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [token])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setShowDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markRead = async (id) => {
    try {
      await axios.patch(`${API_BASE}/notifications/${id}/read`, {}, { headers })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await axios.patch(`${API_BASE}/notifications/read-all`, {}, { headers })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch {}
  }

  const riskDotColor = { Low: '#3FB950', Medium: '#D4A72C', High: '#E8590C', Critical: '#E5484D' }

  return (
    <div style={{
      height: '60px',
      backgroundColor: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      position: 'relative',
    }}>
      {/* Search bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        backgroundColor: 'var(--bg-main)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        padding: '0.4rem 0.8rem',
        width: '320px'
      }}>
        <FiSearch color="var(--text-secondary)" />
        <input
          type="text"
          name="quick-analyze-input"
          id="quick-analyze-input"
          autoComplete="off"
          placeholder="Quick analyze: paste log or email..."
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', width: '100%', fontSize: '0.85rem'
          }}
        />
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>

        {/* Bell with badge */}
        <div style={{ position: 'relative' }} ref={dropRef}>
          <button
            onClick={() => setShowDrop(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px', display: 'flex', alignItems: 'center',
              color: showDrop ? 'var(--text-primary)' : 'var(--text-secondary)',
              position: 'relative',
            }}
          >
            <FiBell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-2px', right: '-2px',
                backgroundColor: 'var(--risk-critical)',
                color: '#fff',
                borderRadius: '999px',
                fontSize: '0.6rem',
                fontWeight: 'bold',
                minWidth: '14px', height: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 2px',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showDrop && (
            <div style={{
              position: 'absolute', top: '36px', right: 0,
              width: '360px',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 1000,
              overflow: 'hidden',
              animation: 'fadeIn 0.12s ease',
            }}>
              {/* Dropdown header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.85rem 1rem',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  Notifications {unreadCount > 0 && (
                    <span style={{
                      marginLeft: '6px', backgroundColor: 'var(--risk-critical)',
                      color: '#fff', borderRadius: '999px',
                      fontSize: '0.65rem', padding: '1px 6px', fontWeight: 'bold',
                    }}>
                      {unreadCount} new
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--accent)', fontSize: '0.78rem',
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}
                  >
                    <FiCheckCircle size={13} /> Mark all read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notifications.length === 0 && (
                  <p style={{
                    textAlign: 'center', color: 'var(--text-secondary)',
                    fontSize: '0.85rem', padding: '2rem 1rem',
                  }}>
                    No notifications yet
                  </p>
                )}
                {notifications.map(n => (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: n.is_read ? 'transparent' : 'rgba(59,158,255,0.05)',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Risk dot */}
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: riskDotColor[n.risk] || '#8B94A3',
                      marginTop: '5px', flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{
                        margin: '0 0 3px', fontSize: '0.82rem',
                        color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)',
                        lineHeight: 1.5,
                      }}>
                        {n.message}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.is_read && (
                      <button
                        onClick={() => markRead(n.id)}
                        title="Mark read"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--accent)', padding: '2px',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <FiCheck size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          backgroundColor: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: 'bold'
        }}>
          {initial}
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}

export default TopBar