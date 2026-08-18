import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

// Phase 8: Ensure cookies are sent with every request for HttpOnly JWT
axios.defaults.withCredentials = true

// A JWT lasts one day.  Do not leave a stale local login flag showing a
// protected screen when the API has rejected the expired token.
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('token')

      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

// Apply theme synchronously to avoid flash
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
