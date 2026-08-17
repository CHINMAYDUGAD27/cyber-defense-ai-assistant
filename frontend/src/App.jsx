import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import Analyze from './pages/Analyze'
import History from './pages/History'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Signup from './pages/Signup'
import LiveMonitor from './pages/LiveMonitor'
import Awareness from './pages/Awareness'

import { useEffect } from 'react'
import axios from 'axios'
import { API_BASE } from './config/api'

function ProtectedLayout({ children }) {
  const isAuth = localStorage.getItem('isAuthenticated')
  
  useEffect(() => {
    if (isAuth) {
      const token = localStorage.getItem('token')
      axios.get(`${API_BASE}/settings`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const dbTheme = res.data.theme
          const currentLocal = localStorage.getItem('theme')
          
          if (dbTheme && dbTheme !== currentLocal) {
            localStorage.setItem('theme', dbTheme)
            if (dbTheme === 'light') {
              document.documentElement.setAttribute('data-theme', 'light')
            } else {
              document.documentElement.removeAttribute('data-theme')
            }
          }
        })
        .catch(() => {})
    }
  }, [isAuth])

  if (!isAuth) {
    return <Navigate to="/login" replace />
  }
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1, minHeight: '100vh', overflow: 'auto' }}>
        <TopBar />
        {children}
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/analyze" element={<ProtectedLayout><Analyze /></ProtectedLayout>} />
        <Route path="/history" element={<ProtectedLayout><History /></ProtectedLayout>} />
        <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
        <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
        <Route path="/live-monitor" element={<ProtectedLayout><LiveMonitor /></ProtectedLayout>} />
        <Route path="/awareness" element={<ProtectedLayout><Awareness /></ProtectedLayout>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App