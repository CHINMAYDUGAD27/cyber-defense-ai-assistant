import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

// Phase 8: Ensure cookies are sent with every request for HttpOnly JWT
axios.defaults.withCredentials = true

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
