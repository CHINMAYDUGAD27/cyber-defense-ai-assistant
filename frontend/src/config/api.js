// Central API configuration
// In production, set VITE_API_URL in your Railway/Vercel environment variables
// e.g. VITE_API_URL=https://your-backend.railway.app

const _base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// Strip trailing slash
export const API_BASE = _base.replace(/\/$/, '')

// WebSocket URL — replaces http(s):// with ws(s)://
export const WS_BASE = API_BASE.replace(/^http/, 'ws')
