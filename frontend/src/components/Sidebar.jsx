import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FiGrid, FiSearch, FiClock, FiUser, FiLogOut, FiSettings, FiPlayCircle } from 'react-icons/fi'
import { MdSecurity, MdRadar } from 'react-icons/md'
import axios from 'axios'
import { API_BASE } from '../config/api'

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [watcherRunning, setWatcherRunning] = useState(false)

  // Poll watcher status every 8s to keep pulse dot in sync
  useEffect(() => {
    const token = localStorage.getItem('token')
    const check = () =>
      axios.get(`${API_BASE}/watcher/status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => setWatcherRunning(r.data.running))
        .catch(() => {})
    check()
    const id = setInterval(check, 8000)
    return () => clearInterval(id)
  }, [])

  const navItems = [
    { icon: <FiGrid />, label: 'Dashboard', path: '/' },
    { icon: <FiSearch />, label: 'Analyze', path: '/analyze' },
    { icon: <FiClock />, label: 'History', path: '/history' },
    { icon: <MdRadar />, label: 'Live Monitor', path: '/live-monitor', badge: watcherRunning },
    { icon: <FiPlayCircle />, label: 'Awareness', path: '/awareness' },
    { icon: <FiUser />, label: 'Profile', path: '/profile' },
    { icon: <FiSettings />, label: 'Settings', path: '/settings' },
  ]

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`)
    } catch (e) {}
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div style={{
      width: '70px',
      height: '100vh',
      backgroundColor: 'var(--bg-panel)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '1.5rem',
      paddingBottom: '1.5rem',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
        <div style={{
          color: 'var(--accent)', fontSize: '1.8rem', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: '1rem'
        }}>
          <MdSecurity />
        </div>

        {navItems.map((item, i) => {
          const isActive = location.pathname === item.path
          return (
            <div key={i} className="sidebar-item" style={{ position: 'relative' }}>
              <Link
                to={item.path}
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '1.3rem', textDecoration: 'none', padding: '0.4rem',
                  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isActive ? 'var(--accent)18' : 'transparent',
                  transition: 'color 0.15s, background-color 0.15s',
                  position: 'relative',
                }}
              >
                {item.icon}
                {/* Pulse dot for Live Monitor when watcher is active */}
                {item.badge && (
                  <span style={{
                    position: 'absolute',
                    top: '2px', right: '2px',
                    width: '8px', height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                    animation: 'sidebar-pulse 1.4s ease-out infinite',
                  }} />
                )}
              </Link>
              <div className="sidebar-tooltip">{item.label}</div>
            </div>
          )
        })}
      </div>

      <div className="sidebar-item" style={{ position: 'relative' }}>
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            fontSize: '1.3rem', cursor: 'pointer', padding: '0.4rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <FiLogOut />
        </button>
        <div className="sidebar-tooltip">Logout</div>
      </div>

      <style>{`
        @keyframes sidebar-pulse {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .sidebar-item .sidebar-tooltip {
          position: absolute;
          left: 55px;
          top: 50%;
          transform: translateY(-50%) translateX(-10px);
          background-color: var(--bg-panel);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          opacity: 0;
          visibility: hidden;
          transition: 0.2s ease;
          pointer-events: none;
          white-space: nowrap;
          z-index: 1000;
        }
        .sidebar-item:hover .sidebar-tooltip {
          opacity: 1;
          visibility: visible;
          transform: translateY(-50%) translateX(0);
        }
      `}</style>
    </div>
  )
}

export default Sidebar