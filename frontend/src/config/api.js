// Central API configuration. VITE_API_URL is embedded at build time by Vite.
// Keep the deployed API as a production fallback so a build without that
// variable never attempts to contact the visitor's own device (127.0.0.1).
const LOCAL_API_URL = 'http://127.0.0.1:8000'
const DEPLOYED_API_URL = 'https://cyber-defense-ai-assistant.onrender.com'
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const _base = configuredApiUrl || (import.meta.env.PROD ? DEPLOYED_API_URL : LOCAL_API_URL)

// Strip trailing slash
export const API_BASE = _base.replace(/\/$/, '')

// WebSocket URL — replaces http(s):// with ws(s)://
export const WS_BASE = API_BASE.replace(/^http/, 'ws')
