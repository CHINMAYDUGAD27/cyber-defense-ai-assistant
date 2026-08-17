import { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'
import { FiActivity, FiPlay, FiSquare, FiSettings, FiAlertTriangle, FiShield, FiClock, FiX, FiDownload, FiCpu } from 'react-icons/fi'
import { MdRadar } from 'react-icons/md'
import { Link } from 'react-router-dom'

import { API_BASE, WS_BASE } from '../config/api'

const API = API_BASE
const WS_URL = `${WS_BASE}/ws/live-alerts`

const RISK_COLORS = {
  Critical: 'var(--risk-critical)',
  High:     '#f97316',
  Medium:   'var(--risk-medium, #eab308)',
  Low:      'var(--risk-low)',
}

const RISK_BG = {
  Critical: 'rgba(239,68,68,0.1)',
  High:     'rgba(249,115,22,0.1)',
  Medium:   'rgba(234,179,8,0.1)',
  Low:      'rgba(34,197,94,0.1)',
}

function RiskBadge({ risk }) {
  return (
    <span style={{
      backgroundColor: RISK_BG[risk] || 'rgba(100,100,100,0.1)',
      color: RISK_COLORS[risk] || '#aaa',
      border: `1px solid ${RISK_COLORS[risk] || '#aaa'}`,
      borderRadius: '5px',
      padding: '0.15rem 0.55rem',
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      {risk}
    </span>
  )
}

function AlertCard({ alert, onDismiss }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 20) }, [])

  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: `1px solid ${RISK_COLORS[alert.risk] || 'var(--border-color)'}`,
      borderLeft: `4px solid ${RISK_COLORS[alert.risk] || 'var(--accent)'}`,
      borderRadius: '10px',
      padding: '1rem 1.1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-12px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      boxShadow: `0 0 12px ${RISK_COLORS[alert.risk]}22`,
      position: 'relative',
    }}>
      {/* Dismiss */}
      <button
        onClick={() => onDismiss(alert._uid)}
        style={{
          position: 'absolute', top: '0.6rem', right: '0.6rem',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '2px',
        }}
      ><FiX /></button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <FiAlertTriangle style={{ color: RISK_COLORS[alert.risk], flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          {alert.attack_type}
        </span>
        <RiskBadge risk={alert.risk} />
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-secondary)', paddingRight: '1.5rem' }}>
          <FiClock style={{ verticalAlign: 'middle', marginRight: '3px' }} />
          {new Date(alert.timestamp + 'Z').toLocaleTimeString()}
        </span>
      </div>

      {/* Reason */}
      <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {alert.reason}
      </p>

      {/* Log line */}
      <code style={{
        display: 'block', fontSize: '0.72rem',
        color: 'var(--text-secondary)',
        background: 'var(--bg-main, #0f1117)',
        borderRadius: '5px', padding: '0.4rem 0.6rem',
        wordBreak: 'break-all', whiteSpace: 'pre-wrap',
      }}>
        {alert.log_line}
      </code>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {alert.id && (
          <Link
            to={`/history`}
            style={{
              fontSize: '0.78rem', color: 'var(--accent)',
              textDecoration: 'none', fontWeight: 500,
            }}
          >
            View in History →
          </Link>
        )}
        {alert.recommendations?.[0] && (
          <span style={{
            fontSize: '0.75rem', color: 'var(--text-secondary)',
            background: 'var(--bg-main, #0f1117)',
            borderRadius: '4px', padding: '0.2rem 0.5rem',
          }}>
            💡 {alert.recommendations[0]}
          </span>
        )}
      </div>
    </div>
  )
}

export default function LiveMonitor() {
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  const [running, setRunning] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [config, setConfig] = useState({
    use_simulator: true,
    use_windows_events: false,
    log_file_path: '',
    scan_interval: 5,
  })
  const [showConfig, setShowConfig] = useState(false)
  const [showAgent, setShowAgent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [counts, setCounts] = useState({ Critical: 0, High: 0, Medium: 0, Low: 0 })
  const [statusLoading, setStatusLoading] = useState(true)

  const wsRef = useRef(null)
  const feedRef = useRef(null)
  const uidRef = useRef(0)

  // ── Fetch saved config + status ───────────────────────────────────────────
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [statusRes, cfgRes] = await Promise.all([
          axios.get(`${API}/watcher/status`, { headers }),
          axios.get(`${API}/watcher/config`, { headers }),
        ])
        setRunning(statusRes.data.running)
        setConfig({
          use_simulator: cfgRes.data.use_simulator ?? true,
          log_file_path: cfgRes.data.log_file_path ?? '',
          scan_interval: cfgRes.data.scan_interval ?? 5,
        })
      } catch {/* silent */}
      finally { setStatusLoading(false) }
    }
    fetchStatus()
  }, [])

  // ── WebSocket connection ──────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onerror = () => setWsConnected(false)
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        if (data.type !== 'alert') return
        const uid = ++uidRef.current
        setAlerts(prev => [{ ...data, _uid: uid }, ...prev].slice(0, 100))
        setCounts(prev => ({ ...prev, [data.risk]: (prev[data.risk] || 0) + 1 }))
        // Auto-scroll to top
        if (feedRef.current) feedRef.current.scrollTop = 0
      } catch {/* ignore malformed */ }
    }
    wsRef.current = ws
  }, [])

  const disconnectWS = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setWsConnected(false)
  }, [])

  // Connect WS when watcher starts, disconnect when it stops
  useEffect(() => {
    if (running) {
      connectWS()
    } else {
      disconnectWS()
    }
    return () => disconnectWS()
  }, [running])

  // ── Watcher controls ──────────────────────────────────────────────────────
  const handleStart = async () => {
    try {
      await axios.post(`${API}/watcher/start`, {
        use_simulator: config.use_simulator,
        use_windows_events: config.use_windows_events,
        log_file_path: config.log_file_path || null,
        scan_interval: Number(config.scan_interval),
      }, { headers })
      setRunning(true)
      setAlerts([])
      setCounts({ Critical: 0, High: 0, Medium: 0, Low: 0 })
    } catch (e) {
      alert('Failed to start watcher: ' + (e?.response?.data?.detail || e.message))
    }
  }

  const handleStop = async () => {
    try {
      await axios.post(`${API}/watcher/stop`, {}, { headers })
      setRunning(false)
    } catch (e) {
      alert('Failed to stop watcher: ' + (e?.response?.data?.detail || e.message))
    }
  }

  const dismissAlert = (uid) => setAlerts(prev => prev.filter(a => a._uid !== uid))
  const clearAll = () => { setAlerts([]); setCounts({ Critical: 0, High: 0, Medium: 0, Low: 0 }) }

  if (statusLoading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .pulse-dot {
          position: relative; width: 10px; height: 10px;
          border-radius: 50%;
        }
        .pulse-dot::after {
          content: '';
          position: absolute; inset: 0;
          border-radius: 50%;
          animation: pulse-ring 1.4s ease-out infinite;
        }
        .pulse-dot.green { background: #22c55e; }
        .pulse-dot.green::after { background: #22c55e; }
        .pulse-dot.gray  { background: #6b7280; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <MdRadar style={{ fontSize: '1.8rem', color: 'var(--accent)' }} />
        <h1 style={{ margin: 0 }}>Live Monitor</h1>
        <div className={`pulse-dot ${running ? 'green' : 'gray'}`} title={running ? 'Watcher active' : 'Watcher idle'} />
        <span style={{ fontSize: '0.82rem', color: running ? '#22c55e' : 'var(--text-secondary)', fontWeight: 600 }}>
          {running ? 'WATCHING' : 'IDLE'}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.78rem',
          color: wsConnected ? '#22c55e' : 'var(--text-secondary)',
        }}>
          {wsConnected ? '● WebSocket connected' : '○ WebSocket disconnected'}
        </span>
      </div>

      {/* ── Threat counters ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {['Critical', 'High', 'Medium', 'Low'].map(risk => (
          <div key={risk} style={{
            flex: '1 1 100px',
            background: 'var(--bg-panel)',
            border: `1px solid ${RISK_COLORS[risk]}44`,
            borderRadius: '10px',
            padding: '0.8rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.2rem',
            minWidth: '90px',
          }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: RISK_COLORS[risk] }}>
              {counts[risk]}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {risk}
            </span>
          </div>
        ))}
      </div>

      {/* ── Controls row ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {!running ? (
          <button onClick={handleStart} style={btnStyle('#22c55e')}>
            <FiPlay /> Start Watcher
          </button>
        ) : (
          <button onClick={handleStop} style={btnStyle('var(--risk-critical)')}>
            <FiSquare /> Stop Watcher
          </button>
        )}

        <button
          onClick={() => setShowConfig(v => !v)}
          style={btnStyle('var(--accent)', true)}
        >
          <FiSettings /> {showConfig ? 'Hide Config' : 'Configure'}
        </button>

        <button
          onClick={() => setShowAgent(v => !v)}
          style={btnStyle('#a855f7', true)}
        >
          <FiCpu /> {showAgent ? 'Hide Agent Setup' : '🔴 Connect Real Device'}
        </button>

        {alerts.length > 0 && (
          <button onClick={clearAll} style={btnStyle('#6b7280', true)}>
            <FiX /> Clear Feed
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <FiActivity style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''} in session
        </span>
      </div>

      {/* ── Config panel ───────────────────────────────────────────────────── */}
      {showConfig && (
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '1.2rem',
          marginBottom: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            <FiSettings style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Watcher Configuration
          </h3>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={labelStyle}>Mode</label>
            <button
              onClick={() => setConfig(c => ({ ...c, use_simulator: true, use_windows_events: false }))}
              style={modeBtn(config.use_simulator)}
            >🎮 Simulator (Demo)</button>
            <button
              onClick={() => setConfig(c => ({ ...c, use_simulator: false, use_windows_events: true }))}
              style={{
                ...modeBtn(config.use_windows_events && !config.use_simulator),
                borderColor: (config.use_windows_events && !config.use_simulator) ? '#22c55e' : undefined,
                color: (config.use_windows_events && !config.use_simulator) ? '#22c55e' : undefined,
                background: (config.use_windows_events && !config.use_simulator) ? 'rgba(34,197,94,0.1)' : undefined,
              }}
            >🪟 Windows Events</button>
            <button
              onClick={() => setConfig(c => ({ ...c, use_simulator: false, use_windows_events: false }))}
              style={modeBtn(!config.use_simulator && !config.use_windows_events)}
            >📄 Real Log File</button>
          </div>

          {/* Log file path (shown only in real mode) */}
          {!config.use_simulator && !config.use_windows_events && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label style={labelStyle}>Log File Path</label>
              <input
                type="text"
                placeholder="e.g. C:\nginx\access.log or /var/log/auth.log"
                value={config.log_file_path}
                onChange={e => setConfig(c => ({ ...c, log_file_path: e.target.value }))}
                style={inputStyle}
              />
            </div>
          )}

          {/* Windows Events info banner */}
          {config.use_windows_events && !config.use_simulator && (
            <div style={{
              fontSize: '0.78rem', color: '#22c55e',
              background: 'rgba(34,197,94,0.08)',
              borderRadius: '6px', padding: '0.6rem 0.75rem',
              border: '1px solid rgba(34,197,94,0.25)',
              lineHeight: 1.6,
            }}>
              🪟 <strong>Windows Events mode</strong>: Reads your real Windows Security & System Event Log every {config.scan_interval} seconds.<br />
              Detects: <em>failed logins, account lockouts, new services, audit policy changes, suspicious processes</em> — automatically. No file needed.
            </div>
          )}

          {/* Scan interval */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <label style={labelStyle}>Scan Interval</label>
            <input
              type="number"
              min={2} max={60}
              value={config.scan_interval}
              onChange={e => setConfig(c => ({ ...c, scan_interval: Number(e.target.value) }))}
              style={{ ...inputStyle, width: '80px' }}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>seconds</span>
          </div>

          {config.use_simulator && (
            <div style={{
              fontSize: '0.78rem', color: 'var(--text-secondary)',
              background: 'rgba(99,102,241,0.08)',
              borderRadius: '6px', padding: '0.5rem 0.75rem',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              🎮 <strong>Simulator mode</strong>: Generates realistic log entries automatically — no real log file needed.
              Switch to <em>Real Log File</em> mode to monitor an actual system log.
            </div>
          )}
        </div>
      )}

      {/* ── Agent Setup Panel ──────────────────────────────────────────────── */}
      {showAgent && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(99,102,241,0.06))',
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: '12px',
          padding: '1.4rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiCpu /> Connect a Real Device (Lightweight Agent)
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Run the <strong style={{ color: '#a855f7' }}>agent.py</strong> script on any computer (Windows, Mac or Linux).
            It will read that machine's real security logs and stream them live to this dashboard.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Step 1 */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>Step 1 — Download the Agent</p>
              <a
                href={`${API_BASE}/static/agent.py`}
                download="agent.py"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: '#a855f7', color: '#fff', borderRadius: '7px',
                  padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <FiDownload /> Download agent.py
              </a>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.77rem', color: 'var(--text-secondary)' }}>
                Or find it in your project at <code>backend/agent.py</code>
              </p>
            </div>

            {/* Step 2 */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>Step 2 — Set your credentials in agent.py</p>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Open agent.py and paste these two values at the top:</p>
              <code style={{
                display: 'block', background: '#0f1117', borderRadius: '6px',
                padding: '0.75rem', fontSize: '0.78rem', lineHeight: 1.8,
                color: '#a5f3fc', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {`API_URL = "${API_BASE}/watcher/ingest"`}{`\n`}
                {`BEARER_TOKEN = "${localStorage.getItem('token') || 'your_token_here'}"`}
              </code>
              <button
                onClick={() => {
                  const txt = `API_URL = "${API_BASE}/watcher/ingest"\nBEARER_TOKEN = "${localStorage.getItem('token') || ''}"`
                  navigator.clipboard.writeText(txt)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                style={{
                  marginTop: '0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: 'transparent', border: '1px solid rgba(168,85,247,0.4)',
                  borderRadius: '6px', color: '#a855f7', padding: '0.35rem 0.8rem',
                  fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600,
                }}
              >
                {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
              </button>
            </div>

            {/* Step 3 */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>Step 3 — Run the Agent on that Device</p>
              <code style={{
                display: 'block', background: '#0f1117', borderRadius: '6px',
                padding: '0.6rem 0.9rem', fontSize: '0.82rem', color: '#86efac',
              }}>
                python agent.py
              </code>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.77rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                🪟 <strong>Windows:</strong> Run as Administrator for full Security Event Log access.<br />
                🐧 <strong>Linux/Mac:</strong> Run with <code>sudo python agent.py</code> for auth log access.<br />
                That machine's real threats will now appear <strong style={{ color: '#22c55e' }}>live on this screen! 🎯</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert feed ─────────────────────────────────────────────────────── */}
      {running && alerts.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem',
          color: 'var(--text-secondary)', fontSize: '0.9rem',
        }}>
          <FiShield style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.4, display: 'block', margin: '0 auto 0.75rem' }} />
          Watching for threats… alerts will appear here in real-time.
        </div>
      )}

      {!running && alerts.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem',
          color: 'var(--text-secondary)', fontSize: '0.9rem',
          border: '1px dashed var(--border-color)',
          borderRadius: '12px',
        }}>
          <MdRadar style={{ fontSize: '3rem', marginBottom: '0.75rem', opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
          <p style={{ margin: 0 }}>Watcher is idle. Press <strong>Start Watcher</strong> to begin pre-detection.</p>
        </div>
      )}

      <div
        ref={feedRef}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '65vh', overflowY: 'auto' }}
      >
        {alerts.map(alert => (
          <AlertCard key={alert._uid} alert={alert} onDismiss={dismissAlert} />
        ))}
      </div>
    </div>
  )
}

// ── Shared styles ────────────────────────────────────────────────────────────
const btnStyle = (color, outlined = false) => ({
  display: 'flex', alignItems: 'center', gap: '0.45rem',
  backgroundColor: outlined ? 'transparent' : color,
  border: `1px solid ${color}`,
  borderRadius: '8px',
  color: outlined ? color : '#fff',
  padding: '0.5rem 1rem',
  fontSize: '0.85rem', fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
})

const labelStyle = {
  fontSize: '0.82rem', fontWeight: 600,
  color: 'var(--text-secondary)', minWidth: '110px',
}

const inputStyle = {
  background: 'var(--bg-main, #0f1117)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  padding: '0.45rem 0.75rem',
  fontSize: '0.83rem',
  outline: 'none',
  flex: 1,
}

const modeBtn = (active) => ({
  padding: '0.4rem 0.9rem',
  borderRadius: '6px',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-color)'}`,
  background: active ? 'var(--accent)22' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text-secondary)',
  fontWeight: active ? 700 : 400,
  fontSize: '0.82rem',
  cursor: 'pointer',
})
